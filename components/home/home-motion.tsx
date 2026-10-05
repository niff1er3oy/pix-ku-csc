"use client";

import {
  animate,
  createScope,
  createTimeline,
  onScroll,
  spring,
  utils,
} from "animejs";
import { useEffect } from "react";

/**
 * The home page's own motion, in anime.js: the "found" moment on the first
 * screen, and what the first screen does as it scrolls away. How the sections
 * after it arrive is not here — that is `SiteMotion`, which every page of
 * the site shares.
 *
 * It renders nothing. It reads the page through data attributes, so the
 * markup stays a Server Component and this file is the only place that knows
 * the first screen moves:
 *
 * - `data-brand-screen` — the first screen
 * - `data-hero-copy`, `data-hero-card`, `data-hero-sweep`, `data-hero-mark`
 *   — its parts (see hero-photos.tsx)
 *
 * **Nothing depends on this having run.** Every element is laid out and
 * visible in the HTML the server sends, the "found" marks on the middle
 * photograph included. This script only ever hides something it is about to
 * animate back in — those marks, a moment before the sweep — so a visitor
 * whose bundle is slow, or never arrives, has the whole screen, standing
 * still.
 *
 * anime.js takes no notice of `prefers-reduced-motion` on its own, so this
 * checks first and does nothing at all when it is set.
 */
export function HomeMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const screen = document.querySelector<HTMLElement>("[data-brand-screen]");

    // The one thing anime.js cannot undo for itself: a timer still pending.
    let stopWaiting: (() => void) | undefined;

    const scope = createScope().add(() => {
      if (screen) {
        stopWaiting = heroFound(screen);
        heroScroll(screen);
      }
    });

    return () => {
      stopWaiting?.();
      // Hands every element back the way the server sent it.
      scope.revert();
    };
  }, []);

  return null;
}

/**
 * The sweep crosses the three photographs and finds you in the middle one.
 *
 * Plays once the entrance has settled, and again whenever the first screen is
 * scrolled back to — it is the product's one trick, and worth seeing twice.
 * The label lands on a spring: DESIGN.md §6 keeps overshoot for the moment
 * something is actually being celebrated, and "found you" is that moment.
 */
function heroFound(screen: HTMLElement) {
  const row = screen.querySelector<HTMLElement>("[data-hero-photos]");
  const sweep = screen.querySelector<HTMLElement>("[data-hero-sweep]");
  const found = screen.querySelector<HTMLElement>("[data-hero-found]");
  if (!row || !sweep || !found) return;

  const mark = (name: string) =>
    screen.querySelector<HTMLElement>(`[data-hero-mark="${name}"]`);
  const ring = mark("ring");
  const you = mark("you");
  const label = mark("label");

  // The server sent the marks already in place. Take them off now, while the
  // card they sit on is still fading in, so that the sweep has something to
  // find. If this runs late the visitor watches a finished picture be found
  // a second time, which is no worse than watching it be found once.
  utils.set([ring, you, label].filter(Boolean) as HTMLElement[], { opacity: 0 });

  const timeline = createTimeline({ autoplay: false, defaults: { ease: "out(3)" } })
    .add(
      sweep,
      {
        left: ["-5%", "100%"],
        opacity: [
          { to: 1, duration: 160, ease: "linear" },
          { to: 1, duration: 980, ease: "linear" },
          { to: 0, duration: 220, ease: "linear" },
        ],
        duration: 1360,
        ease: "inOutSine",
      },
      0,
    )
    // The line is over the middle card at about the halfway mark. A lift of
    // 4%, no more: with its ring, anything larger reaches the photographs
    // either side on a phone, and nothing on this screen may overlap.
    .add(
      found,
      { scale: [1, 1.04], y: [0, -4], ease: spring({ stiffness: 260, damping: 16 }) },
      640,
    );

  if (ring) timeline.add(ring, { opacity: [0, 1], scale: [1.1, 1], duration: 360 }, 660);
  if (you) timeline.add(you, { opacity: [0, 1], scale: [1.9, 1], duration: 320 }, 800);
  if (label) {
    timeline.add(
      label,
      {
        opacity: { to: 1, duration: 180, ease: "linear" },
        scale: [0.5, 1],
        y: [8, 0],
        ease: spring({ stiffness: 340, damping: 13 }),
      },
      900,
    );
  }

  // Not before the cards have finished arriving (their CSS entrance ends at
  // about 1.1s), and not while the screen is out of view.
  let first = window.setTimeout(() => timeline.play(), 1250);

  onScroll({
    target: screen,
    onEnterBackward: () => {
      window.clearTimeout(first);
      first = 0;
      timeline.restart();
    },
  });

  return () => window.clearTimeout(first);
}

/**
 * As the first screen scrolls away the copy drifts up and thins out, and the
 * three photographs part — the outer two swing wide, the middle one rises.
 * Tied to the scroll position rather than played, so it runs backwards on the
 * way back up and stops wherever the thumb stops.
 *
 * Each of these moves an outer wrapper. The elements inside carry the CSS
 * entrance, and a finished CSS animation still outranks an inline style on
 * the property it animated — put both on one element and this would silently
 * do nothing.
 */
function heroScroll(screen: HTMLElement) {
  const copy = screen.querySelector<HTMLElement>("[data-hero-copy]");
  const card = (name: string) =>
    screen.querySelector<HTMLElement>(`[data-hero-card="${name}"]`);
  const left = card("left");
  const found = card("found");
  const right = card("right");
  const cue = screen.querySelector<HTMLElement>("[data-hero-cue]");

  const timeline = createTimeline({
    defaults: { ease: "linear", duration: 1000 },
    autoplay: onScroll({
      target: screen,
      // From the moment the page starts to move until the screen has gone.
      enter: { container: "top", target: "top" },
      leave: { container: "top", target: "bottom" },
      sync: 0.35,
    }),
  });

  // On a phone the outer photographs sit 8px from the edges of the screen, so
  // they can only swing a little before the edge cuts into them; on anything
  // wider there is room to part properly.
  const swing = window.matchMedia("(min-width: 40rem)").matches ? 14 : 5;

  if (copy) timeline.add(copy, { y: -48, opacity: 0.15 }, 0);
  if (left) timeline.add(left, { x: `-${swing}%`, y: -18, rotate: -7 }, 0);
  if (right) timeline.add(right, { x: `${swing}%`, y: -18, rotate: 7 }, 0);
  if (found) timeline.add(found, { y: -56, scale: 1.05 }, 0);
  if (cue) timeline.add(cue, { opacity: 0, duration: 180 }, 0);

  // A nudge that there is more below — three times, then it rests. A cue that
  // never stops bouncing is motion nobody can turn off.
  if (cue) {
    animate(cue.firstElementChild ?? cue, {
      y: [0, 7, 0],
      duration: 1500,
      delay: 2600,
      loop: 2,
      loopDelay: 500,
      ease: "inOutSine",
    });
  }
}
