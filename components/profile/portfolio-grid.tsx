"use client";

import { useState } from "react";

import { EventCard } from "@/components/events/event-card";
import { SearchIcon } from "@/components/ui/icon";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locale";
import type { EventCard as EventCardData } from "@/lib/queries/public";
import { cn, enterDelay } from "@/lib/utils";

/**
 * A photographer's portfolio grid, with the same client-side, no-round-trip
 * filter `SavedPhotosByEvent` uses for its own event list — everything this
 * could ever match is already on the page, so there is nothing a `?q=`
 * reload would do that filtering `events` in place does not.
 *
 * `events` is already scoped to this one photographer's work by
 * `getPhotographerPortfolio` — public only by default, private included as
 * well for an admin (see that function's `includePrivate`). The two never
 * share one grid here: the same "public/hidden/private, each its own tab"
 * split `SavedPhotosByEvent` uses, for the same reason — an admin looking
 * for what is actually public should not have to read a lock badge on every
 * card to tell which ones count.
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
  const [view, setView] = useState<"public" | "private">("public");

  const publicEvents = events.filter((event) => !event.isPrivate);
  const privateEvents = events.filter((event) => event.isPrivate);
  // Only an admin's request ever produces a private row at all (see the
  // note above), so this tab bar never appears for anyone else.
  const showPrivateTab = privateEvents.length > 0;
  const activeEvents = showPrivateTab && view === "private" ? privateEvents : publicEvents;

  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? activeEvents.filter(
        (event) =>
          event.nameTh.toLowerCase().includes(needle) ||
          event.nameEn?.toLowerCase().includes(needle),
      )
    : activeEvents;

  return (
    <>
      {showPrivateTab && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          <TabButton active={view === "public"} onClick={() => setView("public")}>
            {dict.profile.portfolioPublicTab}
          </TabButton>
          <TabButton active={view === "private"} onClick={() => setView("private")}>
            {t(dict.profile.portfolioPrivateTab, { count: String(privateEvents.length) })}
          </TabButton>
        </div>
      )}

      {/* Not worth showing over a single event — there is nothing yet to
          narrow down. */}
      {activeEvents.length > 1 && (
        <div className={cn("relative", showPrivateTab ? "mt-4" : "mt-5")}>
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
            {needle
              ? t(dict.eventsPage.searchEmpty, { query: query.trim() })
              : dict.profile.portfolioEmpty}
          </p>
          {needle && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-2 text-label font-medium text-green-700 underline underline-offset-4"
            >
              {dict.eventsPage.searchClear}
            </button>
          )}
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

/** One pill in the public/private switcher — a local view toggle, not a
 *  navigation, so `aria-pressed` rather than a `Link`-based tab bar's own
 *  `aria-current`. Mirrors `SavedPhotosByEvent`'s own `TabButton`. */
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 items-center whitespace-nowrap rounded-pill px-4 text-sm font-medium transition-colors duration-200",
        active ? "bg-green-600 text-paper" : "text-slate hover:bg-cloud hover:text-green-700",
      )}
    >
      {children}
    </button>
  );
}
