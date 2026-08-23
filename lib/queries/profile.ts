import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { userFaces } from "@/db/schema";

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
