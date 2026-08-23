import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { events, photoFaces, photos } from "@/db/schema";

import { collectionIdForEvent, faceProvider } from "./index";

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
 */
export async function indexPhotoFaces(
  eventId: string,
  photoId: string,
  detection: Buffer,
  existingCollectionId: string | null,
): Promise<void> {
  const collectionId = existingCollectionId ?? collectionIdForEvent(eventId);

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
  }
}
