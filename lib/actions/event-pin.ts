"use server";

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { events } from "@/db/schema";
import { isPin, pinCookieName, pinMatches, signPinCookie } from "@/lib/event-pin";

export type VerifyEventPinState = { error: "invalid" | "wrong" } | undefined;

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
