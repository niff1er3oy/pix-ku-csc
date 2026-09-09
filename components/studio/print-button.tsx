"use client";

/**
 * Opens the browser's print dialogue for the sheet this sits on.
 *
 * A real client-side button rather than the page's old `<a href="#">` plus
 * an inline `<script dangerouslySetInnerHTML>` wiring up a click listener —
 * that pattern only exists to correct DOM content before first paint (see
 * "Preventing flash before hydration" in the Next.js docs), which is not
 * this: there is no content to get right before hydration, only a click to
 * handle, and this version of Next.js warns on a bare `<script>` rendered
 * from a Server Component regardless. Without JavaScript the button simply
 * does nothing — the browser's own File → Print still opens the same sheet,
 * since this page has no chrome to strip for print either way.
 */
export function PrintButton({
  label,
  className,
  style,
}: {
  label: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={className}
      style={style}
    >
      {label}
    </button>
  );
}
