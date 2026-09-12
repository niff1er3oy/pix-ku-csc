import "server-only";

import { and, desc, eq, getTableName, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  downloads,
  events,
  photoFaces,
  photos,
  searches,
  searchMatches,
  users,
  type Photographer,
} from "@/db/schema";
import { ownedOrSharedEvents } from "@/lib/dal";

export type StudioEvent = {
  id: string;
  nameTh: string;
  location: string | null;
  eventDate: string;
  /** When the event row itself was created — distinct from `eventDate`,
   *  which is the day the event happened and is set by the photographer, not
   *  by the system. */
  createdAt: Date;
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
  /** Of `processedCount`, the ones that ended in `failed` rather than
   *  `indexed`/`no_face` — broken out so the studio page can flag "something
   *  needs a retry" without a photographer scrolling the whole grid looking
   *  for "!" badges. */
  failedCount: number;
  /** How many times any photo in this event has been downloaded — every
   *  `download` row is a real request for a full-resolution file, joined
   *  through `photo` since `download` itself has no `event_id` of its own. */
  downloadCount: number;
  /** Every search run against this event, not just the ones
   *  `getMyEventSearches` lists — that query caps at 100, so this is its own
   *  count rather than a length read off that already-limited array. */
  searchCount: number;
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
  | "coverPath"
  | "faceCount"
  | "processedCount"
  | "failedCount"
  | "createdAt"
  | "downloadCount"
  | "searchCount"
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
          where photo.event_id = event.id
          order by ${photos.createdAt} asc
          limit 1
        )
      )`,
    })
    .from(events)
    .where(eq(events.ownerId, photographerId))
    .orderBy(desc(events.eventDate));
}

/** One event, but only if this photographer may manage it — their own, or
 *  one shared through an affiliation both belong to (see
 *  `ownedOrSharedEvents` in `lib/dal.ts`). */
export async function getMyEvent(
  photographer: Photographer,
  id: string,
): Promise<StudioEvent | null> {
  // `${events.id}` inside a `sql` fragment renders as a bare `"id"`, not
  // `"event"."id"` — Drizzle does not know this fragment lands inside a
  // subquery correlated against a *different* table. That is harmless when
  // the inner table has no column of its own called `id`, but `photo` does
  // (its own primary key), so Postgres resolved the bare `"id"` to the
  // subquery's *own* `photo.id` instead of reaching out to `event.id`. Every
  // row then compared its own id against its `event_id` — never equal — so
  // both subqueries silently matched nothing and `coalesce(..., 0)` always
  // won. `qEventId` forces the qualification Postgres actually needs.
  const qEventId = sql.raw(`"${getTableName(events)}"."id"`);

  const rows = await db
    .select({
      id: events.id,
      nameTh: events.nameTh,
      location: events.location,
      eventDate: events.eventDate,
      createdAt: events.createdAt,
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
      //
      // The correlation is written as the literal `photo.event_id = event.id`
      // rather than `${photos.eventId} = ${events.id}` — interpolating a
      // `Column` into a `sql` template renders its bare name, not
      // table-qualified, so the interpolated form silently compiled to
      // `where event_id = id`, which Postgres resolved entirely inside the
      // subquery's own `photo` table (it has its own `id`) and never touched
      // the outer row. Every count below came back 0 regardless of the real
      // count. Literal text is what `getDirectory`'s `eventCount` already
      // does for the same reason.
      faceCount: sql<number>`coalesce((
        select sum(${photos.faceCount})::int from ${photos}
        where ${photos.eventId} = ${qEventId}
      ), 0)`,
      // `count(*)` on Postgres already comes back as `bigint`/string too, so
      // this gets the same `::int` treatment as `faceCount` above.
      processedCount: sql<number>`coalesce((
        select count(*)::int from ${photos}
        where ${photos.eventId} = ${qEventId}
        and ${photos.indexStatus} in ('indexed', 'no_face', 'failed')
      ), 0)`,
      failedCount: sql<number>`coalesce((
        select count(*)::int from ${photos}
        where ${photos.eventId} = ${qEventId}
        and ${photos.indexStatus} = 'failed'
      ), 0)`,
      // `download` has no `event_id` of its own — filtered by photo id
      // through a plain `in`, not a join, for the same reason `qEventId`
      // exists at all: a join would put `download` and `photo` in the same
      // scope, and both have their own `id` column, so an unqualified `id`
      // in the join condition would be ambiguous (or worse, silently wrong)
      // the same way the bare `${events.id}` above used to be.
      downloadCount: sql<number>`coalesce((
        select count(*)::int from ${downloads}
        where ${downloads.photoId} in (
          select id from ${photos} where ${photos.eventId} = ${qEventId}
        )
      ), 0)`,
      // `search.event_id` references `event` directly, so this needs no
      // join and no `in` — just the same `qEventId` correlation as above.
      searchCount: sql<number>`coalesce((
        select count(*)::int from ${searches}
        where ${searches.eventId} = ${qEventId}
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
    .where(and(eq(events.id, id), ownedOrSharedEvents(photographer)))
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
  /** Stored in the clear, so the settings form can show it back — see the
   *  note on `entryPin` in `db/schema.ts`. Null on a public event. */
  entryPin: string | null;
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
  photographer: Photographer,
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
      entryPin: events.entryPin,
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
    .where(and(eq(events.id, id), ownedOrSharedEvents(photographer)))
    .limit(1);

  return rows[0] ?? null;
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
 * the count already said. The studio page raises `limit` in steps of 20 via
 * its own "show more" link (a `?show=` search param, refetching this same
 * query at a higher limit) rather than tracking an offset — simpler than
 * real cursor pagination, and correct enough for a list that only grows by
 * upload, never by insertion in the middle.
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
 *
 * `downloaderId` narrows this to every photo one specific person has
 * downloaded from this event — a plain `downloads.userId` match, unlike the
 * face-based filters above. `null` (as opposed to simply omitting it) asks
 * for the anonymous slice instead — every download with no `userId` at all,
 * which is the only grouping `getMyEventDownloaders` can offer for visitors
 * who never signed in.
 */
export async function getMyEventPhotos(
  photographer: Photographer,
  eventId: string,
  options: {
    limit?: number;
    faceId?: string;
    searchId?: string;
    downloaderId?: string | null;
  } = {},
): Promise<StudioPhoto[]> {
  const { limit = 20, faceId, searchId, downloaderId } = options;

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
        ownedOrSharedEvents(photographer),
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
        downloaderId !== undefined
          ? inArray(
              photos.id,
              db
                .select({ id: downloads.photoId })
                .from(downloads)
                .where(
                  downloaderId === null
                    ? isNull(downloads.userId)
                    : eq(downloads.userId, downloaderId),
                ),
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
  userImage: string | null;
  userRole: "user" | "photographer" | "admin" | null;
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
  photographer: Photographer,
  eventId: string,
  limit = 100,
): Promise<StudioSearch[]> {
  return db
    .select({
      id: searches.id,
      userId: searches.userId,
      userName: users.name,
      userEmail: users.email,
      userImage: users.image,
      userRole: users.role,
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
      and(eq(searches.eventId, eventId), ownedOrSharedEvents(photographer)),
    )
    .groupBy(searches.id, users.name, users.email, users.image, users.role)
    .orderBy(desc(searches.createdAt))
    .limit(limit);
}

export type StudioDownloader = {
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
  userRole: "user" | "photographer" | "admin" | null;
  downloadCount: number;
  lastDownloadAt: Date;
};

/**
 * Who has downloaded from this event, one row per downloader rather than one
 * per download — unlike a search, a single visit to "download selected"
 * writes one `downloads` row *per photo*, so listing those raw would turn one
 * click into fifty near-identical rows. Grouped by `userId` instead, which
 * also does the right thing for anonymous downloads on its own: `downloads`
 * carries no per-request identifier the way `searches.ipHash` does, so every
 * anonymous download already shares the same (null) key and lands in one
 * "anonymous" row rather than needing to be collapsed by hand.
 */
export async function getMyEventDownloaders(
  photographer: Photographer,
  eventId: string,
  limit = 100,
): Promise<StudioDownloader[]> {
  return db
    .select({
      userId: downloads.userId,
      userName: users.name,
      userEmail: users.email,
      userImage: users.image,
      userRole: users.role,
      downloadCount: sql<number>`count(*)::int`,
      lastDownloadAt: sql<Date>`max(${downloads.createdAt})`,
    })
    .from(downloads)
    .innerJoin(photos, eq(downloads.photoId, photos.id))
    .innerJoin(events, eq(photos.eventId, events.id))
    .leftJoin(users, eq(downloads.userId, users.id))
    .where(and(eq(photos.eventId, eventId), ownedOrSharedEvents(photographer)))
    .groupBy(downloads.userId, users.name, users.email, users.image, users.role)
    .orderBy(desc(sql`max(${downloads.createdAt})`))
    .limit(limit);
}

