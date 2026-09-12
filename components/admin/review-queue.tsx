"use client";

import { cloneElement, isValidElement, useState, type ReactElement } from "react";

import { SearchIcon } from "@/components/ui/icon";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Wraps a review queue — pending photographers, pending events — with a
 * client-side search over each item's title, the same pattern
 * `PortfolioGrid`/`EventsManager` use for their own lists. A queue drains as
 * an admin works through it, but if it falls behind (a busy launch week, a
 * campus event season) it can grow to dozens before anyone catches up, which
 * is exactly the point past which scrolling stops being the fastest way to
 * find one name.
 *
 * `rows` arrives already built as `<ReviewRow>` elements — this is a Client
 * Component and its caller (`/admin`) is a Server Component, and a function
 * that builds JSX from raw data cannot cross that boundary the way a value
 * can. `titles` is the plain-string parallel array this searches against,
 * matched by index; a non-matching row gets `hidden` set on its already-
 * built element via `cloneElement` (which `ReviewRow` reads to hide itself)
 * rather than being left out of `rows` — a queue row is a real `<form>` with
 * its own reject-reason text field, and unmounting one on every keystroke
 * would drop whatever an admin had half-typed into a row that later matches
 * again.
 */
export function ReviewQueue({
  titles,
  rows,
  labels,
}: {
  titles: string[];
  rows: ReactElement[];
  labels: Dictionary["admin"];
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = (i: number) => !needle || titles[i]?.toLowerCase().includes(needle);
  const visibleCount = titles.filter((_, i) => matches(i)).length;

  return (
    <>
      {titles.length > 1 && (
        <div className="relative mt-6 max-w-sm">
          <SearchIcon
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.reviewSearchPlaceholder}
            aria-label={labels.reviewSearchLabel}
            className="h-11 w-full rounded-pill bg-cloud pl-11 pr-4 text-body text-ink ring-1 ring-inset ring-edge placeholder:text-slate focus:ring-2 focus:ring-green-600"
          />
        </div>
      )}

      {needle && visibleCount === 0 && (
        <p className="mt-6 rounded-card bg-cloud px-6 py-12 text-center text-body text-slate">
          {t(labels.reviewSearchEmpty, { query: query.trim() })}
        </p>
      )}

      <ul className={titles.length > 1 ? "mt-4 space-y-4" : "mt-6 space-y-4"}>
        {rows.map((row, i) =>
          isValidElement(row) ? cloneElement(row, { hidden: !matches(i) } as never) : row,
        )}
      </ul>
    </>
  );
}
