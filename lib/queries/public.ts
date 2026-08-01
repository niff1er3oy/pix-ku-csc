import "server-only";

import { and, count, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { events, photoFaces, photographers, photos } from "@/db/schema";

export type EventCard = {
  id: string;
  slug: string;
  nameTh: string;
  nameEn: string | null;
  location: string | null;
  startsAt: Date;
  photoCount: number;
  photographerName: string;
  coverThumbPath: string | null;
};

/**
 * Unlisted events are excluded everywhere a list is rendered — they are
 * reachable only by someone holding the link or the printed QR.
 */
export async function getPublicEvents(limit = 12): Promise<EventCard[]> {
  const rows = await db
    .select({
      id: events.id,
      slug: events.slug,
      nameTh: events.nameTh,
      nameEn: events.nameEn,
      location: events.location,
      startsAt: events.startsAt,
      photoCount: events.photoCount,
      photographerName: photographers.displayName,
      coverThumbPath: sql<string | null>`(
        select ${photos.thumbPath} from ${photos}
        where ${photos.eventId} = ${events.id}
        order by ${photos.createdAt} asc
        limit 1
      )`,
    })
    .from(events)
    .innerJoin(photographers, eq(events.ownerId, photographers.id))
    .where(and(eq(events.status, "approved"), eq(events.isUnlisted, false)))
    .orderBy(desc(events.startsAt))
    .limit(limit);

  return rows;
}

/** Thumbnails for the hero mosaic, newest first across every public event. */
export async function getHeroThumbs(limit = 24): Promise<string[]> {
  const rows = await db
    .select({ thumbPath: photos.thumbPath })
    .from(photos)
    .innerJoin(events, eq(photos.eventId, events.id))
    .where(and(eq(events.status, "approved"), eq(events.isUnlisted, false)))
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
    console.warn("[find-ku-dae] query failed, using fallback:", error);
    return fallback;
  }
}
