import "server-only";

import { and, asc, count, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { events, photographers, photos, type Event } from "@/db/schema";

export type EventWithOwner = Event & { photographerName: string };

export async function getEventBySlug(
  code: string,
): Promise<EventWithOwner | null> {
  const [row] = await db
    .select({
      event: events,
      photographerName: photographers.displayName,
    })
    .from(events)
    .innerJoin(photographers, eq(events.ownerId, photographers.id))
    // Upper-cased on both sides: a code typed into the address bar or
    // read off a printed sign arrives in whatever case the keyboard felt
    // like. The alphabet has no lower-case members, so folding case cannot
    // merge two different codes.
    .where(sql`upper(${events.accessCode}) = upper(${code})`)
    .limit(1);

  if (!row) return null;
  return { ...row.event, photographerName: row.photographerName };
}

export type EventPhoto = {
  id: string;
  thumbPath: string;
  previewPath: string;
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
