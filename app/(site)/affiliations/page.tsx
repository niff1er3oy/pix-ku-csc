import type { Metadata } from "next";

import { AffiliationsGrid } from "@/components/affiliations/affiliations-grid";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getAffiliations, safely } from "@/lib/queries/public";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.affiliationsPage.title, description: dict.affiliationsPage.lede };
}

/**
 * Every affiliation an approved photographer has actually typed, as a card
 * each links out to its own page (`/affiliations/[id]`) — a directory of who
 * shoots for whom, not anyone's own data, so it needs no session the way
 * `/events` needs none. "อิสระ" (independent) never shows up as a card
 * here: it is only ever the fallback `/profile/[id]` displays in its place,
 * not something anyone entered — see `getAffiliations`'s own note.
 */
export default async function AffiliationsPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const groups = await safely(() => getAffiliations(), []);

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <header className="max-w-xl">
        <h1 className="text-h1 font-bold">{dict.affiliationsPage.title}</h1>
        <p className="mt-4 text-body-lg text-slate">{dict.affiliationsPage.lede}</p>
      </header>

      {groups.length === 0 ? (
        <div className="mt-10 rounded-card bg-cloud px-6 py-16 text-center">
          <p className="text-h3">{dict.affiliationsPage.empty}</p>
        </div>
      ) : (
        <AffiliationsGrid dict={dict} locale={locale} groups={groups} />
      )}
    </section>
  );
}
