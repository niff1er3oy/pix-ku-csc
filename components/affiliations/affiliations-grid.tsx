"use client";

import Link from "next/link";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { CameraIcon, SearchIcon, UsersIcon } from "@/components/ui/icon";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locale";
import type { AffiliationGroup } from "@/lib/queries/public";
import { cn, enterDelay, formatNumber } from "@/lib/utils";

/**
 * The card grid `/affiliations` shows, with the same client-side,
 * no-round-trip search `PortfolioGrid`/`EventsManager` each use for their
 * own list — affiliations are admin-created one at a time, never at a
 * volume that would justify a `?q=` reload for a filter every row on the
 * page can already answer. Non-matching cards are hidden with `hidden`
 * rather than dropped from the array, the same reason those two do that.
 */
export function AffiliationsGrid({
  dict,
  locale,
  groups,
}: {
  dict: Dictionary;
  locale: Locale;
  groups: AffiliationGroup[];
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = (group: AffiliationGroup) =>
    !needle || group.name.toLowerCase().includes(needle);
  const visibleCount = groups.filter(matches).length;

  return (
    <>
      {groups.length > 1 && (
        <div className="relative mt-8 max-w-sm">
          <SearchIcon
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dict.adminAffiliationsPage.searchPlaceholder}
            aria-label={dict.adminAffiliationsPage.searchLabel}
            className="h-12 w-full rounded-pill bg-cloud pl-11 pr-4 text-body text-ink ring-1 ring-inset ring-edge placeholder:text-slate focus:ring-2 focus:ring-green-600"
          />
        </div>
      )}

      {needle && visibleCount === 0 ? (
        <div className="mt-8 rounded-card bg-cloud px-6 py-16 text-center">
          <p className="text-h3">
            {t(dict.adminAffiliationsPage.searchEmpty, { query: query.trim() })}
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {groups.map((group, i) => (
            <li key={group.id} className={cn("enter", enterDelay(i), !matches(group) && "hidden")}>
              <Link
                href={`/affiliations/${group.id}`}
                className="group flex h-full flex-col items-center gap-3 rounded-card bg-paper px-6 py-8 text-center shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[3px] hover:shadow-[var(--shadow-lift)]"
              >
                <Avatar
                  src={group.imagePath ? `/api/media/${group.imagePath}` : null}
                  size={72}
                  className="ring-2 ring-green-100"
                />
                <h2 className="w-full truncate text-h3 font-semibold text-ink transition-colors duration-200 group-hover:text-green-700">
                  {group.name}
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-green-50 px-3 py-1 text-caption font-medium text-green-700">
                    <UsersIcon size={14} />
                    {t(dict.affiliationsPage.photographerCount, {
                      count: formatNumber(group.memberCount, locale),
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-green-50 px-3 py-1 text-caption font-medium text-green-700">
                    <CameraIcon size={14} />
                    {t(dict.affiliationsPage.eventCount, {
                      count: formatNumber(group.eventCount, locale),
                    })}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
