"use server";

import { and, eq } from "drizzle-orm";
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
    // schema would have to work out which one is the truth.
    //
    // `where role = 'user'` is the part that matters. Without it, approving an
    // admin who also shoots events would overwrite their role with
    // "photographer" and silently strip their access to this very page. The
    // enum holds one value, so a promotion has to be the only direction this
    // ever moves.
    await tx
      .update(users)
      .set({ role: "photographer" })
      .where(and(eq(users.id, row.userId), eq(users.role, "user")));
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

// ---------------------------------------------------------------------------
// Directory actions
// ---------------------------------------------------------------------------

const Promote = z.object({
  userId: z.string().uuid(),
  displayName: z.string().trim().min(2).max(80),
  affiliation: z.string().trim().max(120).optional(),
});

/**
 * Makes an account a photographer without waiting for it to apply.
 *
 * The display name is asked for rather than copied from the Google profile,
 * and that is a deliberate cost. `photographer.display_name` is what appears
 * on a public event page as "ถ่ายโดย …", and a Google account name is
 * frequently a nickname, a handle, or an email prefix. Putting that on a
 * university event by default would be the site publishing something about a
 * person that they never chose.
 *
 * Upserts on `photographer.user_id`, which is unique: an account that applied
 * and is sitting at `pending` gets approved by this rather than colliding
 * with itself.
 */
export async function makePhotographer(formData: FormData) {
  const admin = await requireRole("admin");
  const data = Promote.parse({
    userId: formData.get("userId"),
    displayName: formData.get("displayName"),
    affiliation: formData.get("affiliation"),
  });

  await db.transaction(async (tx) => {
    await tx
      .insert(photographers)
      .values({
        userId: data.userId,
        displayName: data.displayName,
        affiliation: data.affiliation || null,
        status: "approved",
        reviewedBy: admin.id,
        reviewedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: photographers.userId,
        set: {
          displayName: data.displayName,
          affiliation: data.affiliation || null,
          status: "approved",
          reviewedBy: admin.id,
          reviewedAt: new Date(),
          rejectionReason: null,
        },
      });

    // Only ever a promotion — see the note in `approvePhotographer`.
    await tx
      .update(users)
      .set({ role: "photographer" })
      .where(and(eq(users.id, data.userId), eq(users.role, "user")));
  });

  revalidatePath("/admin");
}

/**
 * Takes the photographer capability away.
 *
 * **It sets the status back rather than deleting the row, and that is not a
 * style preference.** `event.owner_id` references `photographer.id` with
 * `onDelete: cascade`, and `photo.event_id` cascades from there — deleting one
 * photographer row would erase every event they ever ran and every photograph
 * in them, including the ones students have already been told they can come
 * back for. Revoking is about what this person may do next, not about
 * destroying what they already made.
 *
 * Existing approved events therefore stay live on purpose. If a particular
 * event also has to come down, that is a separate decision made against that
 * event.
 */
export async function revokePhotographer(formData: FormData) {
  const admin = await requireRole("admin");
  const { id, reason } = Review.parse({
    id: formData.get("id"),
    reason: formData.get("reason"),
  });

  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(photographers)
      .set({
        status: "rejected",
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        rejectionReason: reason || null,
      })
      .where(eq(photographers.id, id))
      .returning({ userId: photographers.userId });

    if (!row) return;

    // Back to a plain user, unless they are an admin — an admin who also shot
    // events keeps the role that lets them run this page.
    await tx
      .update(users)
      .set({ role: "user" })
      .where(and(eq(users.id, row.userId), eq(users.role, "photographer")));
  });

  revalidatePath("/admin");
}

const RoleChange = z.object({
  userId: z.string().uuid(),
  role: z.enum(["user", "photographer", "admin"]),
});

/**
 * Grants or removes the admin role.
 *
 * Refuses to act on the caller's own account. An admin who removed their own
 * role would be locked out of the only screen that can give it back, and if
 * they were the last one the site would have no way to approve another
 * photographer ever again — recoverable only by editing the database by hand.
 * `ADMIN_EMAILS` bootstraps the first admin; nothing bootstraps the second.
 */
export async function setUserRole(formData: FormData) {
  const admin = await requireRole("admin");
  const { userId, role } = RoleChange.parse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });

  if (userId === admin.id) return;

  await db.update(users).set({ role }).where(eq(users.id, userId));
  revalidatePath("/admin");
}
