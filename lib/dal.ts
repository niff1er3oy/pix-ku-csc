import "server-only";

import { eq } from "drizzle-orm";
import type { Session } from "next-auth";
import { forbidden, unauthorized } from "next/navigation";
import { cache } from "react";

import { auth } from "@/auth";
import { db } from "@/db";
import { photographers, type Photographer, type UserRole } from "@/db/schema";

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
    console.warn("[find-ku-dae] session lookup failed, treating as guest:", error);
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
      console.warn("[find-ku-dae] photographer lookup failed:", error);
      return null;
    }
  },
);

/**
 * Studio pages need an *approved* photographer, not just the photographer
 * role — an application that is still pending must not be able to create
 * events by guessing the URL.
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

/** True when this user may edit/administer the given event. */
export function canManageEvent(
  user: SessionUser,
  event: { ownerId: string },
  photographer: Photographer | null,
): boolean {
  if (user.role === "admin") return true;
  return photographer?.id === event.ownerId;
}
