"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";

import { db } from "@/db";
import { events, photoFaces, photos } from "@/db/schema";
import { requireApprovedPhotographer } from "@/lib/dal";
import { hashPin, isPin } from "@/lib/event-pin";
import {
  ACCEPTED_MIME,
  buildCoverImage,
  buildWatermarkLogo,
  MAX_COVER_BYTES,
  MAX_WATERMARK_LOGO_BYTES,
} from "@/lib/images";
import { faceProvider } from "@/lib/face";
import {
  deleteStoragePath,
  storagePaths,
  writeStorageFile,
} from "@/lib/storage";

/**
 * Validates and decodes an uploaded cover, without touching storage.
 *
 * **Everything that can fail happens here, before the event row exists.** The
 * first version of this ran after the insert, because the storage path needs
 * the event id — which meant a photographer who picked a 40 MB RAW got an
 * error message *and* an already-created event, and creating a second one by
 * resubmitting the form. Nothing about checking a file's size or decoding it
 * needs an id, so only the write is deferred.
 *
 * Returns null when no file was chosen; a cover is optional.
 */
async function prepareCover(file: File | null): Promise<Buffer | null> {
  if (!file || file.size === 0) return null;

  if (file.size > MAX_COVER_BYTES) throw new CoverError("too_large");
  if (!ACCEPTED_MIME.includes(file.type as (typeof ACCEPTED_MIME)[number])) {
    throw new CoverError("bad_format");
  }

  try {
    return await buildCoverImage(Buffer.from(await file.arrayBuffer()));
  } catch {
    // sharp refuses anything it cannot decode — a renamed .txt, a truncated
    // download. To the photographer that is the same problem as a wrong type.
    throw new CoverError("bad_format");
  }
}

class CoverError extends Error {
  constructor(readonly reason: "too_large" | "bad_format") {
    super(reason);
  }
}

/**
 * Every optional field is `.nullish()`, not `.optional()`.
 *
 * `FormData.get` returns **null** for a field that was not submitted, and
 * `.optional()` accepts `string | undefined` — not null. The two look
 * interchangeable and are not.
 *
 * That mismatch shipped a bug: `entryPin` only renders when the "private
 * event" box is ticked, so on every public event `formData.get("entryPin")`
 * was null, the whole object failed to parse, and creating a public event
 * returned "invalid" with nothing on screen pointing at why. Any field that
 * can be conditionally rendered — or simply removed from the form later — has
 * the same shape, so the fix belongs on all of them rather than on the one
 * that happened to break first.
 */
const EventInput = z.object({
  nameTh: z.string().trim().min(2).max(160),
  nameEn: z.string().trim().max(160).nullish(),
  descriptionTh: z.string().trim().max(2000).nullish(),
  location: z.string().trim().max(160).nullish(),
  /**
   * The day, as `<input type="date">` gives it: "2026-09-10".
   *
   * Stored straight through with no parsing and no timezone arithmetic. The
   * previous version took two `datetime-local` values and had to pin the
   * Bangkok offset by hand on every write, because a wall-clock string carries
   * no zone and `new Date` would have read it in the server's. A date has no
   * instant to place, so that whole class of bug is gone rather than handled.
   */
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isPrivate: z.union([z.literal("on"), z.null(), z.undefined()]),
  /**
   * Six digits, or absent on a public event where the field is not rendered
   * at all — hence `.nullish()`. Hashed before it is stored.
   */
  entryPin: z.string().nullish(),
});

export type StudioState =
  | {
      error:
        | "invalid"
        | "unavailable"
        | "pin_required"
        | "cover_too_large"
        | "cover_bad_format";
      /** Echoed back so a rejected form does not lose what was typed. */
      values?: Record<string, string>;
    }
  | undefined;

/**
 * Creates an event as a draft.
 *
 * It never goes live from here: `status` stays `draft` until the photographer
 * publishes it with `publishEvent`. The finder, the event page and
 * /api/media all refuse anything that is not `approved`, so photographs
 * uploaded into a fresh event are not reachable by anyone but their owner
 * until then — the photographer sets the event up and uploads at their own
 * pace before anyone else can see it, not because it is waiting on review.
 *
 * The access code is deliberately absent from this insert. It is issued by
 * `gen_event_code()` in migration 0002 — see the note on `events.accessCode`.
 */
