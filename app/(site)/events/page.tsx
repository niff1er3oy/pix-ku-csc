import type { Metadata } from "next";
import Link from "next/link";

import { EventCard } from "@/components/events/event-card";
import { SearchIcon } from "@/components/ui/icon";
import { ButtonLink } from "@/components/ui/button";
import { GridBackground } from "@/components/ui/grid-background";
import { getDictionary, getLocale, t } from "@/lib/i18n";
import { getPublicEvents, safely } from "@/lib/queries/public";
import { formatNumber } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.eventsPage.title, description: dict.eventsPage.lede };
}

/**
 * The landing page's primary call to action lands here, so this is the first
 * real screen most visitors reach. Unlisted events are excluded by the query —
 * those are reachable only by their printed QR or shared link.
 *
 * The search box is a plain GET `<form>` reading `?q=` — no client state, no
 * JavaScript required, and a search is a shareable/bookmarkable URL like
 * every other page here.
 */
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, locale, dict] = await Promise.all([
    searchParams,
    getLocale(),
    getDictionary(),
  ]);
  const query = q?.trim() || undefined;
  const events = await safely(() => getPublicEvents(60, query), []);

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <header className="max-w-xl">
        <h1 className="text-h1 font-bold">{dict.eventsPage.title}</h1>
        <p className="mt-4 text-body-lg text-slate">{dict.eventsPage.lede}</p>

        <form className="mt-6">
          <label htmlFor="event-search" className="sr-only">
            {dict.eventsPage.searchLabel}
          </label>
          <div className="relative">
            <SearchIcon
              size={20}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate"
            />
            <input
              id="event-search"
              name="q"
              type="search"
              defaultValue={query}
              placeholder={dict.eventsPage.searchPlaceholder}
              className="h-14 w-full rounded-pill bg-cloud pl-12 pr-28 text-body text-ink ring-1 ring-inset ring-edge placeholder:text-slate focus:ring-2 focus:ring-green-600"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 h-11 -translate-y-1/2 rounded-pill bg-green-600 px-5 font-display text-label font-semibold text-paper transition-colors duration-200 hover:bg-green-700"
            >
              {dict.eventsPage.searchSubmit}
            </button>
          </div>
        </form>

        {query && (
          <p className="mt-3 text-label text-slate">
            <Link
              href="/events"
              className="font-medium text-green-700 underline underline-offset-4"
            >
              {dict.eventsPage.searchClear}
            </Link>
          </p>
        )}

        {!query && events.length > 0 && (
          <p className="tnum mt-3 text-label text-slate">
            {t(dict.eventsPage.count, {
              count: formatNumber(events.length, locale),
            })}
          </p>
        )}
      </header>

      {events.length === 0 ? (
        <div className="relative mt-10 overflow-hidden rounded-card bg-cloud px-6 py-16 text-center sm:py-20">
          <GridBackground />
          <div className="relative">
            <p className="font-display text-h3 font-semibold">
              {query
                ? t(dict.eventsPage.searchEmpty, { query })
                : dict.home.eventsEmpty}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-body text-slate">
              {query ? dict.eventsPage.searchEmptyBody : dict.home.eventsEmptyBody}
            </p>
            {/* DESIGN.md requires an empty state to offer an action wherever
                the visitor can actually do something. A search that came up
                empty offers a way back to the full list; an event-free site
                offers becoming a photographer instead — the one route that
                ends that emptiness. */}
            {query ? (
              <ButtonLink href="/events" variant="secondary" className="mt-8">
                {dict.eventsPage.searchClear}
              </ButtonLink>
            ) : (
              <ButtonLink
                href="/photographer/apply"
                variant="secondary"
                className="mt-8"
              >
                {dict.home.ctaSecondary}
              </ButtonLink>
            )}
          </div>
        </div>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {events.map((event, i) => (
            <EventCard
              key={event.id}
              event={event}
              locale={locale}
              dict={dict}
              className="reveal"
              style={{ "--rs": `${2 + (i % 3) * 5}%` } as React.CSSProperties}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
