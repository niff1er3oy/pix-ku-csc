"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The HUD readout counts up the way a camera's frame counter does.
 *
 * The finished number is rendered on the server and used as the initial state,
 * so the correct figure is in the HTML for search engines and for anyone with
 * JavaScript off or reduced motion on. The animation only ever replaces a
 * number that was already right.
 */
export function CountUp({
  value,
  formatted,
  durationMs = 1100,
  delayMs = 0,
  className,
}: {
  value: number;
  /** Server-formatted final value — also the no-JS and reduced-motion output. */
  formatted: string;
  durationMs?: number;
  delayMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(formatted);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (value <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const node = ref.current;
    if (!node) return;

    let frame = 0;
    let timer = 0;
    const format = new Intl.NumberFormat(
      document.documentElement.lang === "th" ? "th-TH" : "en-GB",
    );

    // Only start once the readout is actually on screen.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        timer = window.setTimeout(() => {
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min(1, (now - start) / durationMs);
            // Ease out: fast at first, settling onto the final figure.
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(format.format(Math.round(value * eased)));
            if (progress < 1) frame = requestAnimationFrame(step);
          };
          frame = requestAnimationFrame(step);
        }, delayMs);
      },
      { threshold: 0.4 },
    );

    // Deliberately NOT reset to zero here. If the readout sits below the fold
    // and the visitor never scrolls to it, the observer never fires — and a
    // pre-zeroed value would leave a permanently wrong number on screen. The
    // count starts from zero inside the observer callback instead.
    observer.observe(node);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [value, durationMs, delayMs]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