export async function createEvent(
  _prev: StudioState,
  formData: FormData,
): Promise<StudioState> {
  const { photographer } = await requireApprovedPhotographer();

  const raw = {
    nameTh: formData.get("nameTh"),
    nameEn: formData.get("nameEn"),
    descriptionTh: formData.get("descriptionTh"),
    location: formData.get("location"),
    eventDate: formData.get("eventDate"),
    isPrivate: formData.get("isPrivate"),
    entryPin: formData.get("entryPin"),
  };

  // The PIN is deliberately absent from the echo. Everything here is rendered
  // straight back into the form's HTML on a validation failure, and a secret
  // that lands in the page source — and in any proxy log or crash report that
  // captured it — is no longer a secret.
  const echo = Object.fromEntries(
    Object.entries(raw)
      .filter(([key]) => key !== "entryPin")
      .map(([key, value]) => [key, String(value ?? "")]),
  );

  const parsed = EventInput.safeParse(raw);
  if (!parsed.success) return { error: "invalid", values: echo };

  const data = parsed.data;
  const wantsPrivate = data.isPrivate === "on";

  // A private event without a PIN is just an unlisted one, which is a URL
  // guess away from public. Refused rather than quietly downgraded.
  if (wantsPrivate && !isPin(data.entryPin ?? "")) {
    return { error: "pin_required", values: echo };
  }

  const entryPinHash = wantsPrivate ? await hashPin(data.entryPin!) : null;

  // Decoded before anything is written, so a bad file cannot leave a
  // half-created event behind — see the note on `prepareCover`.
  let cover: Buffer | null;
  try {
    cover = await prepareCover(formData.get("cover") as File | null);
  } catch (error) {
    if (error instanceof CoverError) {
      return {
        error:
          error.reason === "too_large" ? "cover_too_large" : "cover_bad_format",
        values: echo,
      };
    }
    throw error;
  }

  // No slug, and therefore no collision loop. The event's public address is
  // its access code, which `gen_event_code()` issues inside the insert and
  // already guarantees unique — there is no second identifier left to keep
  // distinct, and nothing here can produce a name clash between two
  // photographers who both called their event "งานกีฬาสี".
  let created: { id: string } | undefined;

  try {
    [created] = await db
      .insert(events)
      .values({
        nameTh: data.nameTh,
        nameEn: data.nameEn || null,
        descriptionTh: data.descriptionTh || null,
        location: data.location || null,
        eventDate: data.eventDate,
        isPrivate: wantsPrivate,
        entryPinHash,
        ownerId: photographer.id,
        status: "draft",
      })
      .returning({ id: events.id });
  } catch (error) {
    console.warn("[find-ku-dae] event insert failed:", error);
    return { error: "unavailable", values: echo };
  }

  if (!created) return { error: "unavailable", values: echo };

  // Only the write is deferred, because the path is built from the event id.
  // A disk failure at this point leaves a real event with no cover rather
  // than discarding everything the photographer typed — a cover is the one
  // field on this form they can add again in a second.
  if (cover) {
    try {
      const coverPath = storagePaths.eventCover(created.id);
      await writeStorageFile(coverPath, cover);
      await db
        .update(events)
        .set({ coverPath })
        .where(eq(events.id, created.id));
    } catch (error) {
      console.warn("[find-ku-dae] cover write failed:", error);
    }
  }

  revalidatePath("/studio");
  redirect(`/studio/events/${created.id}`);
}

export type EventSettingsState =
  | { ok: true }
  | {
      ok: false;
      error:
        | "invalid"
        | "unavailable"
        | "pin_required"
        | "cover_too_large"
        | "cover_bad_format";
      values?: Record<string, string>;
    }
  | undefined;

/**
 * Edits an existing event's basic info, cover and privacy — everything on
 * `EventInput`, the same shape `createEvent` validates, minus the fields
 * that are never editable after the fact (`status`, `accessCode`).
 *
 * The PIN is the one field that behaves differently from creation: it is
 * `.nullish()` here in the sense that leaving it blank does not mean "no
 * PIN," it means "keep the one already set." A hash cannot be shown back to
 * the photographer to confirm — see the note on `entryPinHash` — so a
 * settings form that required retyping it on every save would force a new
 * PIN, and therefore a new round of telling people the old one no longer
 * works, every time somebody just wanted to fix a typo in the description.
 * Typing a fresh PIN still replaces it; the "randomise" control on the form
 * works exactly as it does on creation.
 */
