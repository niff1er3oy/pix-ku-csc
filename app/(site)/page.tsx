/**
 * DIRECTION CONTRACT — landing page (Persuade)
 *
 * THESIS: Event-photo-finder canon with the doors moved up: one scroll under
 * the brand screen sit the code box and the open events, and the story is one
 * stage. Refuses the read-before-you-act explainer.
 *
 * OWN-WORLD: KU teal and lime on white. Event photographs printed in teal ink;
 * yours in full colour inside a lime ring. A green sheet with rounded
 * shoulders, one black stage, K2D over looped Thai.
 *
 * STORY: It finds my photos in the event's pile. Here I type my code or pick
 * my event. This is how it reads my face and what it keeps.
 *
 * FIRST VIEWPORT: Wordmark at brand scale, headline, sub and primary button
 * centred on white; teal-ink photographs scattered round them, one found in
 * colour; the green sheet's edge at the fold.
 *
 * FORM: Canon, owner-pinned. Seed 5bd93810 dealt 6 of 7, the single demo
 * stage, built as the story band. Door-first order is the owner's 2026-10-05
 * answer and outranks the roll.
 */

import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { EventCard } from "@/components/events/event-card";
import { EventFinder } from "@/components/home/event-finder";
import { pickFinderLabels } from "@/components/home/finder-labels";
import { HowItWorks } from "@/components/home/how-it-works";
import { PhotoPile } from "@/components/home/photo-pile";
import { ButtonLink } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import { GridBackground } from "@/components/ui/grid-background";
import { CheckIcon } from "@/components/ui/icon";
import { Phrases } from "@/components/ui/phrases";
import { getDemoPhotos } from "@/lib/demo-photos";
import { getDictionary, getLocale } from "@/lib/i18n";
import {
  getPublicEvents,
  getSiteStats,
  safely,
} from "@/lib/queries/public";
import { cn, formatNumber } from "@/lib/utils";

/* A standalone link, not a link inside a sentence, so it gets the 44px box
   DESIGN.md §8 asks of anything tapped on a phone. */
