"use client";

import { useState, type ReactNode } from "react";

import { SearchIcon } from "@/components/ui/icon";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * Wraps a review queue — pending photographers, pending events — with a
 * client-side search over each item's title, the same pattern
 * `PortfolioGrid`/`EventsManager` use for their own lists. A queue drains as
 * an admin works through it, but if it falls behind (a busy launch week, a
 * campus event season) it can grow to dozens before anyone catches up, which
 * is exactly the point past which scrolling stops being the fastest way to
 * find one name.
 *
 * Non-matching rows are hidden with `hidden` rather than dropped from the
 * array — a queue row is a real `<form>` with its own reject-reason text
 * field, and unmounting one on every keystroke would drop whatever an admin
 * had half-typed into a row that later matches again.
 */
export function ReviewQueue<T>({
  items,
  getTitle,
  renderRow,
  labels,
}: {
  items: T[];
  getTitle: (item: T) => string;
  renderRow: (item: T, hidden: boolean) => ReactNode;
  labels: Dictionary["admin"];
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = (item: T) => !needle || getTitle(item).toLowerCase().includes(needle);
  const visibleCount = items.filter(matches).length;

  return (
    <>
      {items.length > 1 && (
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
        <p className={cn("rounded-card bg-cloud px-6 py-12 text-center text-body text-slate", "mt-6")}>
          {t(labels.reviewSearchEmpty, { query: query.trim() })}
        </p>
      )}

      <ul className={cn("space-y-4", items.length > 1 ? "mt-4" : "mt-6")}>
        {items.map((item) => renderRow(item, !matches(item)))}
      </ul>
    </>
  );
}
