import "server-only";

import { db } from "@/db";
import { photographers } from "@/db/schema";

/**
 * Gives an admin an approved photographer profile the moment they become
 * one, if they do not already have one of their own — see the note on
 * `requireApprovedPhotographer` in `lib/dal.ts` for why `/studio` gates on
 * that row rather than the `admin` role directly. This is not a new
 * capability: an admin could already grant themselves the same thing from
 * the admin console in two clicks. Doing it here just skips the clicks.
 *
 * `onConflictDoNothing` on `photographers.userId`'s own unique constraint —
 * an admin who separately applied and is sitting at `pending` or `rejected`
 * keeps that outcome. This only ever fills in a row that was not there at
 * all; it never overrides a decision someone actually made about this
 * account.
 *
 * A plain module rather than living in `lib/dal.ts`: `auth.ts` needs this
 * from its `signIn` event, and `lib/dal.ts` already imports `auth.ts` for
 * `getSessionUser` — importing back the other way would be a cycle.
 */
export async function ensureAdminPhotographerProfile(
  userId: string,
  displayName: string,
): Promise<void> {
  await db
    .insert(photographers)
    .values({ userId, displayName, status: "approved" })
    .onConflictDoNothing();
}
