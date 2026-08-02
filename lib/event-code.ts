/**
 * The event code: six characters, English letters and digits.
 *
 * This is the thing a visitor holds in their hand — printed under a QR on a
 * poster at the booth, or forwarded in a LINE group. Everything about the
 * format is decided by that scene: someone squinting at a sign across a
 * crowded field, typing on a phone one-handed.
 *
 * Every part of the app that reads, writes, or checks a code goes through this
 * module, so the format is defined once rather than re-derived at each call
 * site.
 */

/** Six positions, as specified. */
export const EVENT_CODE_LENGTH = 6;

/**
 * The alphabet a generated code may use: digits plus A–Z **minus I, L and O**.
 *
 * Those three are dropped because on a printed poster read at a distance they
 * are the same glyph as 1, 1 and 0. Dropping them is what makes the
 * normalisation below safe: since no real code can contain I, L or O, folding
 * a typed one into its digit can never corrupt a code that was actually
 * correct — it can only rescue one that was about to fail.
 *
 * 33 characters over 6 positions is about 1.29 billion codes, which is not the
 * constraint here by any margin.
 */
export const EVENT_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Typed lookalike → the character it can only have meant. */
const LOOKALIKES: Record<string, string> = { I: "1", L: "1", O: "0" };

/**
 * Turns whatever was typed into the canonical form, or returns null if it
 * could not have been a code.
 *
 * Deliberately forgiving about everything that carries no meaning: case,
 * surrounding whitespace, and the spaces or hyphens people insert to make six
 * characters easier to read back to themselves ("K2P 8QX").
 */
export function normaliseEventCode(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[ILO]/g, (character) => LOOKALIKES[character]);

  if (cleaned.length !== EVENT_CODE_LENGTH) return null;

  for (const character of cleaned) {
    if (!EVENT_CODE_ALPHABET.includes(character)) return null;
  }

  return cleaned;
}

/** Whether this input is a well-formed code. */
export function isEventCode(input: string): boolean {
  return normaliseEventCode(input) !== null;
}

/**
 * A fresh code, for whoever creates an event.
 *
 * Uses `crypto.getRandomValues` rather than `Math.random`: a code is the only
 * gate on an unlisted event, so a sequence that can be predicted from an
 * earlier one would hand out access to photographs of people who did not
 * consent to being findable.
 *
 * Rejection sampling keeps the distribution flat — `% alphabet.length` on a
 * byte would make the first 28 characters of the alphabet slightly likelier
 * than the rest, which is exactly the kind of small bias that makes a
 * brute-force search cheaper than it looks.
 *
 * Callers must still handle a collision from the database's unique
 * constraint; uniqueness is not something a generator can promise.
 */
export function generateEventCode(): string {
  const alphabet = EVENT_CODE_ALPHABET;
  const limit = Math.floor(256 / alphabet.length) * alphabet.length;
  let code = "";

  const byte = new Uint8Array(1);
  while (code.length < EVENT_CODE_LENGTH) {
    crypto.getRandomValues(byte);
    if (byte[0] >= limit) continue;
    code += alphabet[byte[0] % alphabet.length];
  }

  return code;
}
