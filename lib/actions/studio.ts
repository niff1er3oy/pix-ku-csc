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
import { storagePaths, writeStorageFile } from "@/lib/storage";

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

const EventInput = z.object({
  nameTh: z.string().trim().min(2).max(160),
  nameEn: z.string().trim().max(160).optional(),
  descriptionTh: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(160).optional(),
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
  /** Six digits, or empty on a public event. Hashed before it is stored. */
  entryPin: z.string().optional(),
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
 * submits it and an admin approves. The finder, the event page and
 * /api/media all refuse anything that is not `approved`, so photographs
 * uploaded into a fresh event are not reachable by anyone but their owner in
 * the meantime.
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
 * Hands a draft to the admins.
 *
 * Scoped to the caller's own events by the `where` clause rather than by
 * having checked on the page that rendered the button — a server action is a
 * public endpoint, and the id in the form is whatever the caller sent.
 */
export async function submitEventForReview(formData: FormData) {
  const { photographer } = await requireApprovedPhotographer();
  const { id } = Submit.parse({ id: formData.get("id") });

  await db
    .update(events)
    .set({ status: "pending", updatedAt: new Date() })
    .where(
      and(
        eq(events.id, id),
        eq(events.ownerId, photographer.id),
        eq(events.status, "draft"),
      ),
    );

  revalidatePath("/studio");
  revalidatePath(`/studio/events/${id}`);
  revalidatePath("/admin");
}
