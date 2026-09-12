import type { Metadata } from "next";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { getDictionary, getLocale, t } from "@/lib/i18n";
import { getAffiliations, safely } from "@/lib/queries/public";
import { enterDelay, formatNumber } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.affiliationsPage.title, description: dict.affiliationsPage.lede };
}

/**
 * Every affiliation an approved photographer has actually typed, each with
 * who shoots under it — a directory of who shoots for whom, not anyone's
 * own data, so it needs no session the way `/events` needs none. "อิสระ"
 * (independent) never shows up as a group here: it is only ever the
 * fallback `/profile/[id]` displays in its place, not something anyone
 * entered — see `getAffiliations`'s own note.
 */
export default async function AffiliationsPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const groups = await safely(() => getAffiliations(), []);

  return (
    <section className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
      <header className="max-w-xl">
        <h1 className="text-h1 font-bold">{dict.affiliationsPage.title}</h1>
        <p className="mt-4 text-body-lg text-slate">{dict.affiliationsPage.lede}</p>
      </header>

      {groups.length === 0 ? (
        <div className="mt-10 rounded-card bg-cloud px-6 py-16 text-center">
          <p className="text-h3">{dict.affiliationsPage.empty}</p>
        </div>
      ) : (
        <ul className="mt-10 space-y-4">
          {groups.map((group, i) => (
            <li
              key={group.name}
              className={`enter rounded-card bg-paper p-5 shadow-[var(--shadow-card)] sm:p-6 ${enterDelay(i)}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-h3 font-semibold text-ink">{group.name}</h2>
                <p className="tnum text-label text-slate">
                  {t(dict.affiliationsPage.photographerCount, {
                    count: formatNumber(group.photographers.length, locale),
                  })}
                </p>
              </div>

              <ul className="mt-4 flex flex-wrap gap-3">
                {group.photographers.map((photographer) => (
                  <li key={photographer.userId}>
                    <Link
                      href={`/profile/${photographer.userId}`}
                      className="flex items-center gap-2 rounded-pill bg-cloud py-1.5 pl-1.5 pr-3 text-label text-ink transition-colors duration-200 hover:bg-green-50 hover:text-green-700"
                    >
                      <Avatar src={photographer.image} size={28} />
                      <span className="truncate">{photographer.displayName}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
