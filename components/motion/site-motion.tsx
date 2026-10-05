"use client";

import { animate, createScope, onScroll, stagger, utils } from "animejs";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * How sections arrive as a page is scrolled, for every page of the site, in
 * anime.js.
 *
 * A page opts an element in with an attribute and writes no script:
 *
 * - `data-reveal` — the element rises a little and fades in when its top edge
 *   comes into the window.
 * - `data-reveal="group"` — its children do, one after another. For a short
 *   row or list of like things: a handful of cards, three steps.
 *
 * That is the whole vocabulary, on purpose. One movement, one easing, the
 * same on every page, is what makes the site feel like one thing; a page that
 * wants something of its own (the home page's first screen) writes it beside
 * its own markup and leaves this alone.
 *
 * **Nothing depends on this having run.** The server sends every element
 * visible and in place. This only hides what it is about to bring back in and
 * what is still below the fold, so a visitor whose bundle is slow, or never
 * arrives, has the whole page, standing still. Anything already on screen
 * when it runs — a reload half-way down, a jump to an anchor, content that
 * streamed in over a skeleton — is left exactly as it is: hiding it first
 * would make something the visitor is looking at blink.
 *
 * What not to put it on:
 *
 * - Anything on the first screen. That enters with the stylesheet's `.enter`,
 *   which is there before any script is.
 * - A long, data-driven list — a gallery, a table's rows. Revealing hundreds
 *   of items one by one is waiting, not arriving. Reveal the section's
 *   heading, or the list as a single block.
 * - An element that holds an `aligned` `GridBackground`, or any ancestor of
 *   one. The reveal moves its element with a transform, and a transformed box
 *   becomes the containing block for the grid's fixed layer, which then stops
 *   being the page's grid. Put it on the content inside instead.
 *
 * anime.js takes no notice of `prefers-reduced-motion` on its own, so this
 * checks first and does nothing at all when it is set.
 */
export function SiteMotion() {
  // The layout this sits in survives a navigation, so the effect has to be
  // told when the page under it changes.
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const seen = new WeakSet<Element>();
    const scope = createScope();
    const scan = () => scope.add(() => register(seen));

    scan();

    // Content that streams in after the first paint — a page behind a
    // `loading.tsx`, a list re-rendered by a search — brings new elements
    // with it. One scan per frame at most, however much arrives.
    let queued = 0;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        scan();
      });
    });
    const main = document.getElementById("main");
    if (main) observer.observe(main, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(queued);
      // Hands every element back the way the server sent it.
      scope.revert();
    };
  }, [pathname]);

  return null;
}

function register(seen: WeakSet<Element>) {
  for (const target of document.querySelectorAll<HTMLElement>("[data-reveal]")) {
    if (seen.has(target)) continue;
    seen.add(target);

    // Already in view: leave it be.
    if (target.getBoundingClientRect().top < window.innerHeight * 0.92) continue;

    const items =
      target.dataset.reveal === "group"
        ? (Array.from(target.children) as HTMLElement[])
        : [target];
    if (items.length === 0) continue;

    utils.set(items, { opacity: 0, y: 26 });

    const arrival = animate(items, {
      opacity: 1,
      y: 0,
      duration: 720,
      delay: stagger(85),
      ease: "out(4)",
      autoplay: false,
    });

    // Started by the observer, not linked to it. A linked animation is paused
    // again the moment its target leaves the window, so a section passed in
    // one fast flick — or skipped by an in-page jump — would be left part-way
    // in, and still be part-way in when the visitor came back. Once it
    // starts, it finishes.
    let arrived = false;
    onScroll({
      target,
      // When its top edge is a little way into the window.
      enter: { container: "bottom-=9%", target: "top" },
      onEnter: () => {
        if (arrived) return;
        arrived = true;
        arrival.play();
      },
    });
  }
}
