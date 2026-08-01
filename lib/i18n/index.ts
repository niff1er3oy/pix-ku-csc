import { cookies } from "next/headers";

import { dictionaries, type Dictionary } from "./dictionaries";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./locale";

/**
 * Server-side entry point. It touches `next/headers`, so a Client Component
 * must import from `./dictionaries` (strings, `t`) or `./locale` (constants)
 * instead of from here.
 */

/**
 * Locale lives in a cookie rather than the URL. Event links get printed onto
 * QR codes and pasted into group chats, so the URL has to stay stable and
 * language-neutral — a `/th/e/slug` prefix would mean every printed QR is
 * locked to whichever language the photographer happened to be using.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()];
}

export function dictionaryFor(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export { t } from "./dictionaries";
export {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALES,
  type Locale,
} from "./locale";
export type { Dictionary };
