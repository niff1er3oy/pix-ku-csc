import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { affiliations, events, photographers, photos, users } from "@/db/schema";
import type { EventCard } from "@/lib/queries/public";
import type { StudioEventListItem } from "@/lib/queries/studio";

export type AffiliationDetail = {
  id: string;
  name: string;
  /** Plain, not hashed — see the note on `affiliations.joinCode` in
   *  `db/schema.ts`. Shown back to members so they can hand it to someone
   *  new themselves, not just to the admin who first created it. */
  joinCode: string;
  imagePath: string | null;
};

/** One affiliation, by id — the `/studio/affiliation` page's own group, once
 *  `photographer.affiliationId` says which one that is. */
export async function getAffiliationById(id: string): Promise<AffiliationDetail | null> {
  const [row] = await db
    .select({
      id: affiliations.id,
      name: affiliations.name,
      joinCode: affiliations.joinCode,
      imagePath: affiliations.imagePath,
    })
    .from(affiliations)
    .where(eq(affiliations.id, id))
    .limit(1);
  return row ?? null;
}

export type PublicAffiliation = {
  id: string;
  name: string;
  imagePath: string | null;
  createdAt: Date;
};

/**
 * The same lookup as `getAffiliationById`, minus `joinCode` — for
 * `/affiliations/[id]`, the page anyone can open with no session at all.
 * A separate query rather than the studio one with the field left unused:
 * the code that opens an affiliation's shared studio to a new member should
 * never even pass through a code path a public page's server component
 * touches, let alone rely on nobody accidentally rendering it later.
 */
export async function getPublicAffiliation(id: string): Promise<PublicAffiliation | null> {
  const [row] = await db
    .select({
      id: affiliations.id,
      name: affiliations.name,
      imagePath: affiliations.imagePath,
      createdAt: affiliations.createdAt,
    })
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
  imagePath: string | null;
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
      imagePath: affiliations.imagePath,
      memberCount: sql<number>`count(${photographers.id}) filter (where ${photographers.status} = 'approved')::int`,
      createdAt: affiliations.createdAt,
    })
    .from(affiliations)
    .leftJoin(photographers, eq(photographers.affiliationId, affiliations.id))
    .groupBy(affiliations.id)
    .orderBy(desc(affiliations.createdAt));
}

/**
 * One affiliation's published work, for the public detail page any visitor
 * reaches from `/affiliations` — the same `EventCard` shape (and the same
 * `approved` + not-`isPrivate` scope) `getPhotographerPortfolio` returns for
 * a single photographer's own page, so `PortfolioGrid`/`EventCard` render it
 * identically, "ถ่ายโดย …" line and all. Unlike that function this has no
 * `includePrivate` escape hatch: there is no signed-in owner or admin
 * exception on a page reachable with no session at all, so a private event
 * can never surface here regardless of who is looking.
 */
export async function getAffiliationPortfolio(
  affiliationId: string,
  limit = 24,
): Promise<EventCard[]> {
  return db
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
      isPrivate: events.isPrivate,
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
        eq(events.affiliationId, affiliationId),
        eq(events.status, "approved"),
        eq(events.isPrivate, false),
      ),
    )
    .orderBy(desc(events.eventDate))
    .limit(limit);
}

/**
 * Faces found across every published event an affiliation's members have
 * shot under it — the same public-only scope as `getAffiliationPortfolio`,
 * for the same reason `getPhotographerFaceCount` has no way around it
 * either: nothing here ever runs for a signed-in owner or an admin, only for
 * whoever happens to open the page.
 */
export async function getAffiliationFaceCount(affiliationId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${photos.faceCount}), 0)` })
    .from(photos)
    .innerJoin(events, eq(photos.eventId, events.id))
    .where(
      and(
        eq(events.affiliationId, affiliationId),
        eq(events.status, "approved"),
        eq(events.isPrivate, false),
      ),
    );

  return Number(row?.total ?? 0);
}
