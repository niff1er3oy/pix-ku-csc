import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { events, photos, savedPhotos } from "@/db/schema";

/**
 * Which of these photo ids this user has already saved — built for one
 * search result set, not the visitor's whole saved list, so the caller can
 * mark each match's bookmark as already-saved without a round trip per
 * photo. Empty when the id list is empty, since `inArray` on nothing would
 * otherwise be a query worth skipping.
 */
export async function getSavedPhotoIds(
  userId: string,
  photoIds: string[],
): Promise<Set<string>> {
  if (photoIds.length === 0) return new Set();

  const rows = await db
    .select({ photoId: savedPhotos.photoId })
    .from(savedPhotos)
    .where(
      and(eq(savedPhotos.userId, userId), inArray(savedPhotos.photoId, photoIds)),
    );

  return new Set(rows.map((row) => row.photoId));
}

export type SavedPhoto = {
  id: string;
  photoId: string;
  thumbPath: string;
  previewPath: string;
  originalPath: string;
  eventNameTh: string;
  eventAccessCode: string;
  savedAt: Date;
};

/**
 * Everything a visitor has saved, newest first, across every event — this is
 * the whole point of saving: seeing them again without re-running a search,
 * on `/me` rather than scattered across each event's own results.
 */
export async function getMySavedPhotos(userId: string): Promise<SavedPhoto[]> {
  const rows = await db
    .select({
      id: savedPhotos.id,
      photoId: photos.id,
      thumbPath: photos.thumbPath,
      previewPath: photos.previewPath,
      originalPath: photos.originalPath,
      eventNameTh: events.nameTh,
      eventAccessCode: events.accessCode,
      savedAt: savedPhotos.createdAt,
    })
    .from(savedPhotos)
    .innerJoin(photos, eq(savedPhotos.photoId, photos.id))
    .innerJoin(events, eq(photos.eventId, events.id))
    .where(eq(savedPhotos.userId, userId))
    .orderBy(desc(savedPhotos.createdAt));

  return rows;
}