export async function updateEvent(
  _prev: EventSettingsState,
  formData: FormData,
): Promise<EventSettingsState> {
  const { photographer } = await requireApprovedPhotographer();

  const idResult = z.string().uuid().safeParse(formData.get("id"));
  if (!idResult.success) return { ok: false, error: "invalid" };

  const raw = {
    nameTh: formData.get("nameTh"),
    nameEn: formData.get("nameEn"),
    descriptionTh: formData.get("descriptionTh"),
    location: formData.get("location"),
    eventDate: formData.get("eventDate"),
    isPrivate: formData.get("isPrivate"),
    entryPin: formData.get("entryPin"),
  };

  // See the note on the same line in `createEvent`: the PIN never goes back
  // into the page.
  const echo = Object.fromEntries(
    Object.entries(raw)
      .filter(([key]) => key !== "entryPin")
      .map(([key, value]) => [key, String(value ?? "")]),
  );

  const parsed = EventInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid", values: echo };

  const data = parsed.data;
  const wantsPrivate = data.isPrivate === "on";

  // Ownership is part of the lookup, not a check on the result.
  const [event] = await db
    .select({
      id: events.id,
      isPrivate: events.isPrivate,
      entryPinHash: events.entryPinHash,
      coverPath: events.coverPath,
    })
    .from(events)
    .where(and(eq(events.id, idResult.data), eq(events.ownerId, photographer.id)))
    .limit(1);
  if (!event) return { ok: false, error: "invalid", values: echo };

  let entryPinHash = event.entryPinHash;
  if (!wantsPrivate) {
    entryPinHash = null;
  } else if (data.entryPin && isPin(data.entryPin)) {
    entryPinHash = await hashPin(data.entryPin);
  } else if (!event.isPrivate) {
    // Turning a public event private with no PIN typed — refused rather
    // than quietly downgraded, same as on creation.
    return { ok: false, error: "pin_required", values: echo };
  }
  // else: already private and no new PIN was typed — entryPinHash stays.

  // Decoded before anything is written — see the note on `prepareCover`.
  let cover: Buffer | null;
  try {
    cover = await prepareCover(formData.get("cover") as File | null);
  } catch (error) {
    if (error instanceof CoverError) {
      return {
        ok: false,
        error:
          error.reason === "too_large" ? "cover_too_large" : "cover_bad_format",
        values: echo,
      };
    }
    throw error;
  }

  let coverPath = event.coverPath;
  if (cover) {
    coverPath = storagePaths.eventCover(event.id);
    try {
      await writeStorageFile(coverPath, cover);
    } catch (error) {
      console.warn("[find-ku-dae] cover write failed:", error);
      return { ok: false, error: "unavailable", values: echo };
    }
  }

  try {
    await db
      .update(events)
      .set({
        nameTh: data.nameTh,
        nameEn: data.nameEn || null,
        descriptionTh: data.descriptionTh || null,
        location: data.location || null,
        eventDate: data.eventDate,
        isPrivate: wantsPrivate,
        entryPinHash,
        coverPath,
        // A plain checkbox, not part of `EventInput` — it has no interplay
        // with the other fields the way privacy and the PIN do.
        allowOriginalDownload: formData.get("allowOriginalDownload") === "on",
        updatedAt: new Date(),
      })
      .where(eq(events.id, event.id));
  } catch (error) {
    console.warn("[find-ku-dae] event update failed:", error);
    return { ok: false, error: "unavailable", values: echo };
  }

  revalidatePath("/studio");
  revalidatePath(`/studio/events/${event.id}`);
  revalidatePath(`/studio/events/${event.id}/settings`);
  revalidatePath("/events");
  return { ok: true };
}

const EventId = z.object({ id: z.string().uuid() });

/**
 * Takes a draft live — no admin approval sits in between.
 *
 * Scoped to the caller's own events by the `where` clause rather than by
 * having checked on the page that rendered the button — a server action is a
 * public endpoint, and the id in the form is whatever the caller sent.
 *
 * An admin can still pull a published event back down (`rejectEvent` in
 * `lib/actions/admin.ts`) if something published turns out to need review;
 * this is only the gate that used to sit *before* publish.
 */
