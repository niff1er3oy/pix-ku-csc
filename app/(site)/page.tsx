/**
 * DIRECTION CONTRACT — landing page (Persuade)
 *
 * THESIS: Event-photo-finder canon with the doors moved up: one scroll under
 * the brand screen sit the code box and the open events, and the story is one
 * stage. Refuses the read-before-you-act explainer.
 *
 * OWN-WORLD: KU teal and lime on white, and one grid drawn through every
 * surface — white, green, black. Photographs whole and in their own colours;
 * yours inside a lime ring. A green sheet with rounded shoulders, one black
 * stage, a deep-green closing panel, K2D over looped Thai.
 *
 * STORY: It finds my photos among the event's. Here I type my code or pick my
 * event. This is how it reads my face and what it keeps.
 *
 * FIRST VIEWPORT: One full window. Wordmark at brand scale, headline, sub and
 * primary button centred; under them a row of three event photographs, the
 * middle one found. Phone first: everything on it whole, nothing cut.
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
import { HeroPhotos } from "@/components/home/hero-photos";
import { HomeMotion } from "@/components/home/home-motion";
import { HowItWorks } from "@/components/home/how-it-works";
import { ButtonLink } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import { GridBackground } from "@/components/ui/grid-background";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/icon";
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

/**
 * A note on how this page moves.
 *
 * What is on the first screen arrives with the stylesheet's own `.enter`, so
 * it is there before any script is. Everything after that is anime.js: the
 * "found" moment on the photographs and the first screen parting as it
 * scrolls away are this page's own (`HomeMotion`); each section arriving as
 * it is reached is the site's (`SiteMotion`, in the layout). Elements opt in
 * to that with `data-reveal` (or `data-reveal="group"` to bring their
 * children in one after another) — and are fully visible without it.
 *
 * One rule for whoever edits this: never put `data-reveal` on an element that
 * holds an `aligned` `GridBackground`. The reveal moves its element with a
 * transform, and a transformed box becomes the containing block for the
 * grid's fixed layer — which then stops being the page's grid and becomes a
 * patch of its own, out of line with everything around it. Put it on the
 * content inside instead.
 */
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
          header until the visitor scrolls past this screen.

          Exactly one window tall, on every device — the owner's instruction
          after a version that stopped short to let the next section show.
          `-mt-16` slides it up underneath the header so that "one window"
          means the window and not the window less a bar; `--header-gap` puts
          those 64px back as padding on a browser that shows the bar here.

          Laid out for a phone first. Every vertical gap and both paddings
          flex with the window's height, because a phone with its toolbars up
          has about 550px to give and all of this still has to be on it. A
          phone on its side has under 400, and there the stack becomes two
          columns — see the landscape rule beside `.hero-photos` in
          globals.css.

          `overflow-x-clip`: as the screen scrolls away the outer photographs
          swing outwards, past the edge on a phone. Clipped here they are
          simply cut off; left to spill they made the whole page wider than
          the window, and a phone answers that by zooming everything out. */}
      <section
        data-brand-screen
        className="relative -mt-16 flex min-h-svh flex-col items-center justify-center overflow-x-clip px-5 pb-[clamp(0.75rem,3svh,2.5rem)] pt-[calc(var(--header-gap)+clamp(0.5rem,2svh,1.25rem))] text-center sm:px-8"
      >
        {/* The copy moves as one piece when the screen scrolls away; the
            entrance is on the elements inside, so the two never share a
            transform. It never shrinks: when the window is short it is the
            photographs under it that give way (`.hero-slot`). */}
        <div
          data-hero-copy
          className="flex w-full max-w-2xl shrink-0 flex-col items-center"
        >
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
            className="enter mt-[clamp(0.75rem,4svh,2.5rem)] text-h1 font-bold"
            style={{ "--d": "200ms" } as React.CSSProperties}
          >
            <Phrases text={dict.home.headline} />
          </h1>

          {/* Balanced, not `pretty` like other paragraphs: two centred lines
              of near-equal length sit under a headline better than a full
              line with one stranded word beneath it. */}
          <p
            className="enter mt-[clamp(0.5rem,2svh,1.25rem)] max-w-xl text-balance text-body-lg text-slate"
            style={{ "--d": "280ms" } as React.CSSProperties}
          >
            {dict.home.sub}
          </p>

          {/* Real anchors, so both work without JavaScript. The second one
              steps aside on a short, narrow window — a phone with its
              toolbars up, or on its side — where it sits under the button
              and would be what pushes the photographs under the fold. On a
              short laptop window it sits beside the button, costs no height,
              and stays. The section it points to is one scroll away either
              way. */}
          <div
            className="enter mt-[clamp(0.75rem,3.5svh,2.5rem)] flex flex-col items-center gap-x-5 gap-y-1 sm:flex-row"
            style={{ "--d": "380ms" } as React.CSSProperties}
          >
            <ButtonLink href="#find" size="lg">
              {dict.home.skipToSearch}
            </ButtonLink>
            <Link
              href="#how"
              className={cn(
                textLink,
                "px-2 [@media(max-height:620px)_and_(max-width:1023px)]:hidden",
              )}
            >
              {dict.home.howLink}
            </Link>
          </div>
        </div>

        <HeroPhotos
          photos={demoPhotos}
          foundLabel={dict.home.journeyFound}
          demoLabel={dict.home.demoTag}
        />

        {/* With the screen a full window tall, nothing of the next section
            shows. This says there is one. Decorative — the button above is
            the real way down — and only where there is height to spare. */}
        <span
          data-hero-cue
          aria-hidden
          className="absolute bottom-2 left-1/2 -translate-x-1/2 text-green-600 [@media(max-height:739px)]:hidden"
        >
          <span className="block">
            <ChevronDownIcon size={22} strokeWidth={2.5} />
          </span>
        </span>
      </section>

      {/* ================================================================= */}
      {/* The door: a code, or an event from the list                       */}
      {/* ================================================================= */}
      {/* The page's one full-width green. Rounded shoulders, so it reads as a
          sheet coming up rather than a stripe. The `clip-path` matches that
          shape and is there for the grid — see `GridBackground`. */}
      <section
        id="find"
        className="relative scroll-mt-16 rounded-t-card bg-green-600 text-paper [clip-path:inset(0_round_var(--radius-card)_var(--radius-card)_0_0)]"
      >
        <GridBackground aligned variant="green" />

        <div className="relative mx-auto grid w-full max-w-6xl gap-x-16 gap-y-6 px-5 pb-12 pt-9 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:pb-14 lg:pt-12">
          <div data-reveal className="min-w-0">
            <h2 className="text-h2">{dict.home.finderHeading}</h2>
            <p className="mt-2 text-green-100">{dict.home.scanHint}</p>
          </div>

          {/* The finder renders its own labels in ink for a white card, so it
              sits on paper rather than directly on the green. Tighter side
              padding below `sm` only: the six code boxes inside need every
              pixel of that width to stay at the 44px touch floor on a 360px
              phone. */}
          <div
            data-reveal
            className="min-w-0 rounded-card bg-paper px-4 py-5 text-ink sm:p-6"
          >
            <EventFinder labels={pickFinderLabels(dict)} />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-16">
        <div data-reveal>
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
          <div className="relative mt-8 rounded-card bg-cloud px-6 py-16 text-center sm:py-20 [clip-path:inset(0_round_var(--radius-card))]">
            <GridBackground aligned />
            <div data-reveal className="relative">
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
          <ul
            data-reveal="group"
            className="-mx-5 mt-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-6 pt-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3"
          >
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
              whole ledger beside it and it arrives as one tall block. */}
          <div data-reveal className="min-w-0 self-start">
            <h2 className="text-h2">
              <Phrases text={dict.home.privacyTitle} />
            </h2>
            <Link href="/privacy" className={cn(textLink, "mt-3")}>
              {dict.home.privacyLink}
            </Link>
          </div>

          <ul data-reveal="group" className="min-w-0 border-t border-edge">
            {dict.home.privacyPoints.map((point) => (
              <li
                key={point.title}
                /* Promise and explanation sit side by side wherever the list
                   has the page to itself (`sm`) or shares it comfortably
                   (`xl`). Between the two the heading column takes 24rem off
                   a 1024px window and the explanation was left 209px wide,
                   so there the row stacks. */
                className="grid gap-x-8 gap-y-2 border-b border-edge py-5 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:py-6 lg:grid-cols-1 xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]"
              >
                <h3 className="flex gap-3 text-h3">
                  {/* Lime under a dark tick, the way DESIGN.md §2 says lime
                      is to be used on white: as a ground, never as the ink.
                      Nudged in `em`, so the dot stays centred on the first
                      line whatever the fluid heading size is. */}
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
          those and `#find` is it. The panel itself never moves: it holds the
          grid (see the note above `HomePage`), so the reveal is on what is
          inside it. */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="relative rounded-card bg-green-900 px-6 py-10 text-paper sm:px-10 sm:py-12 [clip-path:inset(0_round_var(--radius-card))]">
          <GridBackground aligned variant="green" />
          <div
            data-reveal="group"
            className="relative grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
          >
            <div className="min-w-0">
              <h2 className="text-h2">
                <Phrases text={dict.home.photographersTitle} />
              </h2>

              {/* Numbered because it is an order: upload, then watermark,
                  then the QR exists to print. The same lime chips the
                  visitor's three steps wear on the stage above.

                  A wrapping row rather than three equal columns: each step is
                  as wide as its own words, so none of them breaks mid-phrase
                  to fit a column the other two do not need. */}
              <ol className="mt-6 flex flex-col gap-x-8 gap-y-3 sm:flex-row sm:flex-wrap">
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

      <HomeMotion />
    </>
  );
}
