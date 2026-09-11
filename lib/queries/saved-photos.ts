import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { events, photos, profileHiddenEvents, savedPhotos } from "@/db/schema";

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
  /** The saving event's own setting, as of now — not as of when the photo
   *  was saved. A photographer can turn downloads off after the fact, and
   *  `/api/media` is the actual enforcement either way; this is just what
   *  lets the list show a working download link instead of a 403 waiting
   *  to happen. */
  allowOriginalDownload: boolean;
};

export type SavedPhotosGroup = {
  eventId: string;
  eventNameTh: string;
  eventNameEn: string | null;
  eventAccessCode: string;
  allowOriginalDownload: boolean;
  /** Whether this user has opted to hide this event's group from
   *  `/profile/[id]` — see `profileHiddenEvents` in `db/schema.ts` for why
   *  absence, not presence, is what "visible" means. */
  hidden: boolean;
  photos: {
    id: string;
    photoId: string;
    thumbPath: string;
    previewPath: string;
    originalPath: string;
    savedAt: Date;
  }[];
};

/**
 * Everything a visitor has saved, grouped by the event it came from and
 * ordered by that group's most recently saved photo — `/profile/[id]`'s own
 * reason to exist: seeing them again, organized by the event they belong
 * to, without re-running a search or scattering across each event's own
 * results.
 *
 * A private event's photos never appear here at all, regardless of any
 * per-event visibility choice — that rule isn't a preference either side
 * can override, so it is a `where` clause, not a `hidden` flag the caller
 * has to remember to also check.
 */
export async function getMySavedPhotosGroupedByEvent(
  userId: string,
): Promise<SavedPhotosGroup[]> {
  const rows = await db
    .select({
      id: savedPhotos.id,
      photoId: photos.id,
      thumbPath: photos.thumbPath,
      previewPath: photos.previewPath,
      originalPath: photos.originalPath,
      savedAt: savedPhotos.createdAt,
      eventId: events.id,
      eventNameTh: events.nameTh,
      eventNameEn: events.nameEn,
      eventAccessCode: events.accessCode,
      allowOriginalDownload: events.allowOriginalDownload,
      // Present only when this user has hidden this event — see the
      // `leftJoin` below. Its id is never read, only whether it is null.
      hiddenRowId: profileHiddenEvents.id,
    })
    .from(savedPhotos)
    .innerJoin(photos, eq(savedPhotos.photoId, photos.id))
    .innerJoin(events, eq(photos.eventId, events.id))
    .leftJoin(
      profileHiddenEvents,
      and(
        eq(profileHiddenEvents.userId, savedPhotos.userId),
        eq(profileHiddenEvents.eventId, events.id),
      ),
    )
    .where(and(eq(savedPhotos.userId, userId), eq(events.isPrivate, false)))
    .orderBy(desc(savedPhotos.createdAt));

  // One pass, in `savedAt desc` order — a group is created the moment its
  // first (so newest) photo is seen, which is what puts events with the
  // most recent activity first without a separate sort afterward.
  const groups = new Map<string, SavedPhotosGroup>();
  for (const row of rows) {
    let group = groups.get(row.eventId);
    if (!group) {
      group = {
        eventId: row.eventId,
        eventNameTh: row.eventNameTh,
        eventNameEn: row.eventNameEn,
        eventAccessCode: row.eventAccessCode,
        allowOriginalDownload: row.allowOriginalDownload,
        hidden: row.hiddenRowId !== null,
        photos: [],
      };
      groups.set(row.eventId, group);
    }
    group.photos.push({
      id: row.id,
      photoId: row.photoId,
      thumbPath: row.thumbPath,
      previewPath: row.previewPath,
      originalPath: row.originalPath,
      savedAt: row.savedAt,
    });
  }

  return [...groups.values()];
}

/**
 * The same list, narrowed to one event — for showing a visitor's saved
 * photos right on that event's own page, without a trip to `/profile/[id]`
 * for something they searched for a minute ago.
 */
export async function getMySavedPhotosForEvent(
  userId: string,
  eventId: string,
): Promise<SavedPhoto[]> {
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
      allowOriginalDownload: events.allowOriginalDownload,
    })
    .from(savedPhotos)
    .innerJoin(photos, eq(savedPhotos.photoId, photos.id))
    .innerJoin(events, eq(photos.eventId, events.id))
    .where(and(eq(savedPhotos.userId, userId), eq(photos.eventId, eventId)))
    .orderBy(desc(savedPhotos.createdAt));

  return rows;
}