export async function publishEvent(formData: FormData) {
  const { photographer } = await requireApprovedPhotographer();
  const { id } = EventId.parse({ id: formData.get("id") });

  await db
    .update(events)
    .set({ status: "approved", updatedAt: new Date() })
    .where(
      and(
        eq(events.id, id),
        eq(events.ownerId, photographer.id),
        eq(events.status, "draft"),
      ),
    );

  revalidatePath("/studio");
  revalidatePath(`/studio/events/${id}`);
  revalidatePath("/events");
}

/**
 * Pulls a live event off the finder and its public page, without deleting
 * anything — the photographer's own pause button, not a moderation action.
 * `resumeEvent` reopens it and needs no admin either, for the same reason
 * `publishEvent` no longer does: nothing sits between a photographer and
 * their own event in either direction.
 *
 * Scoped to `status = 'approved'` on the way in, so this cannot be used to
 * sneak a rejected or still-draft event into an "archived" state it never
 * earned.
 */
export async function pauseEvent(formData: FormData) {
  const { photographer } = await requireApprovedPhotographer();
  const { id } = EventId.parse({ id: formData.get("id") });

  await db
    .update(events)
    .set({ status: "archived", updatedAt: new Date() })
    .where(
      and(
        eq(events.id, id),
        eq(events.ownerId, photographer.id),
        eq(events.status, "approved"),
      ),
    );

  revalidatePath("/studio");
  revalidatePath(`/studio/events/${id}`);
  revalidatePath(`/studio/events/${id}/settings`);
  revalidatePath("/events");
}

/** The other half of `pauseEvent`. */
export async function resumeEvent(formData: FormData) {
  const { photographer } = await requireApprovedPhotographer();
  const { id } = EventId.parse({ id: formData.get("id") });

  await db
    .update(events)
    .set({ status: "approved", updatedAt: new Date() })
    .where(
      and(
        eq(events.id, id),
        eq(events.ownerId, photographer.id),
        eq(events.status, "archived"),
      ),
    );

  revalidatePath("/studio");
  revalidatePath(`/studio/events/${id}`);
  revalidatePath(`/studio/events/${id}/settings`);
  revalidatePath("/events");
}

const WatermarkInput = z.object({
  watermarkEnabled: z.union([z.literal("on"), z.null(), z.undefined()]),
  watermarkText: z.string().trim().max(120).nullish(),
  watermarkPosition: z.enum([
    "bottom_right",
    "bottom_left",
    "top_right",
    "top_left",
    "center",
    "tiled",
  ]),
  watermarkOpacity: z.coerce.number().int().min(5).max(100),
  watermarkScale: z.coerce.number().int().min(4).max(60),
  removeLogo: z.union([z.literal("on"), z.null(), z.undefined()]),
});

export type WatermarkState =
  | { ok: true }
  | {
      ok: false;
      error: "invalid" | "logo_too_large" | "logo_bad_format" | "empty";
    }
  | undefined;

/**
 * A separate form and a separate action from `updateEvent`, on purpose: the
 * watermark has its own file upload and its own failure modes (a bad logo
 * should not also discard a rename typed in the other form), and it is a
 * setting a photographer reasonably visits without touching anything else.
 */
