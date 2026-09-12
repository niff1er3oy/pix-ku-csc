"use client";

import { useState, type ReactNode } from "react";

import { SearchIcon } from "@/components/ui/icon";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";

/**
 * A small search box over one of the studio event page's own "who did X"
 * lists — searches, downloaders. Both cap at 100 rows (`getMyEventSearches`/
 * `getMyEventDownloaders`), which the surrounding page's own comment already
 * calls out as "read for a pattern more than clicked through row by row" —
 * this does not change that: the list still renders in full and still
 * scrolls the same way with the box empty, it just gives a photographer who
 * already has one name in mind a way to jump straight to it in a full list.
 *
 * Non-matching rows are hidden with `hidden` rather than dropped from the
 * array, the same reason `EventsManager`'s own search does that.
 */
export function SearchableList<T>({
  items,
  getSearchText,
  renderItem,
  dict,
}: {
  items: T[];
  getSearchText: (item: T) => string;
  renderItem: (item: T, hidden: boolean) => ReactNode;
  dict: Dictionary;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = (item: T) => !needle || getSearchText(item).toLowerCase().includes(needle);
  const visibleCount = items.filter(matches).length;

  return (
    <>
      {items.length > 1 && (
        <div className="relative mt-4 max-w-xs">
          <SearchIcon
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dict.studio.personSearchPlaceholder}
            aria-label={dict.studio.personSearchLabel}
            className="h-10 w-full rounded-pill bg-cloud pl-9 pr-4 text-label text-ink ring-1 ring-inset ring-edge placeholder:text-slate focus:ring-2 focus:ring-green-600"
          />
        </div>
      )}

      {needle && visibleCount === 0 ? (
        <p className="mt-4 rounded-card bg-cloud px-6 py-8 text-center text-label text-slate">
          {t(dict.studio.personSearchEmpty, { query: query.trim() })}
        </p>
      ) : (
        <ul className="mt-4 max-h-96 divide-y divide-edge overflow-y-auto rounded-card bg-paper ring-1 ring-edge">
          {items.map((item) => renderItem(item, !matches(item)))}
        </ul>
      )}
    </>
  );
}
