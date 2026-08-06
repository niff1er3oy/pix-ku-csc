"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";

import { db } from "@/db";
import { events } from "@/db/schema";
import { requireApprovedPhotographer } from "@/lib/dal";
import { hashPin, isPin } from "@/lib/event-pin";
import {
  ACCEPTED_MIME,
  buildCoverImage,
  MAX_COVER_BYTES,
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

const Submit = z.object({ id: z.string().uuid() });

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
  const { id } = Submit.parse({ id: formData.get("id") });

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