export async function updateWatermark(
  _prev: WatermarkState,
  formData: FormData,
): Promise<WatermarkState> {
  const { photographer } = await requireApprovedPhotographer();

  const idResult = z.string().uuid().safeParse(formData.get("id"));
  if (!idResult.success) return { ok: false, error: "invalid" };

  const parsed = WatermarkInput.safeParse({
    watermarkEnabled: formData.get("watermarkEnabled"),
    watermarkText: formData.get("watermarkText"),
    watermarkPosition: formData.get("watermarkPosition"),
    watermarkOpacity: formData.get("watermarkOpacity"),
    watermarkScale: formData.get("watermarkScale"),
    removeLogo: formData.get("removeLogo"),
  });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const data = parsed.data;

  const [event] = await db
    .select({ id: events.id, watermarkLogoPath: events.watermarkLogoPath })
    .from(events)
    .where(and(eq(events.id, idResult.data), eq(events.ownerId, photographer.id)))
    .limit(1);
  if (!event) return { ok: false, error: "invalid" };

  const logoFile = formData.get("watermarkLogo") as File | null;
  const hasNewLogo = Boolean(logoFile && logoFile.size > 0);

  if (hasNewLogo) {
    if (logoFile!.size > MAX_WATERMARK_LOGO_BYTES) {
      return { ok: false, error: "logo_too_large" };
    }
    if (logoFile!.type !== "image/png") {
      return { ok: false, error: "logo_bad_format" };
    }
  }

  // Fixed filename, like the cover: replacing a logo overwrites rather than
  // accumulating orphaned files from every previous upload. Computed before
  // anything touches storage, so the "empty" check below sees the shape the
  // row would end up in rather than the shape it is in right now.
  const nextLogoPath =
    data.removeLogo === "on"
      ? null
      : hasNewLogo
        ? storagePaths.eventWatermark(event.id, "logo.png")
        : event.watermarkLogoPath;

  // `applyWatermark` draws nothing at all when both are empty — text or a
  // logo is what it composites, and "on" with neither is a switch that does
  // nothing while looking, from the settings screen, like it did something.
  // Refused here for the same reason a private event without a PIN is
  // refused rather than quietly downgraded.
  //
  // This runs before any write or delete on purpose. Rejecting *after*
  // deleting the old logo — because the box got unticked with no text typed
  // — would leave the row pointing at a file that no longer exists: the
  // photographer sees an error, but the damage already happened.
  if (data.watermarkEnabled === "on" && !data.watermarkText?.trim() && !nextLogoPath) {
    return { ok: false, error: "empty" };
  }

  let logo: Buffer | undefined;
  if (hasNewLogo) {
    try {
      logo = await buildWatermarkLogo(Buffer.from(await logoFile!.arrayBuffer()));
    } catch {
      return { ok: false, error: "logo_bad_format" };
    }
  }

  // Every rejection has already returned by this point — the only paths left
  // either keep the logo untouched, delete it, or replace it.
  if (data.removeLogo === "on") {
    if (event.watermarkLogoPath) await deleteStoragePath(event.watermarkLogoPath);
  } else if (logo) {
    await writeStorageFile(nextLogoPath!, logo);
  }

  await db
    .update(events)
    .set({
      watermarkEnabled: data.watermarkEnabled === "on",
      watermarkText: data.watermarkText || null,
      watermarkLogoPath: nextLogoPath,
      watermarkPosition: data.watermarkPosition,
      watermarkOpacity: data.watermarkOpacity,
      watermarkScale: data.watermarkScale,
      updatedAt: new Date(),
    })
    .where(eq(events.id, event.id));

  revalidatePath(`/studio/events/${event.id}/settings`);
  revalidatePath(`/studio/events/${event.id}`);
  return { ok: true };
}

const Delete = z.object({
  id: z.string().uuid(),
  /** The event's own code, retyped. See the note below. */
  confirm: z.string().trim(),
});

/**
 * Deletes an event and everything in it, permanently.
 *
 * **Order is files, then the row, and that is deliberate.** Either half can
 * fail, so the question is which wreckage is better:
 *
 *  - row first, files left behind → photographs of people sitting on disk with
 *    nothing in the database pointing at them. No screen can reach them, no
 *    photographer can remove them, and face data is sensitive under the PDPA.
 *  - files first, row left behind → the event is still listed with broken
 *    thumbnails. The photographer sees it and presses delete again, and the
 *    second attempt finishes the job.
 *
 * The second is visible and self-healing. The first is silent residue.
 *
 * The Rekognition collection goes first of all: it holds the face vectors,
 * lives outside this database entirely, and nothing else will ever clean it up
 * — a missed collection is both a standing privacy exposure and a standing
 * bill.
 *
 * The caller must retype the event's access code. A confirm dialog is clicked
 * through on reflex; typing six characters that are only correct for the event
 * actually on screen is what stops somebody deleting the wrong one.
 */
