import "server-only";

import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { events, photoFaces, photographers, photos, users } from "@/db/schema";

export type EventCard = {
  id: string;
  accessCode: string;
  nameTh: string;
  nameEn: string | null;
  location: string | null;
  eventDate: string;
  photoCount: number;
  photographerName: string;
  /** The photographer's own account — `/profile/[id]` links to this, not
   *  `photographers.id`, since that route looks visitors up by `users.id`. */
  photographerUserId: string;
  photographerImage: string | null;
  coverThumbPath: string | null;
};

/**
 * Unlisted events are excluded everywhere a list is rendered — they are
 * reachable only by someone holding the link or the printed QR.
 *
 * `query`, when given, matches against either name column — a visitor
 * searching rarely knows which language the photographer typed the event
 * in, so both are checked rather than whichever `locale` happens to be
 * active.
 */
export async function getPublicEvents(
  limit = 12,
  query?: string,
): Promise<EventCard[]> {
  const rows = await db
    .select({
      id: events.id,
      accessCode: events.accessCode,
      nameTh: events.nameTh,
      nameEn: events.nameEn,
      location: events.location,
      eventDate: events.eventDate,
      photoCount: events.photoCount,
      photographerName: photographers.displayName,
      photographerUserId: photographers.userId,
      photographerImage: users.image,
      /**
       * The cover the photographer chose, falling back to the first photo
       * uploaded.
       *
       * `coalesce` rather than two fields and a decision in the component: the
       * card only ever renders one image, so which one it is belongs in the
       * query. The fallback exists because a cover is optional and an event
       * card with a blank rectangle reads as broken rather than as pending.
       */
      // Correlation written as literal `photo.event_id = event.id` rather
      // than interpolated columns — see the note in `getMyEvent` in
      // `lib/queries/studio.ts` for why the interpolated form silently never
      // matched a row.
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
    .innerJoin(photographers, eq(events.ownerId, photographers.id))
    .innerJoin(users, eq(photographers.userId, users.id))
    .where(
      and(
        eq(events.status, "approved"),
        eq(events.isPrivate, false),
        query
          ? or(ilike(events.nameTh, `%${query}%`), ilike(events.nameEn, `%${query}%`))
          : undefined,
      ),
    )
    .orderBy(desc(events.eventDate))
    .limit(limit);

  return rows;
}

/**
 * One photographer's own public work, for the portfolio section
 * `/profile/[id]` shows on an approved photographer's page.
 *
 * Same `approved` + not-`isPrivate` filter as `getPublicEvents`, and for the
 * same reason: a private event is reachable only by whoever holds its link
 * and PIN, never by browsing — least of all from a page anyone signed in can
 * open. A draft or rejected event never went live at all, so neither belongs
 * on a page meant to show what this photographer has actually shot.
 */
export async function getPhotographerPortfolio(
  photographerUserId: string,
  limit = 24,
): Promise<EventCard[]> {
  const rows = await db
    .select({
      id: events.id,
      accessCode: events.accessCode,
      nameTh: events.nameTh,
      nameEn: events.nameEn,
      location: events.location,
      eventDate: events.eventDate,
      photoCount: events.photoCount,
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
    })
    .from(events)
    .innerJoin(photographers, eq(events.ownerId, photographers.id))
    .innerJoin(users, eq(photographers.userId, users.id))
    .where(
      and(
        eq(photographers.userId, photographerUserId),
        eq(events.status, "approved"),
        eq(events.isPrivate, false),
      ),
    )
    .orderBy(desc(events.eventDate))
    .limit(limit);

  return rows;
}

/**
 * Faces found across one photographer's public work — the stat
 * `/profile/[id]`'s portfolio bar shows beside the event and photo counts,
 * which `getPhotographerPortfolio`'s own rows already carry (a plain sum of
 * `photoCount`, no query of its own needed).
 *
 * Same `approved` + not-`isPrivate` scope as `getPhotographerPortfolio` —
 * deliberately, not incidentally: summing every event regardless of privacy
 * would let a private event's face count leak through this total even while
 * the event itself stays off the page, which is exactly the kind of
 * side-channel `isPrivate` exists to close.
 */
export async function getPhotographerFaceCount(
  photographerUserId: string,
): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${photos.faceCount}), 0)` })
    .from(photos)
    .innerJoin(events, eq(photos.eventId, events.id))
    .innerJoin(photographers, eq(events.ownerId, photographers.id))
    .where(
      and(
        eq(photographers.userId, photographerUserId),
        eq(events.status, "approved"),
        eq(events.isPrivate, false),
      ),
    );

  return Number(row?.total ?? 0);
}

/** Thumbnails for the hero mosaic, newest first across every public event. */
export async function getHeroThumbs(limit = 24): Promise<string[]> {
  const rows = await db
    .select({ thumbPath: photos.thumbPath })
    .from(photos)
    .innerJoin(events, eq(photos.eventId, events.id))
    .where(and(eq(events.status, "approved"), eq(events.isPrivate, false)))
    .orderBy(desc(photos.createdAt))
    .limit(limit);

  return rows.map((r) => r.thumbPath);
}

export type SiteStats = {
  events: number;
  photos: number;
  faces: number;
};

export async function getSiteStats(): Promise<SiteStats> {
  const [eventRow] = await db
    .select({ value: count() })
    .from(events)
    .where(eq(events.status, "approved"));

  const [photoRow] = await db
    .select({ value: count() })
    .from(photos)
    .innerJoin(events, eq(photos.eventId, events.id))
    .where(eq(events.status, "approved"));

  const [faceRow] = await db
    .select({ value: count() })
    .from(photoFaces)
    .innerJoin(events, eq(photoFaces.eventId, events.id))
    .where(eq(events.status, "approved"));

  return {
    events: eventRow?.value ?? 0,
    photos: photoRow?.value ?? 0,
    faces: faceRow?.value ?? 0,
  };
}

/**
 * The landing page renders before anyone has run a migration or started
 * Postgres. Rather than crash the first `npm run dev`, fall back to an empty
 * site — the page is designed to read correctly with zero events.
 */
export async function safely<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.warn("[pix-ku-csc] query failed, using fallback:", error);
    return fallback;
  }
}
