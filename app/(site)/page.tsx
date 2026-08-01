/**
 * DIRECTION CONTRACT — landing page (Persuade)
 *
 * THESIS: The event-photo-finder canon, told down the page. A brand screen
 * opens, three scroll-driven beats show a face becoming a pile of found
 * photos, and the working search sits at the end — with a skip link on the
 * first screen for anyone who came to do rather than to read.
 *
 * OWN-WORLD: Two brand colours only, off the KU mark — teal #00706b, lime
 * #b8c214. White ground, 20px radii, soft shadows, K2D display over looped
 * Thai body. Green owns whole bands; lime marks what has been found.
 *
 * STORY: This is the KU photo finder. My face goes in, the whole event gets
 * read, my photos come out. Then: here is the box, go.
 *
 * FIRST VIEWPORT: The wordmark at display scale, one line of tagline, a skip
 * link and a scroll cue. Nothing else — the owner chose the brand screen over
 * a working first screen after hearing the case for the latter.
 *
 * FORM: Canon, taken by the owner at the standing exit over grounded #7
 * (yearbook). Seed b397a475. Scroll storytelling added later, reference
 * pinelabs/signaliq: normal flow, never hijacked.
 */

import Link from "next/link";

import { EventCard } from "@/components/events/event-card";
import { EventFinder } from "@/components/home/event-finder";
import { pickFinderLabels } from "@/components/home/finder-labels";
import { ScrollJourney } from "@/components/home/scroll-journey";
import { ButtonLink } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import { GridBackground } from "@/components/ui/grid-background";
import { Logo } from "@/components/brand/logo";
import {
  getPublicEvents,
  getSiteStats,
  safely,
} from "@/lib/queries/public";
import { getDemoPhotos } from "@/lib/demo-photos";
import { getDictionary, getLocale } from "@/lib/i18n";
import { formatNumber } from "@/lib/utils";

