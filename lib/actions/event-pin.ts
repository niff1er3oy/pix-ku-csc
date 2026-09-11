"use server";

import { and, eq, gte } from "drizzle-orm";
import { cookies, headers } from "next/headers";

import { db } from "@/db";
import { events, eventPinAttempts } from "@/db/schema";
import { isPin, pinCookieName, pinMatches, signPinCookie } from "@/lib/event-pin";
import { hashIp } from "@/lib/storage";

export type VerifyEventPinState =
  | { error: "invalid" | "wrong" | "rate_limited" }
  | undefined;

/** Six digits is a million possibilities — cheap enough to sweep through
 *  automatically without this. Scoped to one event per IP rather than
 *  globally: a visitor entering PINs for two different friends' events in
 *  the same sitting is not the thing this guards against. */
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

/**
 * The second factor a private event's own doc comment always promised but
 * nothing ever checked — see the note on `entryPin` in `db/schema.ts`.
 * The access code alone is a URL guess away from public; this is what
 * actually stops that guess from mattering.
 *
 * No redirect on success: this is called from a form sitting right on
 * `/e/[code]`, so the router's own post-action refresh re-renders that same
 * page — which now finds the cookie this just set and shows the gallery
 * instead of asking again.
 */
export async function verifyEventPin(
  _prev: VerifyEventPinState,
  formData: FormData,
): Promise<VerifyEventPinState> {
  const eventId = String(formData.get("eventId") ?? "");
  const pin = String(formData.get("pin") ?? "");

  if (!eventId || !isPin(pin)) return { error: "invalid" };

  const ipHash = hashIp(
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  );

  if (await isPinRateLimited(eventId, ipHash)) {
    return { error: "rate_limited" };
  }

  // Recorded before the comparison, and for a wrong guess same as a right
  // one — a correct PIN found on the first try should count against the
  // limit exactly as much as the four wrong guesses that might precede it.
  await db.insert(eventPinAttempts).values({ eventId, ipHash });

  const [event] = await db
    .select({ entryPin: events.entryPin })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.isPrivate, true)))
    .limit(1);

  if (!event?.entryPin || !pinMatches(pin, event.entryPin)) {
    return { error: "wrong" };
  }

  const store = await cookies();
  store.set(pinCookieName(eventId), signPinCookie(eventId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function isPinRateLimited(
  eventId: string,
  ipHash: string | null,
): Promise<boolean> {
  if (!ipHash) return false;
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const rows = await db
    .select({ id: eventPinAttempts.id })
    .from(eventPinAttempts)
    .where(
      and(
        eq(eventPinAttempts.eventId, eventId),
        eq(eventPinAttempts.ipHash, ipHash),
        gte(eventPinAttempts.createdAt, since),
      ),
    )
    .limit(RATE_LIMIT_MAX_ATTEMPTS);
  return rows.length >= RATE_LIMIT_MAX_ATTEMPTS;
}
