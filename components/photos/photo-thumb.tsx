import { ViewTransition, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PhotoThumbProps = {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  /** `square` for the photographer's own grid; `wide` (4:3) everywhere a visitor sees the photo. */
  aspect?: "square" | "wide";
  /** `frame` is a plain ringed thumbnail; `card` adds the paper background and shadow a `footer` sits inside. */
  variant?: "frame" | "card";
  /** Unique per photo. Wraps the image so a gallery can transition it into a detail view; omit where there is nothing to transition into. */
  viewTransitionName?: string;
  /** Small overlay pinned to the image's top-right corner — a failed-index flag, for instance. */
  badge?: ReactNode;
  /** Content below the image, inside the same card. Only meaningful with `variant="card"`. */
  footer?: ReactNode;
  /** Turns the image into a button — a gallery opens its lightbox from here. The `footer`, if any, stays outside the button so a download link inside it never nests inside another interactive element. */
  onClick?: () => void;
  className?: string;
};

/**
 * One photo thumbnail, everywhere the app shows one: the photographer's own
 * grid, the public gallery, and face-search results. The three used to each
 * hand-roll their own `<img>` with slightly different classes, which is how
 * a missing `loading="lazy"` or a drifted aspect ratio ends up on only one
 * of them without anyone noticing.
 */
export function PhotoThumb({
  src,
  alt = "",
  width,
  height,
  aspect = "wide",
  variant = "frame",
  viewTransitionName,
  badge,
  footer,
  onClick,
  className,
}: PhotoThumbProps) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      width={width}
      height={height}
      className={cn(
        "h-full w-full object-cover",
        aspect === "square" ? "aspect-square" : "aspect-[4/3]",
      )}
    />
  );

  const frame = (
    <div
      className={cn(
        "relative overflow-hidden",
        variant === "frame" && "rounded-media bg-cloud ring-1 ring-edge",
      )}
    >
      {img}
      {badge && <span className="absolute right-1 top-1">{badge}</span>}
    </div>
  );

  const photo = viewTransitionName ? (
    <ViewTransition name={viewTransitionName}>{frame}</ViewTransition>
  ) : (
    frame
  );

  const content = onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "block w-full cursor-zoom-in text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2",
        variant === "frame" && "rounded-media",
      )}
    >
      {photo}
    </button>
  ) : (
    photo
  );

  if (variant !== "card") return <div className={className}>{content}</div>;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card bg-paper shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {content}
      {footer}
    </div>
  );
}
