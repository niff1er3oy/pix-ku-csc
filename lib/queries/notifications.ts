import "server-only";

import { and, count, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { notifications, type Notification } from "@/db/schema";

/** Bell dropdown only ever shows the most recent handful — there is no
 *  full history page to paginate into. */
const RECENT_LIMIT = 20;

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

  return row?.value ?? 0;
}

export async function listRecentNotifications(userId: string): Promise<Notification[]> {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(RECENT_LIMIT);
}
