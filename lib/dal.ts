import "server-only";

import { eq, or, type SQL } from "drizzle-orm";
import type { Session } from "next-auth";
import { forbidden, unauthorized } from "next/navigation";
import { cache } from "react";

import { auth } from "@/auth";
import { db } from "@/db";
import { events, photographers, type Photographer, type UserRole } from "@/db/schema";

export type SessionUser = {
  id: string;
  role: UserRole;
  name: string | null;
  email: string | null;
  image: string | null;
};

/**
 * Every authorization check in the app funnels through here. `cache` dedupes
 * it within a render pass, so a page, its layout and three leaf components can
 * each call it without three round trips.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // `auth` is overloaded (route handler / middleware / bare call), so its
  // return type has to be named rather than inferred.
  let session: Session | null;

  try {
    session = await auth();
  } catch (error) {
    // Sessions live in Postgres. If it is unreachable we cannot prove anyone
    // is signed in, so everyone is treated as a signed-out visitor — the
    // header, footer and 404 page still render instead of the whole site
    // returning a 500 because the database blinked.
    console.warn("[pix-ku-csc] session lookup failed, treating as guest:", error);
    return null;
  }

  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    role: session.user.role,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) unauthorized();
  return user;
}

export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) forbidden();
  return user;
}

export const getPhotographer = cache(
  async (userId: string): Promise<Photographer | null> => {
    try {
      const rows = await db
        .select()
        .from(photographers)
        .where(eq(photographers.userId, userId))
        .limit(1);
      return rows[0] ?? null;
    } catch (error) {
      // Same reasoning as getSessionUser: unproven means not granted. Callers
      // that gate on an approved photographer will simply refuse access.
      console.warn("[pix-ku-csc] photographer lookup failed:", error);
      return null;
    }
  },
);

/**
 * Studio pages need an *approved* photographer, not just the photographer
 * role — an application that is still pending must not be able to create
 * events by guessing the URL.
 *
 * An admin reaches this the same way: `ensureAdminPhotographerProfile` gives
 * every admin an approved row the moment they become one (at sign-in for the
 * `ADMIN_EMAILS` bootstrap, at `setUserRole` for one promoted in the admin
 * console), so this never needs to special-case `user.role === "admin"`
 * itself — by the time anyone reaches this function, the row already
 * decides it.
 */
export async function requireApprovedPhotographer(): Promise<{
  user: SessionUser;
  photographer: Photographer;
}> {
  const user = await requireUser();
  const photographer = await getPhotographer(user.id);
  if (!photographer || photographer.status !== "approved") forbidden();
  return { user, photographer };
}

/**
 * True when this user may edit/administer the given event.
 *
 * Two ways in beyond admin: owning it outright, or sharing its
 * `affiliationId` — every member of an affiliation has full run of every
 * event any other member of the same affiliation created (see
 * `lib/actions/affiliations.ts`), which is the whole point of an
 * affiliation studio being a *shared* studio rather than a read-only
 * roster. `event.affiliationId` is only ever set on an event created from
 * that shared context (see `createEvent` in `lib/actions/studio.ts`), so a
 * photographer's own solo events never become reachable this way just
 * because they later join a group.
 */
export function canManageEvent(
  user: SessionUser,
  event: { ownerId: string; affiliationId: string | null },
  photographer: Photographer | null,
): boolean {
  if (user.role === "admin") return true;
  if (photographer?.id === event.ownerId) return true;
  return !!(
    photographer?.affiliationId &&
    event.affiliationId &&
    photographer.affiliationId === event.affiliationId
  );
}

/**
 * The SQL-level counterpart to `canManageEvent`, minus the admin case: a
 * condition on `events` matching every row this photographer may manage —
 * their own, plus every event created under an affiliation they belong to.
 * For a `where` clause selecting several such events, rather than a check on
 * one already fetched.
 */
export function ownedOrSharedEvents(photographer: Photographer): SQL {
  return photographer.affiliationId
    ? (or(
        eq(events.ownerId, photographer.id),
        eq(events.affiliationId, photographer.affiliationId),
      ) as SQL)
    : eq(events.ownerId, photographer.id);
}
