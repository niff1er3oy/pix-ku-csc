import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { events, photos } from "@/db/schema";

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
  coverPath: string | null;
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
): Promise<StudioEvent[]> {
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
      coverPath: events.coverPath,
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
 */
export async function getMyEventPhotos(
  photographerId: string,
  eventId: string,
  limit = 60,
): Promise<StudioPhoto[]> {
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
      and(eq(photos.eventId, eventId), eq(events.ownerId, photographerId)),
    )
    .orderBy(desc(photos.createdAt))
    .limit(limit);
}
