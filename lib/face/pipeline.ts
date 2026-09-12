import "server-only";

import { and, eq, lt, or } from "drizzle-orm";

import { db } from "@/db";
import { events, photoFaces, photographers, photos } from "@/db/schema";
import { notifyPhotoIndexFailed } from "@/lib/notifications";

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
    await db
      .update(photos)
      .set({
        indexStatus: "failed",
        indexError: error instanceof Error ? error.message.slice(0, 500) : "unknown error",
      })
      .where(eq(photos.id, photoId));

    // Best-effort: a notification failure here should not turn an already-
    // logged indexing failure into an unhandled rejection.
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
        "[pix-ku-csc] failed to notify owner of index failure for event",
        eventId,
        notifyError,
      );
    }
  } finally {
    releaseIndexingSlot();
  }
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
 * `indexPhotoFaces`'s own catch block only ever runs if the process calling
 * it survives long enough to reach it. A crash or restart between the status
 * flipping to `indexing` and the Rekognition call returning leaves the row
 * exactly there, forever, with no error recorded and no way back short of a
 * hand-written UPDATE — the same is true of a photo still waiting in
 * `acquireIndexingSlot`'s in-memory queue: that queue, and the `after()`
 * callback holding a place in it, live only in this process's memory, so a
 * restart mid-batch drops them with nothing left to ever call
 * `indexPhotoFaces` for that photo again. There is no job queue behind
 * indexing yet — see the note on `indexPhotoFaces` — so this runs
 * opportunistically wherever an event's photos are read for its owner,
 * rather than on a schedule.
 *
 * Scoped to `createdAt` rather than a dedicated "indexing started at" column:
 * the upload route inserts the photo row and calls `indexPhotoFaces` in the
 * same request, so a photo's own creation time already marks when its
 * indexing began (or, for a still-`pending` row, when it started waiting).
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
