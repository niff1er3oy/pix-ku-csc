import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { events, photoFaces, photos, searches, searchMatches, users } from "@/db/schema";

export type StudioEvent = {
  id: string;
  nameTh: string;
  location: string | null;
  eventDate: string;
  status: "draft" | "pending" | "approved" | "rejected" | "archived";
  rejectionReason: string | null;
  isPrivate: boolean;
  accessCode: string;
  photoCount: number;
  /** Total faces indexed across every photo in the event — not just the page
   *  `getMyEventPhotos` caps at, so this is its own subquery rather than a
   *  sum over that already-limited list. */
  faceCount: number;
  /** Photos whose indexing has finished, one way or another — `indexed`,
   *  `no_face`, or `failed`. Against `photoCount`, this is what tells a
   *  photographer "Rekognition is still working through these" apart from
   *  "these are done, this is really how many faces there are." */
  processedCount: number;
  coverPath: string | null;
};

/** Same shape as `StudioEvent`, but for the list rather than one event's own
 *  detail page: `coverThumbPath` falls back to the first photo uploaded, so
 *  a draft with no cover chosen yet still shows *something* in the row
 *  instead of a blank square. `getMyEvent` deliberately does not do this —
 *  its page shows the cover the photographer actually picked, or nothing,
 *  never a stand-in they never chose. */
export type StudioEventListItem = Omit<
  StudioEvent,
  "coverPath" | "faceCount" | "processedCount"
> & {
  coverThumbPath: string | null;
};

/**
 * A photographer's own events, newest first.
 *
 * Scoped by `ownerId` in the query rather than filtered after the fact. There
 * is no version of this list that should ever contain somebody else's event,
 * so the restriction belongs where it cannot be forgotten.
 */
export async function getMyEvents(
  photographerId: string,
): Promise<StudioEventListItem[]> {
  return db
    .select({
      id: events.id,
      nameTh: events.nameTh,
      location: events.location,
      eventDate: events.eventDate,
      status: events.status,
      rejectionReason: events.rejectionReason,
      isPrivate: events.isPrivate,
      accessCode: events.accessCode,
      photoCount: events.photoCount,
      // The cover the photographer chose, falling back to the first photo
      // uploaded — see the identical coalesce in `lib/queries/public.ts`.
      // Most events in this list are still drafts with no cover set yet, and
      // a row of blank squares reads as broken rather than as pending.
      coverThumbPath: sql<string | null>`coalesce(
        ${events.coverPath},
        (
          select ${photos.thumbPath} from ${photos}
          where ${photos.eventId} = ${events.id}
          order by ${photos.createdAt} asc
          limit 1
        )
      )`,
    })
    .from(events)
    .where(eq(events.ownerId, photographerId))
    .orderBy(desc(events.eventDate));
}

/** One event, but only if it belongs to this photographer. */
export async function getMyEvent(
  photographerId: string,
  id: string,
): Promise<StudioEvent | null> {
  const rows = await db
    .select({
      id: events.id,
      nameTh: events.nameTh,
      location: events.location,
      eventDate: events.eventDate,
      status: events.status,
      rejectionReason: events.rejectionReason,
      isPrivate: events.isPrivate,
      accessCode: events.accessCode,
      photoCount: events.photoCount,
      // A correlated subquery rather than a join + group by: this is a
      // single-row lookup, and joining `photos` in would multiply this row
      // by its photo count only to collapse it straight back with an
      // aggregate. Cast to `::int` because Postgres `sum()` over an integer
      // column returns `bigint`, which the driver hands back as a string —
      // the cast is what keeps `faceCount` an actual number on this side.
      faceCount: sql<number>`coalesce((
        select sum(${photos.faceCount})::int from ${photos}
        where ${photos.eventId} = ${events.id}
      ), 0)`,
      // `count(*)` on Postgres already comes back as `bigint`/string too, so
      // this gets the same `::int` treatment as `faceCount` above.
      processedCount: sql<number>`coalesce((
        select count(*)::int from ${photos}
        where ${photos.eventId} = ${events.id}
        and ${photos.indexStatus} in ('indexed', 'no_face', 'failed')
      ), 0)`,
      coverPath: events.coverPath,
    })
    .from(events)
    // Ownership is part of the lookup, not a check performed on the result.
    // The id arrives from the URL, so a photographer who guesses another one
    // has to get nothing back — including that event's access code, which is
    // the only gate on an unlisted gallery. Filtering afterwards would mean
    // the row was fetched first, and the next person to add a `console.log`
    // would leak it.
    .where(and(eq(events.id, id), eq(events.ownerId, photographerId)))
    .limit(1);

  return rows[0] ?? null;
}

export type StudioEventSettings = {
  id: string;
  nameTh: string;
  nameEn: string | null;
  descriptionTh: string | null;
  location: string | null;
  eventDate: string;
  status: "draft" | "pending" | "approved" | "rejected" | "archived";
  isPrivate: boolean;
  /** The hash itself is never read back — see the note on `updateEvent`. */
  hasPin: boolean;
  accessCode: string;
  photoCount: number;
  coverPath: string | null;
  allowOriginalDownload: boolean;
  watermarkEnabled: boolean;
  watermarkText: string | null;
  watermarkLogoPath: string | null;
  watermarkPosition:
    | "bottom_right"
    | "bottom_left"
    | "top_right"
    | "top_left"
    | "center"
    | "tiled";
  watermarkOpacity: number;
  watermarkScale: number;
};

/** Everything the settings form needs to edit — a wider slice of the row than
 *  `getMyEvent`, which only ever renders the event back, never a form. */
