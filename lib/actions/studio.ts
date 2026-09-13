"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";

import { db } from "@/db";
import { events, photoFaces, photos } from "@/db/schema";
import { ownedOrSharedEvents, requireApprovedPhotographer } from "@/lib/dal";
import { isPin } from "@/lib/event-pin";
import {
  ACCEPTED_MIME,
  buildCoverImage,
  buildWatermarkLogo,
  MAX_COVER_BYTES,
  MAX_WATERMARK_LOGO_BYTES,
} from "@/lib/images";
import { faceProvider } from "@/lib/face";
import { processPhoto } from "@/lib/face/pipeline";
import { deleteStoragePath, storagePaths, writeStorageFile } from "@/lib/storage";

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

/** Today's date in Bangkok, in the same `YYYY-MM-DD` shape `<input
 *  type="date">` gives — see the note on `EventInput.eventDate`. Used to
 *  fill in the date `createEvent` no longer asks for. */
function todayInBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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
   * at all — hence `.nullish()`. Stored as typed — see the note on
   * `entryPin` in `db/schema.ts`.
   */
  entryPin: z.string().nullish(),
  /**
   * Present only on the create form `/studio/affiliation` renders — hidden,
   * not a choice the photographer types. Never trusted at face value: it is
   * only ever honored below when it matches the caller's own
   * `photographer.affiliationId`, so a crafted request naming someone else's
   * affiliation cannot brand an event as shared work it never was.
   */
  affiliationId: z.string().uuid().nullish(),
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
    // Not a form field here — see the note on `EventForm`. Filled in with
    // today rather than left for the photographer to set later, since the
    // column is `NOT NULL` and this form has nothing else to put in it.
    eventDate: todayInBangkok(),
    isPrivate: formData.get("isPrivate"),
    entryPin: formData.get("entryPin"),
    affiliationId: formData.get("affiliationId"),
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
  // See the note on `EventInput.affiliationId` — only ever the caller's own.
  const affiliationId =
    data.affiliationId && data.affiliationId === photographer.affiliationId
      ? data.affiliationId
      : null;

  // A private event without a PIN is just an unlisted one, which is a URL
  // guess away from public. Refused rather than quietly downgraded.
  if (wantsPrivate && !isPin(data.entryPin ?? "")) {
    return { error: "pin_required", values: echo };
  }

  const entryPin = wantsPrivate ? data.entryPin! : null;

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
        entryPin,
        ownerId: photographer.id,
        affiliationId,
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
  if (affiliationId) revalidatePath("/studio/affiliation");
  redirect(`/studio/events/${created.id}`);
}

const EventInfoInput = z.object({
  nameTh: z.string().trim().min(2).max(160),
  nameEn: z.string().trim().max(160).nullish(),
  descriptionTh: z.string().trim().max(2000).nullish(),
  isPrivate: z.union([z.literal("on"), z.null(), z.undefined()]),
  /**
   * Six digits, or absent on a public event where the field is not rendered
   * at all — hence `.nullish()`. Stored as typed — see the note on
   * `entryPin` in `db/schema.ts`.
   */
  entryPin: z.string().nullish(),
});

