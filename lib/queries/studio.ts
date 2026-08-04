import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { events } from "@/db/schema";

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
