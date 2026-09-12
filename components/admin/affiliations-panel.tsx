"use client";

import { useState } from "react";

import { CreateAffiliationButton } from "@/components/admin/create-affiliation-button";
import { DeleteAffiliationButton } from "@/components/admin/delete-affiliation-button";
import { CopyLinkButton } from "@/components/studio/copy-link-button";
import { Avatar } from "@/components/ui/avatar";
import { SearchIcon } from "@/components/ui/icon";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";
import type { AdminAffiliationRow } from "@/lib/queries/affiliations";
import { cn, enterDelay, formatDate, formatNumber } from "@/lib/utils";

/**
 * The "สังกัด" tab's body — create form plus the list, everything the old
 * standalone `/admin/affiliations` page held once its own heading, back
 * link, and page-level lede are stripped out. Those now live one level up,
 * in `Directory`'s own shared section header, since this is a tab inside the
 * account directory rather than a page of its own.
 *
 * The search here is client-side, unlike the member list's own — that one
 * runs in Postgres because it can hold hundreds to low thousands of rows;
 * affiliations are admin-created one at a time, and a handful to a few dozen
 * never justifies a round trip for a filter that already has every row on
 * the page. Non-matching rows are hidden with `hidden` rather than dropped
 * from the array, the same reason `EventsManager`'s own search does that —
 * there is no checkbox state here to lose, but it costs nothing to stay
 * consistent with the one search pattern in this codebase that does.
 */
export function AffiliationsPanel({
  dict,
  locale,
  affiliations,
}: {
  dict: Dictionary;
  locale: "th" | "en";
  affiliations: AdminAffiliationRow[];
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = (affiliation: AdminAffiliationRow) =>
    !needle || affiliation.name.toLowerCase().includes(needle);
  const visibleCount = affiliations.filter(matches).length;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-prose text-body text-slate">
          {dict.adminAffiliationsPage.lede}
        </p>
        <CreateAffiliationButton dict={dict} />
      </div>

      {affiliations.length === 0 ? (
        <p className="mt-10 rounded-card bg-cloud px-6 py-12 text-center text-body text-slate">
          {dict.adminAffiliationsPage.empty}
        </p>
      ) : (
        <>
          {affiliations.length > 1 && (
            <div className="relative mt-6 max-w-sm">
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
                className="h-11 w-full rounded-pill bg-cloud pl-11 pr-4 text-body text-ink ring-1 ring-inset ring-edge placeholder:text-slate focus:ring-2 focus:ring-green-600"
              />
            </div>
          )}

          {needle && visibleCount === 0 && (
            <p className="mt-6 rounded-card bg-cloud px-6 py-12 text-center text-body text-slate">
              {t(dict.adminAffiliationsPage.searchEmpty, { query: query.trim() })}
            </p>
          )}

          <ul className="mt-6 space-y-3">
            {affiliations.map((affiliation, i) => (
              <li
                key={affiliation.id}
                className={cn(
                  "enter flex flex-wrap items-center justify-between gap-3 rounded-card bg-paper p-4 shadow-[var(--shadow-card)]",
                  enterDelay(i),
                  !matches(affiliation) && "hidden",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    src={affiliation.imagePath ? `/api/media/${affiliation.imagePath}` : null}
                    size={36}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-display text-h3 font-semibold text-ink">
                      {affiliation.name}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-slate">
                      <span>
                        {t(dict.adminAffiliationsPage.memberCount, {
                          count: formatNumber(affiliation.memberCount, locale),
                        })}
                      </span>
                      <span>
                        {dict.adminAffiliationsPage.createdAt}{" "}
                        {formatDate(affiliation.createdAt, locale)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="tnum rounded-pill bg-cloud px-3 py-1.5 text-label tracking-[0.2em] text-ink">
                    {affiliation.joinCode}
                  </span>
                  <CopyLinkButton
                    value={affiliation.joinCode}
                    label={dict.affiliationStudio.copyCode}
                    copiedLabel={dict.affiliationStudio.copyCodeCopied}
                  />
                  <DeleteAffiliationButton
                    id={affiliation.id}
                    label={dict.adminAffiliationsPage.deleteButton}
                    confirmMessage={dict.adminAffiliationsPage.deleteConfirm}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
