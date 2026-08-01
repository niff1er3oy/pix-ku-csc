import type { Metadata } from "next";

import { EventCard } from "@/components/events/event-card";
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
 */
export default async function EventsPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const events = await safely(() => getPublicEvents(60), []);

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <header className="max-w-xl">
        <h1 className="text-h1 font-bold">{dict.eventsPage.title}</h1>
        <p className="mt-4 text-body-lg text-slate">{dict.eventsPage.lede}</p>
        {events.length > 0 && (
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
              {dict.home.eventsEmpty}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-body text-slate">
              {dict.home.eventsEmptyBody}
            </p>
            {/* DESIGN.md requires an empty state to offer an action wherever
                the visitor can actually do something. Becoming a photographer
                is the one route that ends this emptiness. */}
            <ButtonLink
              href="/photographer/apply"
              variant="secondary"
              className="mt-8"
            >
              {dict.home.ctaSecondary}
            </ButtonLink>
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
