import { Logo } from "@/components/brand/logo";
import { LoadingScreen } from "@/components/ui/loading";
import { getDictionary } from "@/lib/i18n";

/**
 * The loading state for the (site) group: full screen, no header, no footer —
 * the same shape as `app/error.tsx`, because both are states where there is no
 * page to show and framing an empty middle with navigation helps nobody.
 *
 * **This file has to be here, not beside `app/error.tsx`.** That was the first
 * attempt, since a `loading.tsx` at the root really does render outside
 * `(site)/layout.tsx` and its chrome. Measured against a deliberately slow
 * server render:
 *
 *   | boundary          | hard load | client navigation |
 *   | root              | shows     | never shows       |
 *   | here              | shows     | shows             |
 *
 * A Suspense boundary that is already mounted holds its current content rather
 * than dropping to the fallback when it re-suspends inside a transition, and
 * the root boundary is mounted for the whole session. This one is mounted
 * fresh for each incoming segment. With both files present the deeper one wins
 * every route this app has, so the root copy was only ever dead weight.
 *
 * Looking chrome-free from inside the chrome is `LoadingScreen`'s job: it is
 * `fixed inset-0 z-50` and covers the header rather than pretending not to be
 * underneath it.
 *
 * Deliberately shapeless. This one file covers the home page, the privacy
 * article, sign-in and the photographer application — four completely
 * different layouts — so a skeleton here would draw a shape that three of them
 * never become. Routes whose shape *is* predictable ship their own skeleton
 * next to their page instead, and those keep the chrome, because a
 * shape-matching skeleton is only honest inside the frame it is copying.
 */
export default async function Loading() {
  const dict = await getDictionary();

  return (
    <LoadingScreen
      label={dict.common.loading}
      mark={
        <>
          <span className="sr-only">{dict.brand.name}</span>
          <span aria-hidden>
            <Logo size="lg" />
          </span>
        </>
      }
    />
  );
}
