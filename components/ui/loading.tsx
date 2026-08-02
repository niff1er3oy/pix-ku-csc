import { cn } from "@/lib/utils";

/**
 * Loading primitives.
 *
 * Deliberately *primitives*, not a ready-made page loader. A single shared
 * page-level skeleton is what produced the bug these replaced: one file drew a
 * home-page shape for six routes, so five of them flashed a layout that never
 * arrived. A skeleton is only honest next to the page whose shape it copies,
 * so each route composes its own out of these.
 */

/**
 * One shimmering block. Give it a size with `className`; it has no opinion
 * about anything else.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-shimmer rounded-field", className)}
    />
  );
}

/**
 * Indeterminate progress, for when the shape of what is coming is not known
 * ahead of time — a skeleton there would promise a layout that never lands.
 */
export function LoadingBar({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "h-1.5 w-56 overflow-hidden rounded-pill bg-green-100",
        className,
      )}
    >
      <div className="animate-bar-slide h-full w-1/4 rounded-pill bg-lime-500" />
    </div>
  );
}

/**
 * Wraps any loading UI in the announcement contract DESIGN.md §8 requires:
 * `aria-busy`, a polite live region, and the label read once when it appears.
 *
 * This exists so the contract cannot be forgotten — and so the label is
 * announced exactly once per loading state, rather than once per skeleton
 * block inside it.
 */
export function LoadingRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/**
 * The whole loading state for a route whose layout is unknown or trivial:
 * centred bar plus label. Composed from the primitives above rather than
 * replacing them.
 */
export function LoadingFallback({ label }: { label: string }) {
  return (
    <LoadingRegion
      label={label}
      className="flex min-h-[60svh] flex-col items-center justify-center gap-5 px-5"
    >
      <LoadingBar />
      <p aria-hidden className="text-label text-slate">
        {label}
      </p>
    </LoadingRegion>
  );
}

/**
 * The whole screen, with no site chrome around it — the loading counterpart to
 * `app/error.tsx`.
 *
 * Both of these are states where the page cannot be shown, so both drop the
 * header and footer rather than framing an empty middle with navigation to
 * places that are not there yet. The brand mark carries the orientation the
 * missing header would have: with no navbar on screen, something has to say
 * which site this is.
 *
 * **`fixed inset-0` is what makes this work, not styling.** The obvious way to
 * get a chrome-free loading screen is to put `loading.tsx` beside
 * `app/error.tsx`, above the layout that draws the header. Measured with a
 * genuinely slow server render, that does work on a hard page load and does
 * nothing whatsoever on client navigation — the previous page just sits there
 * for the full four seconds, because a Suspense boundary that is already
 * mounted keeps its content instead of showing a fallback when it re-suspends
 * inside a transition. The boundary has to stay low enough to be mounted fresh
 * for the incoming segment, which means it renders inside the chrome. So this
 * covers the chrome rather than trying to live outside it.
 *
 * `z-50` clears the header's `z-40`.
 *
 * It renders its own `<main id="main">` because it replaces the one in
 * `(site)/layout.tsx` for as long as it is up, and the skip link in
 * `app/layout.tsx` points at that id.
 *
 * `100svh` and not `100vh`: on mobile Safari `vh` counts the address bar's
 * height as if it were not there, which pushes the centred mark below the fold
 * on the one screen that exists only to be glanced at.
 */
export function LoadingScreen({
  label,
  mark,
}: {
  label: string;
  /** The brand mark, passed in so this file keeps no opinion about branding. */
  mark?: React.ReactNode;
}) {
  return (
    <main
      id="main"
      className="fixed inset-0 z-50 flex h-[100svh] flex-col items-center justify-center gap-8 bg-paper px-5"
    >
      {mark ? <div className="opacity-90">{mark}</div> : null}

      <LoadingRegion
        label={label}
        className="flex flex-col items-center gap-5"
      >
        <LoadingBar />
        <p aria-hidden className="text-label text-slate">
          {label}
        </p>
      </LoadingRegion>
    </main>
  );
}

/** The small spinner that sits inside a pending button. */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      className={cn("motion-spinner animate-spin size-[1.15em]", className)}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
