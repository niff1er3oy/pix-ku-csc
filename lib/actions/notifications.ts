"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/dal";

const Id = z.object({ id: z.string().uuid() });

/**
 * Marks one notification read and follows its link, both in the same submit.
 * A plain form button rather than a client-side click handler, so the bell
 * dropdown works with no JavaScript like every other control in this app.
 *
 * Scoped to the caller's own notification by the `where` clause — the id in
 * the form is whatever the caller sent.
 */
export async function openNotification(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = Id.safeParse({ id: formData.get("id") });
  if (!parsed.success) redirect("/");
  const { id } = parsed.data;

  const [row] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
    .returning({ href: notifications.href });

  revalidatePath("/", "layout");
  redirect(row?.href || "/");
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireUser();

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));

  revalidatePath("/", "layout");
}
