/**
 * The event code: six characters, English letters and digits.
 *
 * This is the thing a visitor holds in their hand — printed under a QR on a
 * poster at the booth, or forwarded in a LINE group.
 *
 * **A code is issued by the system, never chosen.** Neither a visitor nor a
 * photographer can set one. That single rule decides everything else in this
 * file, and it is worth stating plainly because an earlier version was built
 * on the opposite assumption and got the behaviour wrong:
 *
 * The alphabet used to exclude I, L and O, on the reasoning that they are
 * indistinguishable from 1, 1 and 0 on a printed sign — and, because a code
 * supposedly could not contain them, a typed I was quietly read as a 1 before
 * the lookup. That is a rewrite of what somebody typed, and it is only ever
 * safe if no real code contains those letters. Since a code is whatever the
 * system happened to generate, `IIII00` is a perfectly possible code, and
 * rewriting it to `111100` would make the one person holding it unable to
 * reach their photographs. So: the full 36 characters, and what is typed is
 * what is looked up.
 *
 * Every part of the app that reads, writes, or checks a code goes through this
 * module, so the format is defined once rather than re-derived at each call
 * site.
 */

/** Six positions. */
export const EVENT_CODE_LENGTH = 6;

/**
 * Digits and the whole English alphabet — 36 characters, so 36^6 is about 2.17
 * billion codes.
 *
 * Nothing is held back for legibility. A generator that skipped the ambiguous
 * letters would be quietly deciding that some codes may not exist, and the
 * reader on the other end has the QR beside the printed code anyway.
 *
 * This module does not generate codes; `gen_event_code()` in migration 0002
 * does, and the CHECK constraint added there is the same expression as
 * `CODE_CHARACTER` below. Kept as one regex on this side so there is exactly
 * one thing to change if the format ever moves.
 */
const CODE_CHARACTER = /^[A-Z0-9]$/;

/**
 * Exactly what was typed, minus the parts that carry no meaning: case, the
 * surrounding whitespace, and the spaces or hyphens people insert to read six
 * characters back to themselves ("K2P 8QX").
 *
 * Nothing is substituted. Case is safe to fold because the alphabet has no
 * lower-case members, so `k2p8qx` and `K2P8QX` cannot be two different codes.
 *
 * Returns null when the input could not be a code at all.
 */
export function cleanEventCode(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[\s-]/g, "");
  if (cleaned.length !== EVENT_CODE_LENGTH) return null;

  for (const character of cleaned) {
    if (!CODE_CHARACTER.test(character)) return null;
  }

  return cleaned;
}

/** Whether this input is shaped like a code at all. */
export function isEventCode(input: string): boolean {
  return cleanEventCode(input) !== null;
}
