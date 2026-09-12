import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { affiliations, events, photographers, photos, users } from "@/db/schema";
import type { StudioEventListItem } from "@/lib/queries/studio";

export type AffiliationDetail = {
  id: string;
  name: string;
  /** Plain, not hashed — see the note on `affiliations.joinCode` in
   *  `db/schema.ts`. Shown back to members so they can hand it to someone
   *  new themselves, not just to the admin who first created it. */
  joinCode: string;
};

/** One affiliation, by id — the `/studio/affiliation` page's own group, once
 *  `photographer.affiliationId` says which one that is. */
export async function getAffiliationById(id: string): Promise<AffiliationDetail | null> {
  const [row] = await db
    .select({ id: affiliations.id, name: affiliations.name, joinCode: affiliations.joinCode })
    .from(affiliations)
    .where(eq(affiliations.id, id))
    .limit(1);
  return row ?? null;
}

export type AffiliationMember = {
  photographerId: string;
  userId: string;
  displayName: string;
  image: string | null;
};

/**
 * Every approved photographer sharing one affiliation — who can add or
 * remove whom on the `/studio/affiliation` page, and who a viewer sees
 * listed as its roster. Pending or rejected applicants never carry a real
 * `affiliationId` value that matters here in practice, but `approved` is
 * still checked explicitly rather than assumed, the same as everywhere
 * else a photographer's status gates what shows.
 */
export async function getAffiliationMembers(
  affiliationId: string,
): Promise<AffiliationMember[]> {
  return db
    .select({
      photographerId: photographers.id,
      userId: photographers.userId,
      displayName: photographers.displayName,
      image: users.image,
    })
    .from(photographers)
    .innerJoin(users, eq(photographers.userId, users.id))
    .where(
      and(eq(photographers.affiliationId, affiliationId), eq(photographers.status, "approved")),
    )
    .orderBy(asc(photographers.displayName));
}

export type AffiliationEventListItem = StudioEventListItem & {
  /** The photographer's own account — `/profile/[id]` links to this, not
   *  `photographers.id`, the same distinction `EventCard` draws in
   *  `lib/queries/public.ts`. */
  ownerUserId: string;
  ownerName: string;
  ownerImage: string | null;
};

/**
 * Every event created under one affiliation, newest first, each carrying who
 * actually shot it — the "งานของสังกัดจะบอกว่าใครเป็นคนถ่าย" requirement.
 * `ownerId` still names exactly one photographer even though every member can
 * manage the event afterward (see `canManageEvent` in `lib/dal.ts`), and that
 * is exactly the fact this list exists to show.
 */
export async function getAffiliationEvents(
  affiliationId: string,
): Promise<AffiliationEventListItem[]> {
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
      // Same coalesce-to-first-photo fallback as `getMyEvents` — see its own
      // note in `lib/queries/studio.ts`.
      coverThumbPath: sql<string | null>`coalesce(
        ${events.coverPath},
        (
          select ${photos.thumbPath} from ${photos}
          where photo.event_id = event.id
          order by ${photos.createdAt} asc
          limit 1
        )
      )`,
      ownerUserId: photographers.userId,
      ownerName: photographers.displayName,
      ownerImage: users.image,
    })
    .from(events)
    .innerJoin(photographers, eq(events.ownerId, photographers.id))
    .innerJoin(users, eq(photographers.userId, users.id))
    .where(eq(events.affiliationId, affiliationId))
    .orderBy(desc(events.eventDate));
}

export type AdminAffiliationRow = {
  id: string;
  name: string;
  joinCode: string;
  memberCount: number;
  createdAt: Date;
};

/** Every affiliation that exists, for the admin management page — newest
 *  first, so a code an admin just generated is the one at the top. */
export async function getAllAffiliations(): Promise<AdminAffiliationRow[]> {
  return db
    .select({
      id: affiliations.id,
      name: affiliations.name,
      joinCode: affiliations.joinCode,
      memberCount: sql<number>`count(${photographers.id}) filter (where ${photographers.status} = 'approved')::int`,
      createdAt: affiliations.createdAt,
    })
    .from(affiliations)
    .leftJoin(photographers, eq(photographers.affiliationId, affiliations.id))
    .groupBy(affiliations.id)
    .orderBy(desc(affiliations.createdAt));
}
