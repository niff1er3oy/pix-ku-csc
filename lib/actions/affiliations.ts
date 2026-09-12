"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";

import { db } from "@/db";
import { affiliations, photographers, users } from "@/db/schema";
import { generatePin } from "@/lib/event-pin";
import { requireApprovedPhotographer, requireRole } from "@/lib/dal";

const CreateAffiliation = z.object({
  name: z.string().trim().min(2).max(120),
});

/**
 * Stands up a new affiliation with a fresh join code.
 *
 * The code is drawn from the same six-digit generator an event's own
 * `entryPin` uses, and retried the same way a collision on `accessCode`
 * would be handled if it needed retrying — up to 5 draws before giving up,
 * which at six digits and a small number of affiliations is not a real
 * limit, just a backstop against an infinite loop.
 */
export async function createAffiliation(formData: FormData): Promise<void> {
  const admin = await requireRole("admin");
  const { name } = CreateAffiliation.parse({ name: formData.get("name") });

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db.insert(affiliations).values({
        name,
        joinCode: generatePin(),
        createdBy: admin.id,
      });
      break;
    } catch (error) {
      // Unique violation on `join_code` — try another draw. Anything else is
      // a real failure and should surface as one.
      const isUniqueViolation =
        error instanceof Error && "code" in error && error.code === "23505";
      if (!isUniqueViolation || attempt === 4) throw error;
    }
  }

  revalidatePath("/admin/affiliations");
}

/**
 * Removes an affiliation outright. Every photographer and event that
 * pointed at it falls back to null — independent, unattributed — rather
 * than being deleted themselves; see the `onDelete: "set null"` on both
 * foreign keys in `db/schema.ts`. Nobody's own work disappears because the
 * group they did it under did.
 */
export async function deleteAffiliation(formData: FormData): Promise<void> {
  await requireRole("admin");
  const id = z.string().uuid().parse(formData.get("id"));
  await db.delete(affiliations).where(eq(affiliations.id, id));
  revalidatePath("/admin/affiliations");
}

export type JoinAffiliationState =
  | { error: "invalid" | "already_in" | "not_found" }
  | undefined;

/**
 * A photographer's own way in, given the code an admin — or an existing
 * member, see `addAffiliationMember` below — handed them.
 *
 * Refused outright if already affiliated rather than silently switching:
 * leaving the old group is a separate, deliberate action (`leaveAffiliation`)
 * precisely because it hands every event created there over to co-management
 * by people who are about to lose the ability to reach it — not something
 * a join code alone should trigger as a side effect.
 */
export async function joinAffiliation(
  _prev: JoinAffiliationState,
  formData: FormData,
): Promise<JoinAffiliationState> {
  const { photographer } = await requireApprovedPhotographer();
  if (photographer.affiliationId) return { error: "already_in" };

  const parsed = z
    .string()
    .trim()
    .min(1)
    .safeParse(formData.get("joinCode"));
  if (!parsed.success) return { error: "invalid" };

  const [affiliation] = await db
    .select({ id: affiliations.id })
    .from(affiliations)
    .where(eq(affiliations.joinCode, parsed.data))
    .limit(1);
  if (!affiliation) return { error: "not_found" };

  await db
    .update(photographers)
    .set({ affiliationId: affiliation.id })
    .where(eq(photographers.id, photographer.id));

  revalidatePath("/studio/affiliation");
  revalidatePath(`/profile/${photographer.userId}`);
}

/**
 * Steps out of the affiliation studio back to working solo. Every event
 * shared through it stays exactly as it is — `event.affiliationId` is set
 * once, at creation, and never follows a photographer's own membership
 * afterward — this only closes this one photographer's own door to editing
 * work they no longer co-manage.
 */
export async function leaveAffiliation(): Promise<void> {
  const { photographer } = await requireApprovedPhotographer();
  await db
    .update(photographers)
    .set({ affiliationId: null })
    .where(eq(photographers.id, photographer.id));

  revalidatePath("/studio/affiliation");
  revalidatePath(`/profile/${photographer.userId}`);
}

export type AddMemberState =
  | { error: "invalid" | "not_found" | "not_approved" | "already_in" }
  | undefined;

/**
 * A current member handing their own affiliation to someone new directly,
 * without going through an admin or the join code at all — the mutual-
 * management model extends to membership itself, not just to events.
 *
 * Scoped to the caller's *own* affiliation implicitly: there is no id to
 * name a different one, only `photographer.affiliationId`, so this can never
 * be pointed at a group the caller does not already belong to.
 */
export async function addAffiliationMember(
  _prev: AddMemberState,
  formData: FormData,
): Promise<AddMemberState> {
  const { photographer } = await requireApprovedPhotographer();
  if (!photographer.affiliationId) return { error: "invalid" };

  const parsed = z.string().trim().email().safeParse(formData.get("email"));
  if (!parsed.success) return { error: "invalid" };

  const [target] = await db
    .select({
      id: photographers.id,
      status: photographers.status,
      affiliationId: photographers.affiliationId,
    })
    .from(photographers)
    .innerJoin(users, eq(photographers.userId, users.id))
    .where(eq(users.email, parsed.data))
    .limit(1);

  if (!target) return { error: "not_found" };
  if (target.status !== "approved") return { error: "not_approved" };
  if (target.affiliationId) return { error: "already_in" };

  await db
    .update(photographers)
    .set({ affiliationId: photographer.affiliationId })
    .where(eq(photographers.id, target.id));

  revalidatePath("/studio/affiliation");
}

/**
 * Removes someone from the caller's own affiliation — full mutual management
 * extends here too, so this is not admin-only. Scoped by both the target id
 * *and* `photographer.affiliationId` in the same `where`, not checked
 * separately beforehand: that is what stops a caller from ever removing
 * someone from an affiliation that is not their own, even if they guess a
 * real photographer id.
 */
export async function removeAffiliationMember(formData: FormData): Promise<void> {
  const { photographer } = await requireApprovedPhotographer();
  if (!photographer.affiliationId) return;

  const targetId = z.string().uuid().safeParse(formData.get("photographerId"));
  if (!targetId.success) return;

  await db
    .update(photographers)
    .set({ affiliationId: null })
    .where(
      and(
        eq(photographers.id, targetId.data),
        eq(photographers.affiliationId, photographer.affiliationId),
      ),
    );

  revalidatePath("/studio/affiliation");
}
