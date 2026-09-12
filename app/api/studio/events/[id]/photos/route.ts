import { and, eq, sql } from "drizzle-orm";
import path from "node:path";
import { after } from "next/server";

import { db } from "@/db";
import { events, photos } from "@/db/schema";
import { ownedOrSharedEvents, requireApprovedPhotographer } from "@/lib/dal";
import { processPhoto } from "@/lib/face/pipeline";
import {
  ACCEPTED_MIME,
  MAX_UPLOAD_BYTES,
  readImageMeta,
} from "@/lib/images";
import {
  newId,
  sha256,
  storagePaths,
  writeStorageFile,
} from "@/lib/storage";

export type UploadResult =
  | { ok: true; id: string; duplicate: boolean }
  | { ok: false; reason: UploadFailure };

export type UploadFailure =
  | "too_large"
  | "bad_format"
  | "unreadable"
  | "no_file"
  | "not_found"
  | "server";

/**
 * One photograph per request.
 *
 * A route handler rather than a Server Action, and one file per call rather
 * than a batch, for reasons that only show up at real volume:
 *
 *  - a Server Action posts the whole form as one body, so a thousand photos
 *    would be one multi-gigabyte request with no progress and nothing to
 *    resume;
 *  - one file per request means a failure costs that file, not the batch, and
 *    the client can retry it alone;
 *  - the browser reports upload progress per request, which is the only way
 *    the photographer sees anything move.
 *
 * The client sends these a few at a time — see `PhotoUploader`.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/studio/events/[id]/photos">,
) {
  const { photographer, user } = await requireApprovedPhotographer();
  const { id } = await ctx.params;

  // Ownership is part of the lookup. The id comes from the URL, so a
  // photographer who guesses somebody else's must not be able to write into
  // their event.
  const [event] = await db
    .select({ id: events.id, faceCollectionId: events.faceCollectionId })
    .from(events)
    .where(and(eq(events.id, id), ownedOrSharedEvents(photographer)))
    .limit(1);

  if (!event) return json({ ok: false, reason: "not_found" }, 404);

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return json({ ok: false, reason: "no_file" }, 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return json({ ok: false, reason: "too_large" }, 413);
  }
  if (!ACCEPTED_MIME.includes(file.type as (typeof ACCEPTED_MIME)[number])) {
    return json({ ok: false, reason: "bad_format" }, 415);
  }

  const original = Buffer.from(await file.arrayBuffer());
  const checksum = sha256(original);

  // Re-uploading the same file is a no-op, not a second row. A photographer
  // whose connection dropped halfway through 400 photos will start again from
  // the top of the folder, and `photo_event_checksum_idx` is what makes that
  // cost nothing instead of doubling the event.
  const [existing] = await db
    .select({ id: photos.id })
    .from(photos)
    .where(and(eq(photos.eventId, id), eq(photos.checksum, checksum)))
    .limit(1);

  if (existing) {
    return json({ ok: true, id: existing.id, duplicate: true });
  }

  let meta;
  try {
    // Header only — no resize, no encode. `buildDerivatives` and
    // `buildDetectionCopy`, the actually expensive part of turning this into
    // a gallery entry, run later in the background (see the `after()` call
    // below); this is only enough to satisfy `width`/`height`, which are
    // `NOT NULL` from the moment the row exists.
    meta = await readImageMeta(original);
  } catch {
    // A file the browser called an image and sharp cannot decode: a truncated
    // download, a renamed document, a camera format sharp does not read.
    return json({ ok: false, reason: "unreadable" }, 422);
  }

  const photoId = newId();
  const ext = path.extname(file.name).toLowerCase() || ".jpg";
  const originalPath = storagePaths.eventOriginal(id, photoId, ext);

  try {
    // File first, row second — same reasoning as before, just for one file
    // instead of three: a row pointing at a file that was never written is
    // permanently broken, and a written file with no row is invisible and
    // gets cleaned up.
    await writeStorageFile(originalPath, original);

    await db.transaction(async (tx) => {
      await tx.insert(photos).values({
        id: photoId,
        eventId: id,
        uploadedBy: user.id,
        originalFilename: file.name.slice(0, 255),
        originalPath,
        // Null until `processPhoto` builds them in the background — see the
        // note on `photos.previewPath` in db/schema.ts.
        previewPath: null,
        thumbPath: null,
        width: meta.width,
        height: meta.height,
        bytes: original.length,
        capturedAt: meta.capturedAt,
        checksum,
        indexStatus: "pending",
      });

      // Counted in SQL rather than read-then-write: several uploads land at
      // once, and `count = count + 1` is the only version of this that does
      // not lose one when two finish in the same millisecond.
      await tx
        .update(events)
        .set({ photoCount: sql`${events.photoCount} + 1` })
        .where(eq(events.id, id));
    });
  } catch (error) {
    console.warn("[pix-ku-csc] photo upload failed:", error);
    return json({ ok: false, reason: "server" }, 500);
  }

  // The photo is already saved and visible in the gallery (as a "processing"
  // placeholder — see `photos.previewPath`) at this point, so a problem in
  // any of this becomes a "!" badge on that row, not a failed upload — the
  // photographer keeps the file either way. Scheduled with `after()` rather
  // than awaited: `processPhoto` never rejects (its own try/catch, and
  // `indexPhotoFaces`'s beneath it, swallow every failure into a "failed"
  // status row on `photos`), so there is nothing here for an `await` to
  // usefully wait for except sharp's and Rekognition's own latency — and
  // awaiting it held this response, and this upload's concurrency slot in
  // `PhotoUploader`, open for however long that took. That was the actual
  // cost behind a large batch feeling slow: every request used to sit through
  // its own decode-resize-encode of three separate outputs before the next
  // file in the same slot could even start uploading. Passing `original`
  // through directly means this background call re-decodes the same buffer
  // already sitting in memory rather than reading it back off disk.
  // `after()` (not a bare un-awaited call) is what keeps this safe if this
  // ever moves off a persistent Node server: it is the platform's own
  // supported way to run work after a response ships, and it hooks into
  // `waitUntil` on platforms that need it instead of racing the runtime
  // tearing the request context down.
  after(() => processPhoto(id, photoId, event.faceCollectionId, original));

  return json({ ok: true, id: photoId, duplicate: false });
}

function json(body: UploadResult, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
