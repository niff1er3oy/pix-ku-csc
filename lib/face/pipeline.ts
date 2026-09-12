import "server-only";

import { and, eq, lt, or } from "drizzle-orm";

import { db } from "@/db";
import { events, photoFaces, photographers, photos } from "@/db/schema";
import { buildDerivatives, buildDetectionCopy } from "@/lib/images";
import { notifyPhotoIndexFailed } from "@/lib/notifications";
import { readStorageFile, storagePaths, writeStorageFile } from "@/lib/storage";

import { collectionIdForEvent, faceProvider } from "./index";

/**
 * How many `indexPhotoFaces` calls may be talking to Rekognition at once,
 * process-wide.
 *
 * This used to happen for free: the upload route `await`ed indexing before
 * responding, so the client's own `CONCURRENCY = 3` upload workers
 * (`components/studio/photo-uploader.tsx`) could never have more than 3
 * indexing calls in flight either — one per in-flight upload. Once the
 * upload route stopped awaiting it (see the `after()` call in
 * `app/api/studio/events/[id]/photos/route.ts`, added so a slow Rekognition
 * call could no longer make the upload response itself time out), uploads
 * started completing — and the next one starting — as fast as disk and sharp
 * allow, with no relationship left to how fast Rekognition was actually
 * keeping up. Nothing stopped the number of simultaneously in-flight
 * `IndexFaces` calls from growing past 3 during a large batch, which is
 * exactly the kind of burst that trips a Rekognition account's own TPS quota
 * and turns into a wave of `ThrottlingException`s the SDK's default retry
 * can't fully absorb. This restores the same ceiling the old, accidental
 * throttle provided — a deliberate one this time, and shared by every
 * caller (the upload route and the studio's own retry action) rather than a
 * property of just one of them.
 */
const MAX_CONCURRENT_INDEXING = 3;
let activeIndexing = 0;
const indexingQueue: (() => void)[] = [];

async function acquireIndexingSlot(): Promise<void> {
  if (activeIndexing < MAX_CONCURRENT_INDEXING) {
    activeIndexing++;
    return;
  }
  // Resolving this later *hands the same reserved slot over* — `activeIndexing`
  // is not decremented for the release that wakes this up (see
  // `releaseIndexingSlot`), so it must not be incremented again here either.
  // Doing both would open a window between a slot being freed and the next
  // waiter's `await` actually resuming (a microtask, not instant) where the
  // count briefly read as one lower than callers actually holding, letting a
  // caller that arrives in that exact window slip in as an unauthorized
  // fourth — a real, if narrow, way past the cap this exists to enforce.
  await new Promise<void>((resolve) => indexingQueue.push(resolve));
}

function releaseIndexingSlot(): void {
  // Handing the slot straight to the next waiter (not decrementing first)
  // is what closes the race described above: the slot is never "free" in
  // between, so nothing else can claim it out of turn.
  const next = indexingQueue.shift();
  if (next) next();
  else activeIndexing--;
}

/**
 * Indexes one photo's faces into its event's Rekognition collection.
 *
 * Shared by the upload route (first attempt) and the studio retry action
 * (after a failure) — both need the exact same collection-creation and
 * status-transition logic, and a fix here should not need making twice.
 *
 * The collection is created lazily on an event's first photo rather than when
 * the event itself is created, since `ensureCollection` costs an AWS call an
 * empty draft event has no reason to pay for. `faceCollectionId` is only
 * written to the event row after `ensureCollection` succeeds, so a failure
 * here leaves it null and the next attempt simply retries — no event is ever
 * left pointing at a collection that was never actually created.
 *
 * Queues behind `acquireIndexingSlot` before doing anything — including the
 * `indexStatus: "indexing"` transition below, so a photo waiting on a slot
 * still honestly reads as `pending` rather than claiming to be mid-call
 * before it is one.
 */
export async function indexPhotoFaces(
  eventId: string,
  photoId: string,
  detection: Buffer,
  existingCollectionId: string | null,
): Promise<void> {
  const collectionId = existingCollectionId ?? collectionIdForEvent(eventId);

  await acquireIndexingSlot();
  try {
    await db
      .update(photos)
      .set({ indexStatus: "indexing" })
      .where(eq(photos.id, photoId));

    if (!existingCollectionId) {
      await faceProvider.ensureCollection(collectionId);
      await db
        .update(events)
        .set({ faceCollectionId: collectionId })
        .where(eq(events.id, eventId));
    }

    const faces = await faceProvider.indexFaces(collectionId, detection, photoId);

    await db.transaction(async (tx) => {
      if (faces.length > 0) {
        await tx.insert(photoFaces).values(
          faces.map((face) => ({
            photoId,
            eventId,
            faceId: face.faceId,
            boundingBox: face.boundingBox,
            confidence: face.confidence,
          })),
        );
      }
      await tx
        .update(photos)
        .set({
          indexStatus: faces.length > 0 ? "indexed" : "no_face",
          faceCount: faces.length,
          indexError: null,
        })
        .where(eq(photos.id, photoId));
    });
  } catch (error) {
    console.error("[pix-ku-csc] face indexing failed for photo", photoId, error);
    await markFailed(photoId, error);
    await notifyOwnerOfFailure(eventId);
  } finally {
    releaseIndexingSlot();
  }
}

