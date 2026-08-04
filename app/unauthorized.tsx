import Link from "next/link";

import { getDictionary } from "@/lib/i18n";

/**
 * The 401 boundary that `unauthorized()` in lib/dal.ts renders into.
 *
 * Distinct from `forbidden.tsx`, and the difference is the whole point: this
 * is *not signed in*, which signing in fixes, so it offers that. `forbidden`
 * is *signed in and still not allowed*, where the same button would be a
 * pointless loop.
 *
 * In practice `proxy.ts` catches most of these first and redirects to
 * `/signin`, which is a better experience because it comes back afterwards.
 * This exists for the paths the proxy does not cover — a Server Action posted
 * directly, or a route added later that nobody remembered to list.
 */
export default async function Unauthorized() {
  const dict = await getDictionary();

  return (
    <main
      id="main"
      className="flex min-h-[100svh] flex-1 items-center justify-center px-5 py-20 sm:px-8"
    >
      <div className="w-full max-w-lg rounded-card bg-cloud px-6 py-14 text-center sm:py-16">
        <p className="tnum text-caption font-semibold text-slate">401</p>
        <h1 className="mt-2 text-h2">{dict.common.unauthorizedTitle}</h1>
        <p className="mx-auto mt-3 max-w-sm text-body text-slate">
          {dict.common.unauthorizedBody}
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/signin"
            className="inline-flex h-14 items-center justify-center rounded-pill bg-green-600 px-8 font-display text-base font-semibold text-paper shadow-[var(--shadow-pop)] transition-[background-color,transform] duration-200 hover:bg-green-700 active:scale-[0.98]"
          >
            {dict.auth.signInTitle}
          </Link>
          <Link
            href="/"
            className="inline-flex h-14 items-center justify-center rounded-pill bg-paper px-8 font-display text-base font-semibold text-green-700 ring-1 ring-inset ring-edge transition-[background-color] duration-200 hover:bg-green-50"
          >
            {dict.common.goHome}
          </Link>
        </div>
      </div>
    </main>
  );
}