const textLink =
  "inline-flex min-h-11 items-center text-label font-medium text-green-700 underline underline-offset-4 transition-colors duration-200 hover:text-green-800";

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

  const hasPile = demoPhotos.length > 0;

  return (
    <>
      {/* ================================================================= */}
      {/* Brand screen                                                      */}
      {/* ================================================================= */}
      {/* `data-brand-screen` is the flag globals.css keys off to hide the
          header until the visitor scrolls past this screen.

          `-mt-16` slides the screen up underneath that header. On a browser
          that hides it the pile then runs to the very top of the window; on
          one that does not, the opaque bar simply covers the first 64px.

          Shorter than the window by a few rem on purpose: the green sheet
          below shows its top edge at the fold, which says "the thing you came
          for is right here" better than a scroll cue did. */}
      <section
        data-brand-screen
        className={cn(
          "relative isolate -mt-16 flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center overflow-hidden px-5 pb-10 text-center sm:px-8 lg:min-h-[calc(100svh-4.5rem)] lg:pb-14 lg:pt-20",
          // On a phone the pile hangs in a band across the top, and the
          // wordmark starts below it. `--pile-zone` is that band's height;
          // `PhotoPile` reads the same variable so the two cannot disagree.
          // The band is kept to about a fifth of the screen: the owner asked
          // for the brand screen to stay a brand screen, so the wordmark has
          // to remain the first thing read, with the photographs as a fringe
          // above it. `--header-gap` (globals.css) is the header's height on
          // a browser that shows it over this screen, and nothing otherwise.
          hasPile
            ? "pt-[calc(var(--pile-zone)+var(--header-gap)+1.25rem)] [--pile-zone:clamp(7.5rem,19svh,11rem)] sm:[--pile-zone:clamp(11rem,26svh,18rem)]"
            : "pt-24",
        )}
      >
        {hasPile && (
          <PhotoPile
            photos={demoPhotos}
            foundLabel={dict.home.journeyFound}
            demoLabel={dict.home.demoTag}
          />
        )}

        {/* Narrower on a desktop than the type alone would need: the width is
            counted in the same unit the pile is laid out in, so the copy
            always ends short of the nearest card. */}
        <div className="relative flex w-full max-w-2xl flex-col items-center lg:max-w-[calc(var(--pu)*42)]">
          {/* The mark is the mark, not the heading. An h1 whose accessible name
              is just the brand tells a first-time visitor nothing — the
              sentence that actually explains the product carries it instead. */}
          <div className="enter" style={{ "--d": "60ms" } as React.CSSProperties}>
            <span className="sr-only">{dict.brand.name}</span>
            <span aria-hidden>
              <Logo size="xl" />
            </span>
          </div>

          {/* Left to itself the balancer breaks the Thai headline after "ใน"
              — mid-thought — because that makes the two lines closer in
              length. See `Phrases`. */}
          <h1
            className="enter mt-8 text-h1 font-bold sm:mt-10"
            style={{ "--d": "200ms" } as React.CSSProperties}
          >
            <Phrases text={dict.home.headline} />
          </h1>

          {/* Balanced, not `pretty` like other paragraphs: two centred lines
              of near-equal length sit under a headline better than a full
              line with one stranded word beneath it. */}
          <p
            className="enter mt-4 max-w-xl text-balance text-body-lg text-slate"
            style={{ "--d": "280ms" } as React.CSSProperties}
          >
            {dict.home.sub}
          </p>

          {/* Real anchors, so both work without JavaScript. */}
          <div
            className="enter mt-8 flex flex-col items-center gap-x-5 gap-y-1 sm:flex-row"
            style={{ "--d": "380ms" } as React.CSSProperties}
          >
            <ButtonLink href="#find" size="lg">
              {dict.home.skipToSearch}
            </ButtonLink>
            <Link href="#how" className={cn(textLink, "px-2")}>
              {dict.home.howLink}
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* The door: a code, or an event from the list                       */}
      {/* ================================================================= */}
      {/* A sheet rather than a band: rounded shoulders, pulled up over the
          brand screen's bottom edge so the pile tucks in behind it. It is
          still the page's one full-width green. */}
      <section
        id="find"
        className="relative z-10 -mt-5 scroll-mt-16 rounded-t-card bg-green-600 text-paper"
      >
        <div className="mx-auto grid w-full max-w-6xl gap-x-16 gap-y-6 px-5 pb-12 pt-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:pb-14 lg:pt-10">
          <div className="min-w-0">
            <h2 className="text-h2">{dict.home.finderHeading}</h2>
            <p className="mt-2 text-green-100">{dict.home.scanHint}</p>
          </div>

          {/* The finder renders its own labels in ink for a white card, so it
              sits on paper rather than directly on the green. Tighter side
              padding below `sm` only: the six code boxes inside need every
              pixel of that width to stay at the 44px touch floor on a 360px
              phone. */}
          <div className="min-w-0 rounded-card bg-paper px-4 py-5 text-ink sm:p-6">
            <EventFinder labels={pickFinderLabels(dict)} />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-16">
        <div className="reveal">
          {/* Title and "see all" share a line wherever they fit, which is
              every phone from 360px up; the link is the list's own control,
              so it belongs beside the list's name rather than under the
              figures. */}
          <div className="flex flex-wrap items-center justify-between gap-x-6">
            <h2 className="text-h2">{dict.home.eventsTitle}</h2>
            {/* The count says how many "all" is. A desktop row shows three,
                and without the number nothing tells a visitor whether the
                event they want is one click away or not here at all. */}
            {events.length > 0 && (
              <Link href="/events" className={textLink}>
                {dict.home.viewAllEvents}
                <span className="tnum">
                  &nbsp;({formatNumber(stats.events, locale)})
                </span>
              </Link>
            )}
          </div>

          {/* Real figures only, and only once there is something to count —
              and counted over the same events the list below shows (see
              `getSiteStats`), so the two can never disagree.
              Chips rather than a row of big numerals: they are a footnote to
              the list underneath, not the headline of the page. */}
          {stats.photos > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {readout.map((item, i) => (
                <li
                  key={item.label}
                  className="rounded-pill bg-green-50 px-3 py-1 text-caption font-medium text-green-700"
                >
                  <CountUp
                    value={item.value}
                    formatted={formatNumber(item.value, locale)}
                    delayMs={i * 130}
                    className="tnum font-semibold text-green-800"
                  />{" "}
                  {item.label}
                </li>
              ))}
            </ul>
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
          /* A rail on a phone, a grid from `sm`. Six stacked cards was three
             screens of scrolling before anything else on the page; a rail
             shows the same six in the height of one, and the next card
             peeking in from the right says there is more.

             The bleed (`-mx-5 px-5`) lets a card slide right to the screen
             edge instead of being cut off at the page gutter. The vertical
             padding is room for the shadow and the hover lift, which a
             scroll container would otherwise clip.

             A desktop row is three and a tablet row is two, so the cards
             beyond one row sit out there — "see all" is one line above. */
          <ul className="-mx-5 mt-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-6 pt-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
            {events.map((event, i) => (
              <EventCard
                key={event.id}
                event={event}
                locale={locale}
                dict={dict}
                className={cn(
                  "w-[78%] max-w-xs shrink-0 snap-start only:w-full only:max-w-none sm:w-auto sm:max-w-none",
                  i >= 4 && "sm:hidden",
                  i === 3 && "lg:hidden",
                )}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ================================================================= */}
      {/* How it works — one stage, or the three steps alone until the      */}
      {/* demo photographs are on disk                                      */}
      {/* ================================================================= */}
      <HowItWorks photos={demoPhotos} dict={dict} />

      {/* ================================================================= */}
      {/* Face-data promise — the one claim rivals structurally cannot make */}
      {/* ================================================================= */}
      {/* A ledger, not three cards: each promise on its own ruled line with
          what it means beside it. These are commitments, and a row of tiles
          makes commitments look like features. */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          {/* `self-start`, or the grid stretches this box to the height of the
              whole ledger beside it — and `.reveal` only finishes once its
              box has fully entered the window, so the heading sat at 58%
              opacity while the first promise next to it was already solid. */}
          <div className="reveal min-w-0 self-start">
            <h2 className="text-h2">
              <Phrases text={dict.home.privacyTitle} />
            </h2>
            <Link href="/privacy" className={cn(textLink, "mt-3")}>
              {dict.home.privacyLink}
            </Link>
          </div>

          <ul className="min-w-0 border-t border-edge">
            {dict.home.privacyPoints.map((point, i) => (
              <li
                key={point.title}
                /* Promise and explanation sit side by side wherever the list
                   has the page to itself (`sm`) or shares it comfortably
                   (`xl`). Between the two the heading column takes 24rem off
                   a 1024px window and the explanation was left 209px wide,
                   so there the row stacks. */
                className="reveal grid gap-x-8 gap-y-2 border-b border-edge py-5 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:py-6 lg:grid-cols-1 xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]"
                style={{ "--rs": `${2 + i * 4}%` } as React.CSSProperties}
              >
                <h3 className="flex gap-3 text-h3">
                  {/* Lime under a dark tick, the way DESIGN.md §2 says lime
                      is to be used on white: as a ground, never as the ink.
                      It is the only brand colour between the black band and
                      the photographers' panel. Nudged in `em`, so the dot
                      stays centred on the first line whatever the fluid
                      heading size is. */}
                  <span className="mt-[0.2em] grid size-6 shrink-0 place-items-center rounded-pill bg-lime-500 text-green-950">
                    <CheckIcon size={14} strokeWidth={3} />
                  </span>
                  <span className="min-w-0">
                    <Phrases text={point.title} />
                  </span>
                </h3>
                <p className="text-body text-slate">{point.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Photographers — the page's close                                  */}
      {/* ================================================================= */}
      {/* A deep-green panel, so the page ends on a block of the brand's own
          colour instead of trailing off into white. A panel inside the page
          column, not a second full-width band — DESIGN.md §5 allows one of
          those and `#find` is it.

          No `.reveal` here: the panel is taller than most of a phone screen,
          and a box that only reaches full opacity once all of it is in view
          would have its heading read half faded. */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="relative overflow-hidden rounded-card bg-green-900 px-6 py-10 text-paper sm:px-10 sm:py-12">
          <GridBackground variant="green" />
          <div className="relative grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <h2 className="text-h2">
                <Phrases text={dict.home.photographersTitle} />
              </h2>

              {/* Numbered because it is an order: upload, then watermark,
                  then the QR exists to print. The same lime chips the
                  visitor's three steps wear on the stage above. */}
              <ol className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-6">
                {dict.home.photographersSteps.map((step, i) => (
                  <li key={step} className="flex items-center gap-3">
                    <span className="tnum grid size-8 shrink-0 place-items-center rounded-pill bg-lime-500 font-display text-label font-bold text-green-950">
                      {i + 1}
                    </span>
                    <span className="min-w-0 text-body text-green-100">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="lg:max-w-[16rem] lg:text-right">
              <ButtonLink
                href="/photographer/apply"
                variant="secondary"
                size="lg"
              >
                {dict.photographer.applyTitle}
              </ButtonLink>
              <p className="mt-3 text-balance text-caption text-green-100">
                {dict.home.photographersNote}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
