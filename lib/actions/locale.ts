"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

export async function setLocale(next: Locale) {
  if (!isLocale(next)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // The locale is read in the root layout, so every route's markup changes.
  revalidatePath("/", "layout");
}
