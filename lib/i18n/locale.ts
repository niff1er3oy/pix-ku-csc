/**
 * Pure locale constants, safe to import from a Client Component.
 * `lib/i18n/index.ts` reads cookies through `next/headers` and must never
 * reach the browser bundle, so anything both sides need lives here.
 */

export const LOCALES = ["th", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "th";
export const LOCALE_COOKIE = "fkd_locale";

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}
