import Link from "next/link";

import { getDictionary } from "@/lib/i18n";

/**
 * The 403 boundary that `forbidden()` in lib/dal.ts renders into.
 *
 * It sits beside `app/error.tsx` rather than inside `(site)`, so it replaces
 * the header and footer for the same reason the error and loading screens do:
 * a nav bar wrapped around "you cannot open this" offers the visitor a set of
 * places they may or may not be allowed to go either.
 *
 * The distinction from `unauthorized.tsx` is worth keeping straight, because
 * they read almost the same and mean opposite things. This one is *signed in,
 * not allowed* — telling them to sign in would be useless advice, since they
 * already did. `unauthorized.tsx` is *not signed in*, which signing in fixes.
 */
export default async function Forbidden() {
  const dict = await getDictionary();

  return (
    <main
      id="main"
      className="flex min-h-[100svh] flex-1 items-center justify-center px-5 py-20 sm:px-8"
    >
      <div className="w-full max-w-lg rounded-card bg-cloud px-6 py-14 text-center sm:py-16">
        <p className="tnum text-caption font-semibold text-slate">403</p>
        <h1 className="mt-2 text-h2">{dict.common.forbiddenTitle}</h1>
        <p className="mx-auto mt-3 max-w-sm text-body text-slate">
          {dict.common.forbiddenBody}
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex h-14 items-center justify-center rounded-pill bg-green-600 px-8 font-display text-base font-semibold text-paper shadow-[var(--shadow-pop)] transition-[background-color,transform] duration-200 hover:bg-green-700 active:scale-[0.98]"
        >
          {dict.common.goHome}
        </Link>
      </div>
    </main>
  );
}