async function markFailed(photoId: string, error: unknown): Promise<void> {
  await db
    .update(photos)
    .set({
      indexStatus: "failed",
      indexError: error instanceof Error ? error.message.slice(0, 500) : "unknown error",
    })
    .where(eq(photos.id, photoId));
}

/**
 * Shared by both catch blocks in this file: whichever stage a photo failed
 * at — derivatives, in `processPhoto`, or the Rekognition call itself, in
 * `indexPhotoFaces` — the studio grid's "!" badge and retry button treat it
 * identically, so the owner hears about it the same way either time.
 *
 * Best-effort: a notification failure here should not turn an already-logged
 * processing failure into an unhandled rejection.
 */
async function notifyOwnerOfFailure(eventId: string): Promise<void> {
  try {
    const [owner] = await db
      .select({ userId: photographers.userId, eventName: events.nameTh })
      .from(events)
      .innerJoin(photographers, eq(events.ownerId, photographers.id))
      .where(eq(events.id, eventId))
      .limit(1);

    if (owner) {
      await notifyPhotoIndexFailed({
        userId: owner.userId,
        eventId,
        eventName: owner.eventName,
      });
    }
  } catch (notifyError) {
    console.error(
      "[pix-ku-csc] failed to notify owner of processing failure for event",
      eventId,
      notifyError,
    );
  }
}

/**
 * Same shape as `MAX_CONCURRENT_INDEXING`, for the same reason, but for a
 * different resource: `buildDerivatives` is CPU-bound decode-and-resize work
 * on *this* machine, not a network call to AWS, so nothing about it throttles
 * itself the way a rate-limited API does. Uploads used to gate this for free
 * too — each request `await`ed its own derivatives before the client's next
 * one started — until storing the original and responding immediately (see
 * `processPhoto` below) removed that gate along with the one
 * `MAX_CONCURRENT_INDEXING` restores for Rekognition. A burst of a few
 * hundred uploads landing in the same second must not mean a few hundred
 * concurrent sharp decodes competing for the same CPU and memory.
 */
const MAX_CONCURRENT_PROCESSING = 3;
let activeProcessing = 0;
const processingQueue: (() => void)[] = [];

async function acquireProcessingSlot(): Promise<void> {
  if (activeProcessing < MAX_CONCURRENT_PROCESSING) {
    activeProcessing++;
    return;
  }
  // Same slot-handoff reasoning as `acquireIndexingSlot` above.
  await new Promise<void>((resolve) => processingQueue.push(resolve));
}

function releaseProcessingSlot(): void {
  const next = processingQueue.shift();
  if (next) next();
  else activeProcessing--;
}

/**
 * Finishes whatever a photo still needs — derivatives, indexing, or both —
 * then indexes it. The one function both the upload route and the studio's
 * retry action call, so "retry" means the same thing regardless of which
 * half failed the first time.
 *
 * Checks `previewPath`/`thumbPath` rather than assuming the caller knows
 * which stage failed: the upload route always calls this on a brand new row
 * with neither set, while a retry after an indexing-only failure (Rekognition
 * threw, but the derivatives it needs already exist) has no reason to decode
 * and re-encode the same file again. A crash between the two stages is the
 * same case as the retry — this just finishes the part that never ran.
 *
 * `original` is the file's bytes, when the caller already has them in memory
 * (the upload route just read them off the wire). Omitted, this reads the
 * original back off disk instead — what a retry has to do, since its own
 * request body was a different, much smaller thing entirely.
 */
