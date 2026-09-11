"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { consents, profileHiddenEvents, userFaces } from "@/db/schema";
import { requireUser } from "@/lib/dal";
import { assertSingleFace, FaceError } from "@/lib/face";
import { ACCEPTED_MIME, buildDetectionCopy, MAX_SELFIE_BYTES } from "@/lib/images";
import { deleteStoragePath, newId, storagePaths, writeStorageFile } from "@/lib/storage";

export type SaveFaceState =
  | {
      error:
        | "no_file"
        | "too_large"
        | "bad_format"
        | "no_face"
        | "many_faces"
        | "server";
    }
  | { ok: true }
  | undefined;

/** Matches the version `app/api/events/[id]/search/route.ts` records for the
 *  one-off scan consent — this is the same policy text, a different type. */
const CONSENT_VERSION = "2026-07-01";

/**
 * Saves (or replaces) the signed-in user's reference selfie, so the
 * "search with my saved face" button in `FaceSearchPanel` — wired to
 * `useSavedFace` in the search route since that route shipped — finally has
 * something to read.
 *
 * A user has at most one saved face: `getMyFace` only ever reads one row, so
 * saving again replaces it rather than accumulating rows nothing would ever
 * show. Storing a selfie indefinitely is a different permission than the
 * one-off scan `search/route.ts` already records — PRODUCT.md's
 * `biometric_storage` consent type exists for exactly that distinction — so
 * it is logged here rather than assumed from a search that may never happen.
 */
export async function saveFace(
  _prev: SaveFaceState,
  formData: FormData,
): Promise<SaveFaceState> {
  const user = await requireUser();

  const file = formData.get("selfie");
  if (!(file instanceof File) || file.size === 0) return { error: "no_file" };
  if (file.size > MAX_SELFIE_BYTES) return { error: "too_large" };
  if (!ACCEPTED_MIME.includes(file.type as (typeof ACCEPTED_MIME)[number])) {
    return { error: "bad_format" };
  }

  let detection: Buffer;
  try {
    detection = await buildDetectionCopy(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { error: "bad_format" };
  }

  let quality: { brightness: number | null; sharpness: number | null };
  try {
    quality = await assertSingleFace(detection);
  } catch (error) {
    if (error instanceof FaceError && error.code === "no_face") {
      return { error: "no_face" };
    }
    if (error instanceof FaceError && error.code === "many_faces") {
      return { error: "many_faces" };
    }
    console.error("[pix-ku-csc] saveFace detection failed:", error);
    return { error: "server" };
  }

  const [existing] = await db
    .select({ imagePath: userFaces.imagePath })
    .from(userFaces)
    .where(eq(userFaces.userId, user.id))
    .limit(1);

  const imagePath = storagePaths.userFace(user.id, newId());

  try {
    // File first, rows second — the same ordering as the photo upload route,
    // and for the same reason: a row pointing at a file that was never
    // written is a broken saved-face forever, a written file with no row is
    // just an orphan.
    await writeStorageFile(imagePath, detection);

    await db.transaction(async (tx) => {
      if (existing) await tx.delete(userFaces).where(eq(userFaces.userId, user.id));
      await tx.insert(userFaces).values({
        userId: user.id,
        imagePath,
        quality:
          quality.brightness != null && quality.sharpness != null
            ? { brightness: quality.brightness, sharpness: quality.sharpness }
            : null,
        isPrimary: true,
      });
      await tx.insert(consents).values({
        userId: user.id,
        type: "biometric_storage",
        version: CONSENT_VERSION,
        granted: true,
      });
    });

    if (existing) await deleteStoragePath(existing.imagePath);
  } catch (error) {
    console.error("[pix-ku-csc] saveFace failed:", error);
    await deleteStoragePath(imagePath).catch(() => {});
    return { error: "server" };
  }

  revalidatePath("/me");
  return { ok: true };
}

/**
 * Deletes the signed-in user's saved face — file and row both. The consent
 * logged when it was saved stays on record; PDPA requires evidence of what
 * was agreed to and when, so `consents` is append-only everywhere in this
 * app (see the table's own comment in `db/schema.ts`) and a delete here only
 * removes the data that consent covered, not the record of it.
 */
export async function deleteFace(): Promise<void> {
  const user = await requireUser();

  const [existing] = await db
    .select({ imagePath: userFaces.imagePath })
    .from(userFaces)
    .where(eq(userFaces.userId, user.id))
    .limit(1);
  if (!existing) return;

  await db.delete(userFaces).where(eq(userFaces.userId, user.id));
  await deleteStoragePath(existing.imagePath);

  revalidatePath("/me");
}

/**
 * Hides one event's saved-photo group from `/profile/[id]` — an opt-out,
 * not a delete: the photos stay saved, `unsavePhotos` is the only thing
 * that actually removes one. Idempotent, the same way `savePhotos` is,
 * since two tabs toggling the same event at once should never race into an
 * error.
 */
export async function hideEventFromProfile(eventId: string): Promise<void> {
  const user = await requireUser();
  await db
    .insert(profileHiddenEvents)
    .values({ userId: user.id, eventId })
    .onConflictDoNothing();
  revalidatePath(`/profile/${user.id}`);
}

/** Undoes `hideEventFromProfile` — the event's group shows on `/profile/[id]` again. */
export async function showEventOnProfile(eventId: string): Promise<void> {
  const user = await requireUser();
  await db
    .delete(profileHiddenEvents)
    .where(
      and(
        eq(profileHiddenEvents.userId, user.id),
        eq(profileHiddenEvents.eventId, eventId),
      ),
    );
  revalidatePath(`/profile/${user.id}`);
}
