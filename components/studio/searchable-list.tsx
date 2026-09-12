"use client";

import { cloneElement, isValidElement, useState, type ReactElement } from "react";

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
 * `rows` arrives already built — this is a Client Component and its caller
 * (the studio event page) is a Server Component, and a function that builds
 * JSX from raw data cannot cross that boundary the way a value can. `titles`
 * is the plain-string parallel array this searches against, matched by
 * index; a non-matching row gets `hidden` set on the already-built element
 * via `cloneElement` rather than being left out of `rows` — the browser's
 * own `hidden` attribute hides it the same as CSS would, and the row stays
 * mounted either way.
 */
export function SearchableList({
  titles,
  rows,
  dict,
}: {
  titles: string[];
  rows: ReactElement[];
  dict: Dictionary;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = (i: number) => !needle || titles[i]?.toLowerCase().includes(needle);
  const visibleCount = titles.filter((_, i) => matches(i)).length;

  return (
    <>
      {titles.length > 1 && (
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
          {rows.map((row, i) =>
            isValidElement(row) ? cloneElement(row, { hidden: !matches(i) } as never) : row,
          )}
        </ul>
      )}
    </>
  );
}
