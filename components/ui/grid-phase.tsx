"use client";

import { useEffect, useRef } from "react";

/**
 * Puts a drifting grid on the page's shared clock.
 *
 * Every grid that is meant to line up with its neighbours runs the same
 * keyframes for the same length of time — but a CSS animation counts from the
 * moment its element appeared. The grid in the root layout appears once and
 * keeps going; the grids inside a page's own sections appear again on every
 * client-side visit to that page, later than the first. Same speed, different
 * start: the lines sit a few pixels apart and cross each section boundary
 * with a step in them.
 *
 * Setting `startTime` to zero ties the animation to the document's own
 * timeline rather than to its birth, so every grid that does this is at the
 * same point of the same loop no matter when it was mounted.
 *
 * On a first page load all of them start together anyway, so nothing depends
 * on this script having run — it only matters after a navigation, which
 * needed script to happen at all.
 */
export function GridPhase() {
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const layer = anchor.current?.parentElement?.querySelector(".grid-drift");
    for (const animation of layer?.getAnimations() ?? []) {
      animation.startTime = 0;
    }
  }, []);

  return <span ref={anchor} hidden />;
}
