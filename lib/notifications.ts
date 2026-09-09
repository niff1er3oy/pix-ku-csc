import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { notifications, users, type NotificationType } from "@/db/schema";

type NotifyInput = {
  userId: string;
  type: NotificationType;
  href?: string;
  data?: Record<string, string | number>;
};

/**
 * Posts a one-shot notification. Every type this is used for happens at most
 * once per thing — an application is approved once, an event is rejected
 * once — so nothing here needs deduplicating; see `notifyPhotoIndexFailed`
 * for the type that does.
 */
export async function notify({ userId, type, href, data }: NotifyInput): Promise<void> {
  await db.insert(notifications).values({
    userId,
    type,
    href: href ?? null,
    data: data ?? null,
  });
}

/**
 * Same as `notify`, fanned out to every admin. Used where the event has no
 * single owner to tell — a photographer application isn't anyone's yet.
 */
export async function notifyAdmins(
  input: Omit<NotifyInput, "userId">,
): Promise<void> {
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"));

  if (admins.length === 0) return;

  await db.insert(notifications).values(
    admins.map((admin) => ({
      userId: admin.id,
      type: input.type,
      href: input.href ?? null,
      data: input.data ?? null,
    })),
  );
}

/**
 * Upserts one row per (user, event, type) instead of inserting on every
 * occurrence — see the note on `notifications.dedupKey` in the schema. A
 * bulk upload that fails Rekognition on hundreds of photos, or a gallery that
 * gets pulled from a hundred times in an afternoon, bumps the count on a
 * single notification rather than posting hundreds. `readAt` is cleared on
 * every bump, so a fresh wave re-flags a row the owner already dismissed.
 */
async function notifyEventCountUp(params: {
  userId: string;
  type: Extract<NotificationType, "photo_index_failed" | "photo_downloaded">;
  eventId: string;
  eventName: string;
}): Promise<void> {
  const { userId, type, eventId, eventName } = params;

  await db
    .insert(notifications)
    .values({
      userId,
      type,
      href: `/studio/events/${eventId}`,
      dedupKey: `${type}:${eventId}`,
      data: { eventName, count: 1 },
    })
    .onConflictDoUpdate({
      target: [notifications.userId, notifications.dedupKey],
      set: {
        data: sql`jsonb_set(
          jsonb_set(coalesce(${notifications.data}, '{}'::jsonb), '{eventName}', to_jsonb(${eventName}::text)),
          '{count}',
          (coalesce((${notifications.data}->>'count')::int, 0) + 1)::text::jsonb
        )`,
        readAt: null,
        createdAt: sql`now()`,
      },
    });
}

export function notifyPhotoIndexFailed(params: {
  userId: string;
  eventId: string;
  eventName: string;
}): Promise<void> {
  return notifyEventCountUp({ ...params, type: "photo_index_failed" });
}

/** Fires once per original-file download — see the `?download=1` branch of
 *  `/api/media`'s `authorize()`, which skips this when the owner downloads
 *  their own event's photo. */
export function notifyPhotoDownloaded(params: {
  userId: string;
  eventId: string;
  eventName: string;
}): Promise<void> {
  return notifyEventCountUp({ ...params, type: "photo_downloaded" });
}