export async function processPhoto(
  eventId: string,
  photoId: string,
  existingCollectionId: string | null,
  original?: Buffer,
): Promise<void> {
  const [photo] = await db
    .select({
      originalPath: photos.originalPath,
      previewPath: photos.previewPath,
      thumbPath: photos.thumbPath,
    })
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);
  if (!photo) return;

  let detection: Buffer;

  if (!photo.previewPath || !photo.thumbPath) {
    await acquireProcessingSlot();
    try {
      const buffer = original ?? (await readStorageFile(photo.originalPath));
      const derived = await buildDerivatives(buffer);
      const previewPath = storagePaths.eventPreview(eventId, photoId);
      const thumbPath = storagePaths.eventThumb(eventId, photoId);

      await Promise.all([
        writeStorageFile(previewPath, derived.preview),
        writeStorageFile(thumbPath, derived.thumb),
      ]);
      await db
        .update(photos)
        .set({ previewPath, thumbPath })
        .where(eq(photos.id, photoId));

      detection = await buildDetectionCopy(buffer);
    } catch (error) {
      // Mirrors `indexPhotoFaces`'s own catch block above: a photo that
      // cannot even be decoded into derivatives is exactly as stuck as one
      // Rekognition refused, and the studio grid's "!" badge and retry
      // button already exist for that state — no reason to invent a second
      // one just because this failed a step earlier. Sharing `markFailed`/
      // `notifyOwnerOfFailure` with that catch block is what keeps the two
      // failures indistinguishable to the photographer, the way they should
      // be — neither is more or less "their" problem than the other.
      console.error(
        "[pix-ku-csc] derivative build failed for photo",
        photoId,
        error,
      );
      await markFailed(photoId, error);
      await notifyOwnerOfFailure(eventId);
      return;
    } finally {
      releaseProcessingSlot();
    }
  } else {
    const buffer = original ?? (await readStorageFile(photo.originalPath));
    detection = await buildDetectionCopy(buffer);
  }

  await indexPhotoFaces(eventId, photoId, detection, existingCollectionId);
}

/** How long a photo can plausibly still be mid-index before it is more
 *  likely that whatever was running it never got to finish. */
const STUCK_INDEXING_TIMEOUT_MS = 15 * 60_000;

/**
 * How long a photo can plausibly still be waiting for a concurrency slot
 * (see `acquireIndexingSlot`) before it is more likely that whatever was
 * meant to work through the queue is simply gone. Deliberately much longer
 * than `STUCK_INDEXING_TIMEOUT_MS`: `pending` is now the ordinary, expected
 * state of most of a large batch for a real stretch of time — 5,000 photos
 * at `MAX_CONCURRENT_INDEXING = 3` queues the tail of that batch for a
 * genuine while — so this has to sit comfortably above the slowest normal
 * batch this app is designed for (PRODUCT.md's own 5,000-photo events),
 * not just above one photo's own call.
 */
const STUCK_PENDING_TIMEOUT_MS = 3 * 60 * 60_000;

/**
 * Flips any photo stuck at `indexing`, or abandoned at `pending`, back to
 * `failed`, so the studio's existing retry button — built for the ordinary
 * failure case — can pick either up too.
 *
 * `indexPhotoFaces`'s own catch block, and `processPhoto`'s around it, only
 * ever run if the process calling them survives long enough to reach them. A
 * crash or restart between the status flipping to `indexing` and the
 * Rekognition call returning — or, now, between a photo being stored and
 * `processPhoto` ever starting on it at all — leaves the row exactly there,
 * forever, with no error recorded and no way back short of a hand-written
 * UPDATE. The same is true of a photo still waiting in `acquireIndexingSlot`
 * or `acquireProcessingSlot`'s in-memory queues: those queues, and the
 * `after()` callback holding a place in one of them, live only in this
 * process's memory, so a restart mid-batch drops them with nothing left to
 * ever call `processPhoto` for that photo again. There is no job queue behind
 * any of this yet — so this runs opportunistically wherever an event's
 * photos are read for its owner, rather than on a schedule.
 *
 * Scoped to `createdAt` rather than a dedicated "processing started at"
 * column: the upload route inserts the photo row and calls `processPhoto` in
 * the same request (via `after()`), so a photo's own creation time already
 * marks when its processing began (or, for a still-`pending` row, when it
 * started waiting).
 */
export async function sweepStuckIndexing(eventId: string): Promise<void> {
  const indexingSince = new Date(Date.now() - STUCK_INDEXING_TIMEOUT_MS);
  const pendingSince = new Date(Date.now() - STUCK_PENDING_TIMEOUT_MS);

  await db
    .update(photos)
    .set({
      indexStatus: "failed",
      indexError: "Indexing did not finish in time.",
    })
    .where(
      and(
        eq(photos.eventId, eventId),
        or(
          and(eq(photos.indexStatus, "indexing"), lt(photos.createdAt, indexingSince)),
          and(eq(photos.indexStatus, "pending"), lt(photos.createdAt, pendingSince)),
        ),
      ),
    );
}
