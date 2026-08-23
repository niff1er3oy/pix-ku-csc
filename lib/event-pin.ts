import "server-only";

import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

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
 * Hashes a PIN for storage.
 *
 * scrypt with a per-PIN salt, stored as `salt:hash` in hex. The owner chose to
 * keep the PIN unreadable after it is set, which means the stored value has to
 * survive somebody reading the database — a plain column would hand out entry
 * to every private event at once.
 *
 * scrypt is deliberately slow and memory-hard, which matters more here than
 * for a password: six digits is a million possibilities, so a fast hash would
 * fall to an offline sweep in seconds. It is in Node's standard library, so
 * this needs no dependency.
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(pin, salt, 64);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

/**
 * Checks a PIN against a stored hash.
 *
 * `timingSafeEqual` rather than `===`: a normal comparison returns as soon as
 * two bytes differ, and the time it took is a measurable clue about how much
 * of the guess was right. Over a million candidates that turns a search into a
 * short one.
 */
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;

  try {
    const key = Buffer.from(keyHex, "hex");
    const candidate = await scryptAsync(pin, Buffer.from(saltHex, "hex"), key.length);
    return timingSafeEqual(key, candidate);
  } catch {
    return false;
  }
}