export async function deleteEvent(formData: FormData): Promise<void> {
  const { photographer } = await requireApprovedPhotographer();
  const { id, confirm } = Delete.parse({
    id: formData.get("id"),
    confirm: formData.get("confirm"),
  });

  // Ownership is part of the lookup, not a check on the result.
  const [event] = await db
    .select({
      id: events.id,
      accessCode: events.accessCode,
      faceCollectionId: events.faceCollectionId,
    })
    .from(events)
    .where(and(eq(events.id, id), eq(events.ownerId, photographer.id)))
    .limit(1);

  if (!event) return;

  // Compared case-insensitively for the same reason the finder is: the code
  // has no lower-case members, so folding case cannot match a different event.
  if (confirm.toUpperCase() !== event.accessCode.toUpperCase()) return;

  if (event.faceCollectionId) {
    try {
      await faceProvider.deleteCollection(event.faceCollectionId);
    } catch (error) {
      // Logged loudly rather than swallowed: this is biometric data left
      // behind on a third-party service, and nothing else sweeps it up.
      console.error(
        "[find-ku-dae] face collection not deleted for event",
        event.id,
        error,
      );
    }
  }

  await deleteStoragePath(storagePaths.eventDir(event.id));
  await db.delete(events).where(eq(events.id, event.id));

  revalidatePath("/studio");
  revalidatePath("/events");
  revalidatePath("/admin");
  redirect("/studio");
}

const DeletePhotos = z.object({
  eventId: z.string().uuid(),
  photoIds: z.array(z.string().uuid()).min(1),
});

/**
 * Deletes one or more photos from an event — a single checked box or a
 * hundred, the same action either way, since a native checkbox group posts
 * every checked value under one field name with no JavaScript required.
 *
 * Same ordering as `deleteEvent` and for the same reason: Rekognition holds
 * the face vectors and lives outside this database entirely, so it goes
 * first regardless of what happens to the rows and files after it. Storage
 * then the database — a row surviving with no file behind it just shows a
 * broken thumbnail the photographer can select and delete again; a file
 * surviving with no row is invisible and orphaned forever.
 */
export async function deletePhotos(formData: FormData): Promise<void> {
  const { photographer } = await requireApprovedPhotographer();

  const parsed = DeletePhotos.safeParse({
    eventId: formData.get("eventId"),
    photoIds: formData.getAll("photoIds"),
  });
  if (!parsed.success) return;
  const { eventId, photoIds } = parsed.data;

  // Ownership is part of the lookup, not a check on the result — the ids in
  // the form are whatever the caller sent.
  const [event] = await db
    .select({ id: events.id, faceCollectionId: events.faceCollectionId })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.ownerId, photographer.id)))
    .limit(1);
  if (!event) return;

  const rows = await db
    .select({
      id: photos.id,
      originalPath: photos.originalPath,
      previewPath: photos.previewPath,
      thumbPath: photos.thumbPath,
    })
    .from(photos)
    .where(and(eq(photos.eventId, event.id), inArray(photos.id, photoIds)));
  if (rows.length === 0) return;

  if (event.faceCollectionId) {
    const faceRows = await db
      .select({ faceId: photoFaces.faceId })
      .from(photoFaces)
      .where(
        inArray(
          photoFaces.photoId,
          rows.map((row) => row.id),
        ),
      );

    if (faceRows.length > 0) {
      try {
        await faceProvider.deleteFaces(
          event.faceCollectionId,
          faceRows.map((row) => row.faceId),
        );
      } catch (error) {
        // Logged loudly rather than swallowed — see the note on `deleteEvent`.
        console.error(
          "[find-ku-dae] face vectors not deleted for photos",
          rows.map((row) => row.id),
          error,
        );
      }
    }
  }

  await Promise.all(
    rows.flatMap((row) => [
      deleteStoragePath(row.originalPath),
      deleteStoragePath(row.previewPath),
      deleteStoragePath(row.thumbPath),
    ]),
  );

  await db.transaction(async (tx) => {
    await tx.delete(photos).where(
      inArray(
        photos.id,
        rows.map((row) => row.id),
      ),
    );

    // `greatest(..., 0)` rather than trusting the count stays in sync — a
    // concurrent upload finishing between the select above and this update
    // must not push the count negative.
    await tx
      .update(events)
      .set({ photoCount: sql`greatest(${events.photoCount} - ${rows.length}, 0)` })
      .where(eq(events.id, event.id));
  });

  revalidatePath("/studio");
  revalidatePath(`/studio/events/${eventId}`);
}