export type EventInfoState =
  | { ok: true }
  | {
      ok: false;
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
 * Edits the fields a photographer thinks of as "who this event is" — name,
 * description, cover, and who can even see it — separately from
 * `updateEvent`'s download and watermark concerns. Split into its own
 * action (and its own form, see `EventInfoForm`) rather than folded back
 * into one button: unlike the download/watermark group, which really is one
 * decision about a *published* event's downloads, renaming an event,
 * swapping its cover, or flipping it private happens on its own, at a
 * different time, for a different reason, and gating it behind unrelated
 * fields just meant a stray watermark tweak could fail validation on a
 * field the photographer never touched.
 *
 * The PIN behaves the same way it always has: leaving it blank means "keep
 * the one already set," not "no PIN" — requiring a retype on every save
 * would force a new PIN every time somebody fixed a typo in the name.
 */
export async function updateEventInfo(
  _prev: EventInfoState,
  formData: FormData,
): Promise<EventInfoState> {
  const { photographer } = await requireApprovedPhotographer();

  const idResult = z.string().uuid().safeParse(formData.get("id"));
  if (!idResult.success) return { ok: false, error: "invalid" };

  // Ownership is part of the lookup, not a check on the result.
  const [event] = await db
    .select({
      id: events.id,
      coverPath: events.coverPath,
      isPrivate: events.isPrivate,
      entryPin: events.entryPin,
    })
    .from(events)
    .where(and(eq(events.id, idResult.data), ownedOrSharedEvents(photographer)))
    .limit(1);
  if (!event) return { ok: false, error: "invalid" };

  const raw = {
    nameTh: formData.get("nameTh"),
    nameEn: formData.get("nameEn"),
    descriptionTh: formData.get("descriptionTh"),
    isPrivate: formData.get("isPrivate"),
    entryPin: formData.get("entryPin"),
  };

  // The PIN is deliberately absent from the echo — see the note on the same
  // line in `createEvent`: a secret that lands back in the page source is no
  // longer a secret.
  const echo = Object.fromEntries(
    Object.entries(raw)
      .filter(([key]) => key !== "entryPin")
      .map(([key, value]) => [key, String(value ?? "")]),
  );

  const parsed = EventInfoInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid", values: echo };
  const data = parsed.data;
  const wantsPrivate = data.isPrivate === "on";

  let entryPin = event.entryPin;
  if (!wantsPrivate) {
    entryPin = null;
  } else if (data.entryPin) {
    // Any non-empty PIN field is an attempt to set or change it — refused
    // loudly if it is not six digits, rather than silently falling through
    // to "keep the old one," which would report success while doing
    // nothing a photographer who just typed a new PIN would expect.
    if (!isPin(data.entryPin)) {
      return { ok: false, error: "pin_required", values: echo };
    }
    entryPin = data.entryPin;
  } else if (!event.isPrivate) {
    // Turning a public event private with no PIN typed — refused rather
    // than quietly downgraded, same as on creation.
    return { ok: false, error: "pin_required", values: echo };
  }
  // else: already private and the PIN field was left blank — entryPin
  // stays, the same "leaving it blank keeps the one already set" behaviour
  // this has always had.

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
      console.warn("[pix-ku-csc] cover write failed:", error);
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
        coverPath,
        isPrivate: wantsPrivate,
        entryPin,
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
        | "logo_too_large"
        | "logo_bad_format"
        | "watermark_empty";
    }
  | undefined;

/**
 * Edits everything about an existing event that is not "who this event is":
 * the download toggle and the watermark, from one form and one save. These
 * read as one decision a photographer makes in one sitting — unlike the
 * name/description/cover/privacy in `updateEventInfo`, which get changed on
 * their own, at a different time, for a different reason.
 *
 * No `values` to echo back on failure: every field here is a controlled
 * input already showing exactly what was typed (see the note on the
 * component), so there is nothing a rejected submit could lose.
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

  // Ownership is part of the lookup, not a check on the result.
  const [event] = await db
    .select({ id: events.id, watermarkLogoPath: events.watermarkLogoPath })
    .from(events)
    .where(and(eq(events.id, idResult.data), ownedOrSharedEvents(photographer)))
    .limit(1);
  if (!event) return { ok: false, error: "invalid" };

  const watermarkParsed = WatermarkInput.safeParse({
    watermarkEnabled: formData.get("watermarkEnabled"),
    watermarkText: formData.get("watermarkText"),
    watermarkPosition: formData.get("watermarkPosition"),
    watermarkOpacity: formData.get("watermarkOpacity"),
    watermarkScale: formData.get("watermarkScale"),
    removeLogo: formData.get("removeLogo"),
  });
  if (!watermarkParsed.success) return { ok: false, error: "invalid" };
  const watermarkData = watermarkParsed.data;

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
    return { ok: false, error: "watermark_empty" };
  }

  let logo: Buffer | undefined;
  if (hasNewLogo) {
    try {
      logo = await buildWatermarkLogo(Buffer.from(await logoFile!.arrayBuffer()));
    } catch {
      return { ok: false, error: "logo_bad_format" };
    }
  }

  // Every rejection has already returned by this point — everything below
  // only writes.
  if (watermarkData.removeLogo === "on") {
    if (event.watermarkLogoPath) await deleteStoragePath(event.watermarkLogoPath);
  } else if (logo) {
    await writeStorageFile(nextLogoPath!, logo);
  }

  try {
    await db
      .update(events)
      .set({
        // A plain checkbox, not part of `WatermarkInput` — it has no
        // interplay with the other fields the way the watermark's own do.
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
    return { ok: false, error: "unavailable" };
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
  const parsed = EventId.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  const { id } = parsed.data;

  await db
    .update(events)
    .set({ status: "approved", updatedAt: new Date() })
    .where(
      and(
        eq(events.id, id),
        ownedOrSharedEvents(photographer),
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
  const parsed = EventId.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  const { id } = parsed.data;

  await db
    .update(events)
    .set({ status: "archived", updatedAt: new Date() })
    .where(
      and(
        eq(events.id, id),
        ownedOrSharedEvents(photographer),
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
  const parsed = EventId.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  const { id } = parsed.data;

  await db
    .update(events)
    .set({ status: "approved", updatedAt: new Date() })
    .where(
      and(
        eq(events.id, id),
        ownedOrSharedEvents(photographer),
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
  const parsed = Delete.safeParse({
    id: formData.get("id"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return;
  const { id, confirm } = parsed.data;

  // Ownership is part of the lookup, not a check on the result.
  const [event] = await db
    .select({
      id: events.id,
      accessCode: events.accessCode,
      faceCollectionId: events.faceCollectionId,
    })
    .from(events)
    .where(and(eq(events.id, id), ownedOrSharedEvents(photographer)))
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
    .where(and(eq(events.id, eventId), ownedOrSharedEvents(photographer)))
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

  // `previewPath`/`thumbPath` can still be null — a photo deleted moments
  // after upload, before `processPhoto` got to it in the background — so
  // there is nothing on disk yet at either path to clean up.
  await Promise.all(
    rows.flatMap((row) =>
      [row.originalPath, row.previewPath, row.thumbPath]
        .filter((p): p is string => p !== null)
        .map((p) => deleteStoragePath(p)),
    ),
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
 * Re-runs whatever a photo whose first attempt failed still needs — the
 * studio grid's "!" badge is the only way a photographer reaches this.
 *
 * `processPhoto` (lib/face/pipeline.ts) itself decides whether that means
 * rebuilding derivatives, just re-indexing, or both: a photo can land in
 * `failed` from either stage now that both run in the background after
 * upload, and this button does not need to know which one it was to fix it.
 * It always reads the original back off disk rather than being handed
 * anything from the request that failed — that request is long gone by the
 * time anyone notices the badge and clicks retry.
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
    .where(and(eq(events.id, eventId), ownedOrSharedEvents(photographer)))
    .limit(1);
  if (!event) return;

  const [photo] = await db
    .select({ indexStatus: photos.indexStatus })
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.eventId, eventId)))
    .limit(1);
  if (!photo || photo.indexStatus !== "failed") return;

  await processPhoto(eventId, photoId, event.faceCollectionId);

  revalidatePath(`/studio/events/${eventId}`);
}
