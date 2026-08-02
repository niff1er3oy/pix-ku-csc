"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * The brand mark in the header, which has one job: put the visitor back at the
 * top of the home page.
 *
 * It does not get that for free. Measured in Chrome before this existed:
 *
 *   - clicking it while already on `/` did nothing at all, because Next treats
 *     a link to the URL you are already on as a no-op navigation. Scrolled to
 *     2000px, you clicked the logo and stayed at 2000px.
 *   - arriving from another page kept the previous page's scroll offset —
 *     194px coming from `/events`, 1207px from `/privacy`.
 *
 * Neither is what anyone means when they click a logo, so both are handled
 * here rather than left to the router's heuristics.
 *
 * `scrollTo` is called without a `behavior`, which means "use whatever
 * `scroll-behavior` says" — smooth normally, instant for anyone who asked for
 * reduced motion, with no second code path to keep in sync.
 */
export function HomeLink({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  /** Passed in from the server so the mark itself stays server-rendered. */
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const pendingScroll = useRef(false);

  // Runs after the new route has committed, which is the earliest point where
  // scrolling to the top of the *new* page means anything.
  useEffect(() => {
    if (!pendingScroll.current) return;
    pendingScroll.current = false;
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  return (
    <Link
      href="/"
      aria-label={label}
      className={className}
      onClick={(event) => {
        // Ctrl/Cmd/Shift-click means "open this somewhere else". Swallowing it
        // to scroll would take a working browser affordance away.
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }

        if (pathname !== "/") {
          pendingScroll.current = true;
          return;
        }

        event.preventDefault();

        // A leftover `#find` from the skip button would otherwise sit in the
        // address bar and throw the visitor back down the page on reload or
        // when the link is shared.
        if (window.location.hash) {
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
        }

        window.scrollTo({ top: 0, left: 0 });
      }}
    >
      {children}
    </Link>
  );
}