export async function getMyEventSettings(
  photographerId: string,
  id: string,
): Promise<StudioEventSettings | null> {
  const rows = await db
    .select({
      id: events.id,
      nameTh: events.nameTh,
      nameEn: events.nameEn,
      descriptionTh: events.descriptionTh,
      location: events.location,
      eventDate: events.eventDate,
      status: events.status,
      isPrivate: events.isPrivate,
      entryPinHash: events.entryPinHash,
      accessCode: events.accessCode,
      photoCount: events.photoCount,
      coverPath: events.coverPath,
      allowOriginalDownload: events.allowOriginalDownload,
      watermarkEnabled: events.watermarkEnabled,
      watermarkText: events.watermarkText,
      watermarkLogoPath: events.watermarkLogoPath,
      watermarkPosition: events.watermarkPosition,
      watermarkOpacity: events.watermarkOpacity,
      watermarkScale: events.watermarkScale,
    })
    .from(events)
    .where(and(eq(events.id, id), eq(events.ownerId, photographerId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const { entryPinHash, ...rest } = row;
  return { ...rest, hasPin: entryPinHash !== null };
}

export type StudioPhoto = {
  id: string;
  thumbPath: string;
  previewPath: string;
  originalPath: string;
  originalFilename: string;
  indexStatus: "pending" | "indexing" | "indexed" | "no_face" | "failed";
  faceCount: number;
};

/**
 * The photographs in one of this photographer's events, newest first.
 *
 * Capped rather than unbounded: an event can hold thousands, and a studio page
 * that renders every one of them ships a megabyte of markup to say something
 * the count already said. Paging belongs here when the grid grows a pager.
 *
 * `faceId` narrows this to whichever photo that exact Rekognition face came
 * from. Since `photo_face.face_id` is unique — indexing never recognizes a
 * repeat appearance across photos, it mints a fresh id per detection — that
 * is always at most one photo, but the shape stays the same list either way,
 * so the grid below does not need a separate "single result" rendering path.
 *
 * `searchId` narrows this to every photo one specific search matched — one
 * search can hold several `search_match` rows (one per distinct face it hit),
 * so unlike `faceId` this can be many photos. The two are never passed
 * together by the page today, but nothing stops a caller combining them.
 */
export async function getMyEventPhotos(
  photographerId: string,
  eventId: string,
  options: { limit?: number; faceId?: string; searchId?: string } = {},
): Promise<StudioPhoto[]> {
  const { limit = 60, faceId, searchId } = options;

  return db
    .select({
      id: photos.id,
      thumbPath: photos.thumbPath,
      previewPath: photos.previewPath,
      originalPath: photos.originalPath,
      originalFilename: photos.originalFilename,
      indexStatus: photos.indexStatus,
      faceCount: photos.faceCount,
    })
    .from(photos)
    .innerJoin(events, eq(photos.eventId, events.id))
    .where(
      and(
        eq(photos.eventId, eventId),
        eq(events.ownerId, photographerId),
        faceId
          ? inArray(
              photos.id,
              db
                .select({ id: photoFaces.photoId })
                .from(photoFaces)
                .where(eq(photoFaces.faceId, faceId)),
            )
          : undefined,
        searchId
          ? inArray(
              photos.id,
              db
                .select({ id: photoFaces.photoId })
                .from(photoFaces)
                .innerJoin(
                  searchMatches,
                  eq(searchMatches.faceId, photoFaces.faceId),
                )
                .where(eq(searchMatches.searchId, searchId)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(photos.createdAt))
    .limit(limit);
}

export type StudioSearch = {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  mode: "saved_face" | "uploaded_selfie";
  matchCount: number;
  topSimilarity: number | null;
  createdAt: Date;
  faceIds: string[];
};

/**
 * Every search made against this event, most recent first, with the exact
 * face ids each one matched — see `search_match` in `db/schema.ts` for why
 * that lives in its own table rather than a column on `searches`.
 *
 * Anonymous searches keep a null `userId`/`userName`/`userEmail` rather than
 * being filtered out: a photographer asking "who searched this event" needs
 * the anonymous volume in the picture too, not just the signed-in slice —
 * the page renders those rows as "anonymous."
 */
export async function getMyEventSearches(
  photographerId: string,
  eventId: string,
  limit = 100,
): Promise<StudioSearch[]> {
  return db
    .select({
      id: searches.id,
      userId: searches.userId,
      userName: users.name,
      userEmail: users.email,
      mode: searches.mode,
      matchCount: searches.matchCount,
      topSimilarity: searches.topSimilarity,
      createdAt: searches.createdAt,
      // `filter (where ... is not null)` rather than a plain `array_agg`: a
      // search with zero matches still has one row here after the left join
      // (the search itself, with every `searchMatches` column null), and an
      // unfiltered agg would turn that into `{null}` instead of `{}`.
      faceIds: sql<string[]>`coalesce(
        array_agg(${searchMatches.faceId}) filter (where ${searchMatches.faceId} is not null),
        '{}'
      )`,
    })
    .from(searches)
    .innerJoin(events, eq(searches.eventId, events.id))
    .leftJoin(users, eq(searches.userId, users.id))
    .leftJoin(searchMatches, eq(searchMatches.searchId, searches.id))
    .where(
      and(eq(searches.eventId, eventId), eq(events.ownerId, photographerId)),
    )
    .groupBy(searches.id, users.name, users.email)
    .orderBy(desc(searches.createdAt))
    .limit(limit);
}
