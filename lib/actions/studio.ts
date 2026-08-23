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
  buildDetectionCopy,
  buildWatermarkLogo,
  MAX_COVER_BYTES,
  MAX_WATERMARK_LOGO_BYTES,
} from "@/lib/images";
import { faceProvider } from "@/lib/face";
import { indexPhotoFaces } from "@/lib/face/pipeline";
import {
  deleteStoragePath,
  readStorageFile,
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
    console.warn("[pix-ku-csc] event insert failed:", error);
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
      console.warn("[pix-ku-csc] cover write failed:", error);
    }
  }

  revalidatePath("/studio");
  redirect(`/studio/events/${created.id}`);
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

export type EventSettingsState =
  | { ok: true }
  | {
      ok: false;
      error:
        | "invalid"
        | "unavailable"
        | "pin_required"
        | "cover_too_large"
        | "cover_bad_format"
        | "logo_too_large"
        | "logo_bad_format"
        | "watermark_empty";
      values?: Record<string, string>;
    }
  | undefined;

/**
 * Edits everything about an existing event from one form and one save:
 * basic info, cover, privacy, the download toggle, and the watermark. These
 * used to be two actions behind two submit buttons on the same page — a
 * photographer does not think of "rename the event" and "adjust the
 * watermark" as two separate saves, and a second button on the same screen
 * mostly just meant it went unnoticed.
 *
 * The PIN behaves differently from creation: leaving it blank means "keep
 * the one already set," not "no PIN" — see the note on `entryPinHash`, a
 * hash cannot be shown back to confirm, so requiring a retype on every save
 * would force a new PIN every time somebody fixed a typo in the description.
 *
 * Every field is validated before anything touches storage. That matters
 * most for the watermark: rejecting an empty-watermark save *after*
 * deleting the old logo, or after writing a half-uploaded new one, would
 * leave the row pointing at a file that no longer matches it.
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

  const watermarkParsed = WatermarkInput.safeParse({
    watermarkEnabled: formData.get("watermarkEnabled"),
    watermarkText: formData.get("watermarkText"),
    watermarkPosition: formData.get("watermarkPosition"),
    watermarkOpacity: formData.get("watermarkOpacity"),
    watermarkScale: formData.get("watermarkScale"),
    removeLogo: formData.get("removeLogo"),
  });
  if (!watermarkParsed.success) return { ok: false, error: "invalid", values: echo };
  const watermarkData = watermarkParsed.data;

  // Ownership is part of the lookup, not a check on the result.
  const [event] = await db
    .select({
      id: events.id,
      isPrivate: events.isPrivate,
      entryPinHash: events.entryPinHash,
      coverPath: events.coverPath,
      watermarkLogoPath: events.watermarkLogoPath,
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

  const logoFile = formData.get("watermarkLogo") as File | null;
  const hasNewLogo = Boolean(logoFile && logoFile.size > 0);

  if (hasNewLogo) {
    if (logoFile!.size > MAX_WATERMARK_LOGO_BYTES) {
      return { ok: false, error: "logo_too_large", values: echo };
    }
    if (logoFile!.type !== "image/png") {
      return { ok: false, error: "logo_bad_format", values: echo };
    }
  }

  // Fixed filename, like the cover: replacing a logo overwrites rather than
  // accumulating orphaned files from every previous upload. Computed before
  // anything touches storage, so the "empty" check below sees the shape the
  // row would end up in rather than the shape it is in right now.
  const nextLogoPath =
    watermarkData.removeLogo === "on"
      ? null
      : hasNewLogo
        ? storagePaths.eventWatermark(event.id, "logo.png")
        : event.watermarkLogoPath;

  // `applyWatermark` draws nothing at all when both are empty — text or a
  // logo is what it composites, and "on" with neither is a switch that does
  // nothing while looking, from the settings screen, like it did something.
  if (
    watermarkData.watermarkEnabled === "on" &&
    !watermarkData.watermarkText?.trim() &&
    !nextLogoPath
  ) {
    return { ok: false, error: "watermark_empty", values: echo };
  }

  let logo: Buffer | undefined;
  if (hasNewLogo) {
    try {
      logo = await buildWatermarkLogo(Buffer.from(await logoFile!.arrayBuffer()));
    } catch {
      return { ok: false, error: "logo_bad_format", values: echo };
    }
  }

  // Every rejection has already returned by this point — everything below
  // only writes.
  let coverPath = event.coverPath;
  if (cover) {
    coverPath = storagePaths.eventCover(event.id);
    try {
      await writeStorageFile(coverPath, cover);
    } catch (error) {
      console.warn("[pix-ku-csc] cover write failed:", error);
      return { ok: false, error: "unavailable", values: echo };
    }
  }

  if (watermarkData.removeLogo === "on") {
    if (event.watermarkLogoPath) await deleteStoragePath(event.watermarkLogoPath);
  } else if (logo) {
    await writeStorageFile(nextLogoPath!, logo);
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
        watermarkEnabled: watermarkData.watermarkEnabled === "on",
        watermarkText: watermarkData.watermarkText || null,
        watermarkLogoPath: nextLogoPath,
        watermarkPosition: watermarkData.watermarkPosition,
        watermarkOpacity: watermarkData.watermarkOpacity,
        watermarkScale: watermarkData.watermarkScale,
        updatedAt: new Date(),
      })
      .where(eq(events.id, event.id));
  } catch (error) {
    console.warn("[pix-ku-csc] event update failed:", error);
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
        "[pix-ku-csc] face collection not deleted for event",
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
          "[pix-ku-csc] face vectors not deleted for photos",
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

const RetryIndex = z.object({
  eventId: z.string().uuid(),
  photoId: z.string().uuid(),
});

/**
 * Re-runs Rekognition indexing for one photo whose first attempt failed —
 * the studio grid's "!" badge is the only way a photographer reaches this.
 *
 * Rebuilds the detection copy from the stored original rather than keeping
 * the one from upload time around: that copy exists only for the length of
 * the original request, and a photo can sit in `failed` indefinitely before
 * anyone notices and retries.
 *
 * Silently no-ops on anything that does not match — wrong owner, wrong event,
 * or a photo that is not actually `failed` — the same shape as `deletePhotos`
 * and for the same reason: a stale button in an already-open tab should do
 * nothing, not throw.
 */
export async function retryPhotoIndex(formData: FormData): Promise<void> {
  const { photographer } = await requireApprovedPhotographer();
  const parsed = RetryIndex.safeParse({
    eventId: formData.get("eventId"),
    photoId: formData.get("photoId"),
  });
  if (!parsed.success) return;
  const { eventId, photoId } = parsed.data;

  const [event] = await db
    .select({ id: events.id, faceCollectionId: events.faceCollectionId })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.ownerId, photographer.id)))
    .limit(1);
  if (!event) return;

  const [photo] = await db
    .select({ originalPath: photos.originalPath, indexStatus: photos.indexStatus })
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.eventId, eventId)))
    .limit(1);
  if (!photo || photo.indexStatus !== "failed") return;

  const original = await readStorageFile(photo.originalPath);
  const detection = await buildDetectionCopy(original);

  await indexPhotoFaces(eventId, photoId, detection, event.faceCollectionId);

  revalidatePath(`/studio/events/${eventId}`);
}
