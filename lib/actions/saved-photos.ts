"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { events, photos, savedPhotos } from "@/db/schema";
import { requireUser } from "@/lib/dal";

/**
 * Saves one or more photos to the caller's own list — scoped by more than
 * the id: a photo only saves if it belongs to an event that is actually
 * `approved`, the same visibility rule the public gallery and search
 * results already enforce, so this cannot become a way to confirm a private
 * or still-pending event's photo ids exist by guessing UUIDs.
 *
 * `onConflictDoNothing` rather than a "does this already exist" check
 * first — the unique index on `(userId, photoId)` makes saving an
 * already-saved photo a harmless no-op instead of a race between two tabs.
 */
export async function savePhotos(photoIds: string[]): Promise<void> {
  const user = await requireUser();
  if (photoIds.length === 0) return;

  const visible = await db
    .select({ id: photos.id })
    .from(photos)
    .innerJoin(events, eq(photos.eventId, events.id))
    .where(and(inArray(photos.id, photoIds), eq(events.status, "approved")));
  if (visible.length === 0) return;

  await db
    .insert(savedPhotos)
    .values(visible.map((row) => ({ userId: user.id, photoId: row.id })))
    .onConflictDoNothing();

  revalidatePath("/me");
}

/**
 * Removes one or more photos from the caller's own saved list. Scoped to
 * `userId` in the `where` clause rather than trusting the caller's own
 * account context alone — the ids in the request are whatever the client
 * sent, same reasoning as `deletePhotos` in the studio.
 */
export async function unsavePhotos(photoIds: string[]): Promise<void> {
  const user = await requireUser();
  if (photoIds.length === 0) return;

  await db
    .delete(savedPhotos)
    .where(
      and(eq(savedPhotos.userId, user.id), inArray(savedPhotos.photoId, photoIds)),
    );

  revalidatePath("/me");
}
