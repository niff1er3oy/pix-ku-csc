import "server-only";

import { createHmac, timingSafeEqual, randomInt } from "node:crypto";

/** Six digits. Short enough to read off a sign and say down a phone. */
export const PIN_LENGTH = 6;

const PIN_SHAPE = /^\d{6}$/;

export function isPin(value: string): boolean {
  return PIN_SHAPE.test(value);
}

/**
 * A random entry PIN.
 *
 * `randomInt` and not `Math.random`: this guards photographs of people at a
 * private event, and a value predictable from an earlier one is not a guard.
 * Ten digits divides 2^32 evenly enough that `randomInt` handles the bias
 * internally — it rejects and redraws rather than taking a modulus.
 */
export function generatePin(): string {
  let pin = "";
  while (pin.length < PIN_LENGTH) pin += randomInt(0, 10);
  return pin;
}

/**
 * Checks a PIN against the one stored on the event.
 *
 * Stored in the clear — the owner wants it shown back on the settings page,
 * not just set once — so this is a plain comparison, not a hash check.
 * `timingSafeEqual` rather than `===` still matters: a normal comparison
 * returns as soon as two bytes differ, and the time it took is a measurable
 * clue about how much of the guess was right.
 */
export function pinMatches(candidate: string, stored: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Remembering that a PIN was entered, without storing the PIN — or anything
 * derived from it — in the cookie itself.
 *
 * The event's own id (not its access code, and not the PIN) is what gets
 * signed: an HMAC over `AUTH_SECRET`, which this reuses rather than adding a
 * second secret to configure. `event-pin:` domain-separates it from
 * anything else that secret ever signs, so this token could never be
 * replayed as one of those and vice versa. The event id alone — no
 * expiry, no visitor id — is enough: the cookie answers exactly one
 * question, "has *a* browser holding this cookie already typed this
 * event's PIN," the same thing re-typing it on every page load would have
 * proven.
 */
function pinToken(eventId: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`event-pin:${eventId}`).digest("hex");
}

/** The cookie name one event's verified-PIN token is stored under. */
export function pinCookieName(eventId: string): string {
  return `epv_${eventId}`;
}

/** The value to store in that cookie once a visitor's PIN checks out. */
export function signPinCookie(eventId: string): string {
  return pinToken(eventId);
}

/** Whether a cookie value already proves this event's PIN was entered. */
export function isPinCookieValid(
  eventId: string,
  value: string | undefined,
): boolean {
  if (!value) return false;

  const expected = Buffer.from(pinToken(eventId), "hex");
  let candidate: Buffer;
  try {
    candidate = Buffer.from(value, "hex");
  } catch {
    return false;
  }
  if (candidate.length !== expected.length) return false;

  return timingSafeEqual(candidate, expected);
}
