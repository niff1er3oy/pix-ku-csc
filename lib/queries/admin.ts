import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { events, photographers } from "@/db/schema";

export type PendingPhotographer = {
  id: string;
  displayName: string;
  affiliation: string | null;
  contactEmail: string | null;
  bio: string | null;
  createdAt: Date;
};

/**
 * Oldest first. A review queue sorted newest-first quietly starves whoever has
 * been waiting longest, which on a campus service is the person who applied
 * before an event they are already committed to shooting.
 */
export async function getPendingPhotographers(): Promise<PendingPhotographer[]> {
  return db
    .select({
      id: photographers.id,
      displayName: photographers.displayName,
      affiliation: photographers.affiliation,
      contactEmail: photographers.contactEmail,
      bio: photographers.bio,
      createdAt: photographers.createdAt,
    })
    .from(photographers)
    .where(eq(photographers.status, "pending"))
    .orderBy(asc(photographers.createdAt));
}

export type PendingEvent = {
  id: string;
  slug: string;
  nameTh: string;
  descriptionTh: string | null;
  location: string | null;
  startsAt: Date;
  ownerName: string;
};

export async function getPendingEvents(): Promise<PendingEvent[]> {
  return db
    .select({
      id: events.id,
      slug: events.slug,
      nameTh: events.nameTh,
      descriptionTh: events.descriptionTh,
      location: events.location,
      startsAt: events.startsAt,
      ownerName: photographers.displayName,
    })
    .from(events)
    .innerJoin(photographers, eq(events.ownerId, photographers.id))
    .where(eq(events.status, "pending"))
    .orderBy(asc(events.createdAt));
}
