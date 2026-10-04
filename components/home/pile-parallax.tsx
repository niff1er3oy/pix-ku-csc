"use client";

import { useEffect, useRef } from "react";

/**
 * Lets the pile lean a few pixels towards the pointer.
 *
 * Writes two unitless numbers, `--px` and `--py` in -1…1, onto the pile and
 * stops there — each card multiplies them by its own depth in CSS, so the
 * layout stays where the stylesheet put it and this component never touches a
 * transform.
 *
 * Only for a mouse. A touch screen has no pointer resting anywhere, and
 * someone who asked for reduced motion gets the pile exactly as it was laid.
 * It renders nothing visible: the hidden span is only a handle on the pile it
 * was dropped into.
 */
export function PileParallax() {
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const pile = anchor.current?.parentElement;
    const screen = pile?.closest<HTMLElement>("[data-brand-screen]");
    if (!pile || !screen) return;

    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;

    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = screen.getBoundingClientRect();
        const x = ((event.clientX - box.left) / box.width) * 2 - 1;
        const y = ((event.clientY - box.top) / box.height) * 2 - 1;
        pile.style.setProperty("--px", x.toFixed(3));
        pile.style.setProperty("--py", y.toFixed(3));
      });
    };

    const onLeave = () => {
      cancelAnimationFrame(frame);
      pile.style.setProperty("--px", "0");
      pile.style.setProperty("--py", "0");
    };

    screen.addEventListener("pointermove", onMove);
    screen.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(frame);
      screen.removeEventListener("pointermove", onMove);
      screen.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <span ref={anchor} hidden />;
}
