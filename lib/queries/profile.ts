import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { userFaces, users, type UserRole } from "@/db/schema";

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