export default async function HomePage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const [events, stats, demoPhotos] = await Promise.all([
    safely(() => getPublicEvents(6), []),
    safely(() => getSiteStats(), { events: 0, photos: 0, faces: 0 }),
    getDemoPhotos(),
  ]);

  const readout = [
    { label: dict.home.statEvents, value: stats.events },
    { label: dict.home.statPhotos, value: stats.photos },
    { label: dict.home.statFaces, value: stats.faces },
  ];

  return (
    <>
      {/* ================================================================= */}
      {/* Brand screen                                                      */}
      {/* ================================================================= */}
      {/* `data-brand-screen` is the flag globals.css keys off to hide the
          header until the visitor scrolls past this screen. */}
      <section
        data-brand-screen
        className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center px-5 py-16 text-center sm:px-8"
      >
        <p
          className="enter inline-block rounded-pill bg-lime-500 px-4 py-1.5 text-label font-semibold text-green-950"
          style={{ "--d": "60ms" } as React.CSSProperties}
        >
          {dict.home.eyebrow}
        </p>

        <h1
          className="enter mt-8"
          style={{ "--d": "160ms" } as React.CSSProperties}
        >
          {/* The wordmark is split across three coloured spans, which a screen
              reader would read as three fragments — so it is hidden and the
              name is announced once, plainly. */}
          <span className="sr-only">{dict.brand.name}</span>
          <span aria-hidden>
            <Logo size="xl" />
          </span>
        </h1>

        <p
          className="enter mt-16 max-w-xl text-body-lg text-slate"
          style={{ "--d": "280ms" } as React.CSSProperties}
        >
          {dict.home.sub}
        </p>

        {/* The way past the story, for anyone who arrived to do rather than
            to read. A real anchor, so it works without JavaScript. */}
        <div
          className="enter mt-10"
          style={{ "--d": "380ms" } as React.CSSProperties}
        >
          <ButtonLink href="#find" size="lg">
            {dict.home.skipToSearch}
          </ButtonLink>
        </div>

        {/* A real anchor, so it also works with JavaScript off and can be
            reached by keyboard. The chevron is aria-hidden — the sentence
            beside it is already the link's accessible name, and "downwards
            arrow" announced after it adds nothing. */}
        <Link
          href="#how"
          className="enter group mt-14 flex flex-col items-center gap-2 rounded-card px-6 py-3 text-label text-slate transition-colors duration-200 hover:text-green-700"
          style={{ "--d": "480ms" } as React.CSSProperties}
        >
          <span>{dict.home.scrollCue}</span>
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-scroll-cue size-6 text-green-600 transition-transform duration-200 group-hover:scale-110"
          >
            <path d="M12 5v13M6 13l6 6 6-6" />
          </svg>
        </Link>
      </section>

      {/* ================================================================= */}
      {/* The journey, or the plain step cards until the photos land        */}
      {/* ================================================================= */}
      {demoPhotos.length > 0 ? (
        <ScrollJourney photos={demoPhotos} dict={dict} />
      ) : (
        <section id="how" className="scroll-mt-20 bg-green-600 text-paper">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <header className="reveal max-w-xl">
              <h2 className="text-h2">{dict.home.stepsTitle}</h2>
              <p className="mt-3 text-green-100">{dict.home.stepsLede}</p>
            </header>

            <ol className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-3 sm:gap-6">
              {dict.home.steps.map((step, i) => (
                <li
                  key={step.label}
                  className="reveal rounded-card bg-green-700 p-6 sm:p-7"
                  style={{ "--rs": `${2 + i * 5}%` } as React.CSSProperties}
                >
                  <span className="tnum inline-flex size-11 items-center justify-center rounded-pill bg-lime-500 font-display text-lg font-bold text-green-950">
                    {i + 1}
                  </span>
                  <h3 className="mt-5 text-h3 text-paper">{step.title}</h3>
                  <p className="mt-2.5 text-body leading-relaxed text-green-100">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* The working part — the skip link's destination                    */}
      {/* ================================================================= */}
      <section
        id="find"
        className="scroll-mt-20 bg-green-600 text-paper"
      >
        <div className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
          <h2 className="text-h2">{dict.home.finderHeading}</h2>
          <p className="mt-3 text-green-100">{dict.home.scanHint}</p>

          {/* The finder renders its own labels in ink for a white card, so it
              sits on paper rather than directly on the green. */}
          <div className="mt-6 rounded-card bg-paper p-5 sm:p-6">
            <EventFinder labels={pickFinderLabels(dict)} />
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
            <Link
              href="/events"
              className="text-label font-medium text-lime-300 underline underline-offset-4 hover:text-paper"
            >
              {dict.home.viewAllEvents}
            </Link>
            <Link
              href="/photographer/apply"
              className="text-label font-medium text-lime-300 underline underline-offset-4 hover:text-paper"
            >
              {dict.home.ctaSecondary}
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Events                                                            */}
      {/* ================================================================= */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        {/* Real figures only, and only once there is something to count. */}
        {stats.photos > 0 && (
          <dl className="reveal mb-14 grid grid-cols-3 gap-4 rounded-card bg-cloud px-6 py-6 sm:gap-8 sm:px-10 sm:py-8">
            {/* dt is authored before dd so a screen reader hears the term
                before its value; flex-col-reverse restores the visual order. */}
            {readout.map((item, i) => (
              <div key={item.label} className="flex flex-col-reverse">
                <dt className="mt-1 text-caption text-slate sm:text-label">
                  {item.label}
                </dt>
                <dd className="tnum font-display text-h2 font-bold text-green-600">
                  <CountUp
                    value={item.value}
                    formatted={formatNumber(item.value, locale)}
                    delayMs={i * 130}
                  />
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div className="reveal flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-h2">{dict.home.eventsTitle}</h2>
          {events.length > 0 && (
            <Link
              href="/events"
              className="text-label font-medium text-green-700 underline underline-offset-4 transition-colors duration-200 hover:text-green-800"
            >
              {dict.home.viewAllEvents}
            </Link>
          )}
        </div>

        {events.length === 0 ? (
          <div className="reveal relative mt-8 overflow-hidden rounded-card bg-cloud px-6 py-16 text-center sm:py-20">
            <GridBackground />
            <div className="relative">
              <p className="font-display text-h3 font-semibold">
                {dict.home.eventsEmpty}
              </p>
              <p className="mx-auto mt-2 max-w-sm text-body text-slate">
                {dict.home.eventsEmptyBody}
              </p>
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
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
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
    </>
  );
}
