"use client";

import { useState } from "react";

import { EventCard } from "@/components/events/event-card";
import { SearchIcon } from "@/components/ui/icon";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locale";
import type { EventCard as EventCardData } from "@/lib/queries/public";
import { enterDelay } from "@/lib/utils";

/**
 * A photographer's portfolio grid, with the same client-side, no-round-trip
 * filter `SavedPhotosByEvent` uses for its own event list — everything this
 * could ever match is already on the page, so there is nothing a `?q=`
 * reload would do that filtering `events` in place does not.
 *
 * `events` is already scoped to this one photographer's public work by
 * `getPhotographerPortfolio` — this component only ever narrows that list
 * further, never widens it.
 */
export function PortfolioGrid({
  events,
  dict,
  locale,
}: {
  events: EventCardData[];
  dict: Dictionary;
  locale: Locale;
}) {
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? events.filter(
        (event) =>
          event.nameTh.toLowerCase().includes(needle) ||
          event.nameEn?.toLowerCase().includes(needle),
      )
    : events;

  return (
    <>
      {/* Not worth showing over a single event — there is nothing yet to
          narrow down. */}
      {events.length > 1 && (
        <div className="relative mt-5">
          <SearchIcon
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dict.eventsPage.searchPlaceholder}
            aria-label={dict.eventsPage.searchLabel}
            className="h-12 w-full rounded-pill bg-paper pl-11 pr-4 text-body text-ink ring-1 ring-inset ring-edge placeholder:text-slate focus:ring-2 focus:ring-green-600"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="mt-5 rounded-card bg-cloud p-6 text-center">
          <p className="text-label text-slate">
            {t(dict.eventsPage.searchEmpty, { query: query.trim() })}
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-2 text-label font-medium text-green-700 underline underline-offset-4"
          >
            {dict.eventsPage.searchClear}
          </button>
        </div>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 sm:gap-6">
          {filtered.map((event, i) => (
            <EventCard
              key={event.id}
              event={event}
              locale={locale}
              dict={dict}
              className={`enter ${enterDelay(i)}`}
            />
          ))}
        </ul>
      )}
    </>
  );
}
