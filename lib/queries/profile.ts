import "server-only";

import { and, count, countDistinct, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  affiliations,
  downloads,
  events,
  photographers,
  photos,
  searches,
  userFaces,
  users,
  type UserRole,
} from "@/db/schema";

export type MyFace = {
  imagePath: string;
  createdAt: Date;
};

/** A user has at most one saved face — see `saveFace` in `lib/actions/profile.ts`. */
export async function getMyFace(userId: string): Promise<MyFace | null> {
  const [row] = await db
    .select({ imagePath: userFaces.imagePath, createdAt: userFaces.createdAt })
    .from(userFaces)
    .where(eq(userFaces.userId, userId))
    .limit(1);
  return row ?? null;
}

export type PublicProfile = {
  id: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  createdAt: Date;
};

/**
 * The identity `/profile/[id]` shows any signed-in visitor — name, avatar,
 * role, join date. Deliberately thin: no email, no saved face, nothing
 * `/me` itself doesn't already hand to a viewer who is that account.
 */
export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

export type PublicPhotographerInfo = {
  displayName: string;
  bio: string | null;
  affiliationId: string | null;
  affiliationName: string | null;
};

/**
 * The photographer-specific fields `/profile/[id]` adds on top of
 * `getPublicProfile` when that account's role is `photographer` — a bio and
 * who they shoot for, the two fields a photographer fills in that actually
 * mean something to someone reading their portfolio. `contactEmail` and
 * `contactPhone` stay out on purpose: those exist for an admin verifying an
 * application, not as a public "get in touch" surface this page never
 * offered before.
 *
 * `users.role` only ever reads `photographer` once an admin has approved
 * them (see `approvePhotographer`/`rejectPhotographer` in
 * `lib/actions/admin.ts`), so a caller that already checked the role can
 * trust this row to exist without checking `status` again here.
 */
export async function getPhotographerProfileInfo(
  userId: string,
): Promise<PublicPhotographerInfo | null> {
  const [row] = await db
    .select({
      displayName: photographers.displayName,
      bio: photographers.bio,
      affiliationId: photographers.affiliationId,
      affiliationName: affiliations.name,
    })
    .from(photographers)
    .leftJoin(affiliations, eq(photographers.affiliationId, affiliations.id))
    .where(eq(photographers.userId, userId))
    .limit(1);
  return row ?? null;
}

/**
 * How many photos this account has downloaded — any account, not just a
 * photographer's. Scoped to non-private events for the same reason the
 * portfolio stats are: a private event's download would otherwise surface
 * in this total with nothing on the page to explain where it came from,
 * which is exactly the kind of side channel `isPrivate` exists to close.
 */
export async function getDownloadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(downloads)
    .innerJoin(photos, eq(downloads.photoId, photos.id))
    .innerJoin(events, eq(photos.eventId, events.id))
    .where(and(eq(downloads.userId, userId), eq(events.isPrivate, false)));
  return row?.value ?? 0;
}

/**
 * How many distinct events this account has actually searched at —
 * "participated in," for a page with no other record of a visitor's own
 * attendance. `searches` rather than `downloads` or saved photos: it is the
 * one action that means "I was here and looked," on record the moment a
 * search runs rather than only if it found something worth keeping.
 *
 * Same not-private scope as `getDownloadCount`, and the same reason.
 */
export async function getEventParticipationCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: countDistinct(searches.eventId) })
    .from(searches)
    .innerJoin(events, eq(searches.eventId, events.id))
    .where(and(eq(searches.userId, userId), eq(events.isPrivate, false)));
  return row?.value ?? 0;
}
