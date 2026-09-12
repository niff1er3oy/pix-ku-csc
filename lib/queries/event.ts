import "server-only";

import { and, asc, count, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  affiliations,
  downloads,
  events,
  photoFaces,
  photographers,
  photos,
  savedPhotos,
  users,
  type Event,
} from "@/db/schema";

export type EventWithOwner = Event & {
  photographerName: string;
  /** The photographer's own account — `/profile/[id]` links to this, not
   *  `photographers.id`, since that route looks visitors up by `users.id`. */
  photographerUserId: string;
  photographerImage: string | null;
  /** The cover the photographer chose, falling back to the first photo
   *  uploaded — same coalesce as every list card (`EventCard`, the studio
   *  lists) uses, so the one page a QR code actually lands on is not the
   *  one place on the whole site that never shows it. Null only for an
   *  event with no cover set and nothing uploaded yet. */
  coverThumbPath: string | null;
  /** Set only when this event was created from an affiliation's shared
   *  studio — `/e/[code]` credits the affiliation instead of the individual
   *  photographer when these are present, the same rule `EventCard` follows
   *  (see the note on `EventCard` in `lib/queries/public.ts`). */
  affiliationId: string | null;
  affiliationName: string | null;
  affiliationImage: string | null;
};

export async function getEventBySlug(
  code: string,
): Promise<EventWithOwner | null> {
  const [row] = await db
    .select({
      event: events,
      photographerName: photographers.displayName,
      photographerUserId: photographers.userId,
      photographerImage: users.image,
      coverThumbPath: sql<string | null>`coalesce(
        ${events.coverPath},
        (
          select ${photos.thumbPath} from ${photos}
          where photo.event_id = event.id
          order by ${photos.createdAt} asc
          limit 1
        )
      )`,
      affiliationName: affiliations.name,
      affiliationImage: affiliations.imagePath,
    })
    .from(events)
    .innerJoin(photographers, eq(events.ownerId, photographers.id))
    .innerJoin(users, eq(photographers.userId, users.id))
    .leftJoin(affiliations, eq(events.affiliationId, affiliations.id))
    // Upper-cased on both sides: a code typed into the address bar or
    // read off a printed sign arrives in whatever case the keyboard felt
    // like. The alphabet has no lower-case members, so folding case cannot
    // merge two different codes.
    .where(sql`upper(${events.accessCode}) = upper(${code})`)
    .limit(1);

  if (!row) return null;
  return {
    ...row.event,
    photographerName: row.photographerName,
    photographerUserId: row.photographerUserId,
    photographerImage: row.photographerImage,
    coverThumbPath: row.coverThumbPath,
    affiliationId: row.event.affiliationId,
    affiliationName: row.affiliationName,
    affiliationImage: row.affiliationImage,
  };
}

export type EventStats = {
  faceCount: number;
  downloadCount: number;
  saveCount: number;
};

/**
 * Faces found, downloads made, and photos saved — across this one event,
 * for the public page's own chip row. Three separate counts rather than one
 * joined query: `photo_face` already carries its own `event_id`, but
 * `download`/`saved_photo` only reference `photo_id`, so joining all three
 * against `events` in one query would fan every row out against every other
 * table's rows for the same event — cheap to get subtly wrong, not cheap to
 * notice, on an event with thousands of each.
 */
export async function getEventStats(eventId: string): Promise<EventStats> {
  const [[faceRow], [downloadRow], [saveRow]] = await Promise.all([
    db
      .select({ value: count() })
      .from(photoFaces)
      .where(eq(photoFaces.eventId, eventId)),
    db
      .select({ value: count() })
      .from(downloads)
      .innerJoin(photos, eq(downloads.photoId, photos.id))
      .where(eq(photos.eventId, eventId)),
    db
      .select({ value: count() })
      .from(savedPhotos)
      .innerJoin(photos, eq(savedPhotos.photoId, photos.id))
      .where(eq(photos.eventId, eventId)),
  ]);

  return {
    faceCount: faceRow?.value ?? 0,
    downloadCount: downloadRow?.value ?? 0,
    saveCount: saveRow?.value ?? 0,
  };
}

export type EventPhoto = {
  id: string;
  /** Null until `processPhoto` builds them in the background — see the note
   *  on `photos.previewPath` in db/schema.ts. A freshly uploaded photo is
   *  visible here (this query does not filter by `indexStatus`) before its
   *  derivatives exist. */
  thumbPath: string | null;
  previewPath: string | null;
  originalPath: string;
  width: number;
  height: number;
  faceCount: number;
};

/**
 * Offset pagination, deliberately. An event holds 1,000-5,000 photos, so the
 * gallery can never render in one pass — and plain page links keep browsing
 * working without JavaScript, which matters on venue wifi.
 *
 * `photos.id` is a third, always-unique sort key — not decoration. Without
 * it, two photos that tie on both `capturedAt` (often null; EXIF is not
 * guaranteed) and `createdAt` (identical to the millisecond for a batch
 * upload) have no defined order between them, and Postgres is free to place
 * a tied row on either side of a page boundary on different executions of
 * this same query. The gallery's own `viewTransitionName` is built from
 * `photo.id`, so a row landing on both page 1 and page 2 that way surfaces
 * as two `<ViewTransition>` components sharing one name — not a rendering
 * bug, a pagination stability bug wearing a React error.
 */
export async function getEventPhotos(
  eventId: string,
  page: number,
  pageSize: number,
): Promise<{ photos: EventPhoto[]; total: number; pageCount: number }> {
  const [[totalRow], rows] = await Promise.all([
    db
      .select({ value: count() })
      .from(photos)
      .where(eq(photos.eventId, eventId)),
    db
      .select({
        id: photos.id,
        thumbPath: photos.thumbPath,
        previewPath: photos.previewPath,
        originalPath: photos.originalPath,
        width: photos.width,
        height: photos.height,
        faceCount: photos.faceCount,
      })
      .from(photos)
      .where(eq(photos.eventId, eventId))
      .orderBy(asc(photos.capturedAt), asc(photos.createdAt), asc(photos.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  const total = totalRow?.value ?? 0;
  return {
    photos: rows,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** How many photos are still waiting on Rekognition for this event. */
export async function getPendingIndexCount(eventId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(photos)
    .where(
      and(
        eq(photos.eventId, eventId),
        ne(photos.indexStatus, "indexed"),
        ne(photos.indexStatus, "no_face"),
        ne(photos.indexStatus, "failed"),
      ),
    );
  return row?.value ?? 0;
}
