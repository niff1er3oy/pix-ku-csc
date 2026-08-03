"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";

import { db } from "@/db";
import { events, photographers, users } from "@/db/schema";
import { requireRole } from "@/lib/dal";

const Review = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

/**
 * Admin review actions.
 *
 * These are plain form actions rather than `useActionState` handlers on
 * purpose: the screen renders one form per row, and a shared state hook across
 * an unbounded list would have to key errors by row to say anything useful.
 * Plain actions also keep the buttons working with no JavaScript, which is the
 * same standard the rest of the app holds to.
 *
 * Every one of them re-checks the admin role server-side. The `/admin` page
 * already refuses non-admins, but a page guard is not an authorization check —
 * a server action is a public endpoint that anyone can post to.
 */

/**
 * Approving a photographer is what turns an application into a capability.
 * Nothing before this point grants anything: `applyAsPhotographer` only ever
 * writes a `pending` row.
 */
export async function approvePhotographer(formData: FormData) {
  const admin = await requireRole("admin");
  const { id } = Review.parse({ id: formData.get("id") });

  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(photographers)
      .set({
        status: "approved",
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        rejectionReason: null,
      })
      .where(eq(photographers.id, id))
      .returning({ userId: photographers.userId });

    if (!row) return;

    // The role is cosmetic next to `photographer.status`, which is what
    // `requireApprovedPhotographer` actually gates on — but leaving it at
    // "user" would make the two disagree, and the next person to read the
    // schema would have to work out which one is the truth. An admin keeps
    // their own role; being approved as a photographer is not a demotion.
    await tx
      .update(users)
      .set({ role: "photographer" })
      .where(eq(users.id, row.userId));
  });

  revalidatePath("/admin");
}

export async function rejectPhotographer(formData: FormData) {
  const admin = await requireRole("admin");
  const { id, reason } = Review.parse({
    id: formData.get("id"),
    reason: formData.get("reason"),
  });

  await db
    .update(photographers)
    .set({
      status: "rejected",
      reviewedBy: admin.id,
      reviewedAt: new Date(),
      rejectionReason: reason || null,
    })
    .where(eq(photographers.id, id));

  revalidatePath("/admin");
}

/**
 * Approving an event is what makes it publicly reachable — the finder, the
 * event page and /api/media all refuse anything that is not `approved`, so
 * until this runs the photographs are not exposed to anyone but their owner.
 */
export async function approveEvent(formData: FormData) {
  const admin = await requireRole("admin");
  const { id } = Review.parse({ id: formData.get("id") });

  await db
    .update(events)
    .set({
      status: "approved",
      reviewedBy: admin.id,
      reviewedAt: new Date(),
      rejectionReason: null,
    })
    .where(eq(events.id, id));

  revalidatePath("/admin");
  revalidatePath("/events");
}

export async function rejectEvent(formData: FormData) {
  const admin = await requireRole("admin");
  const { id, reason } = Review.parse({
    id: formData.get("id"),
    reason: formData.get("reason"),
  });

  await db
    .update(events)
    .set({
      status: "rejected",
      reviewedBy: admin.id,
      reviewedAt: new Date(),
      rejectionReason: reason || null,
    })
    .where(eq(events.id, id));

  revalidatePath("/admin");
  revalidatePath("/events");
}
