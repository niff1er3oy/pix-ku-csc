"use client";

import { useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { PhotoLightbox, type LightboxLabels } from "@/components/photos/photo-lightbox";
import { PhotoThumb } from "@/components/photos/photo-thumb";
import { cn } from "@/lib/utils";

export type PhotoGalleryItem = {
  id: string;
  thumbSrc: string;
  previewSrc: string;
  width?: number;
  height?: number;
  alt?: string;
  badge?: ReactNode;
  footer?: ReactNode;
  /** Extra detail shown in the lightbox next to the "n / total" counter —
   *  see `LightboxPhoto.meta`. */
  meta?: ReactNode;
  /** Omit to hide the download button for this photo in the lightbox. */
  downloadHref?: string;
  /** A delete control for this one photo in the lightbox — see
   *  `LightboxPhoto.deleteAction`. */
  deleteAction?: ReactNode;
  /** A save/unsave toggle for this one photo in the lightbox — see
   *  `LightboxPhoto.saveAction`. */
  saveAction?: ReactNode;
  viewTransitionName?: string;
  /** A selection checkbox, typically — see `PhotoThumb`'s `select` prop. */
  select?: ReactNode;
  /** See `PhotoThumb`'s `onLongPress` prop. */
  onLongPress?: () => void;
  /** A quick per-photo download link — see `PhotoThumb`'s `download` prop. */
  download?: ReactNode;
};

/**
 * A grid of `PhotoThumb`s that opens a shared `PhotoLightbox` on click — the
 * photographer's own grid, the public gallery, and face-search results all
 * render through this rather than each owning separate open/close state.
 */
export function PhotoGallery({
  items,
  aspect = "wide",
  variant = "frame",
  gridClassName = "grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4",
  labels,
  className,
  trailingItem,
}: {
  items: PhotoGalleryItem[];
  aspect?: "square" | "wide";
  variant?: "frame" | "card";
  gridClassName?: string;
  labels: LightboxLabels;
  className?: string;
  /** One more grid cell after the last photo — a "load more" tile, say,
   *  rather than a button sitting below the whole grid. Rendered
   *  unconditionally so a caller can still anchor scroll position to it
   *  even on the render where it has nothing to show. */
  trailingItem?: ReactNode;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Plain `setState` never activates a `<ViewTransition>` pairing at all —
  // React only tries to match an exiting name against an entering one
  // inside an actual Transition. Outside of one, the grid's copy and the
  // lightbox's copy are just two ordinary elements that happen to share a
  // `name`, which is exactly what trips the "two components with the same
  // name" error the instant the lightbox opens. `startTransition` is what
  // turns this into the shared-element morph it was always meant to be.
  const [, startTransition] = useTransition();
  const open = (index: number | null) => startTransition(() => setOpenIndex(index));

  return (
    <>
      <ul className={cn("grid", gridClassName, className)}>
        {items.map((item, i) => (
          <li key={item.id}>
            <PhotoThumb
              src={item.thumbSrc}
              alt={item.alt}
              width={item.width}
              height={item.height}
              aspect={aspect}
              variant={variant}
              badge={item.badge}
              footer={item.footer}
              select={item.select}
              download={item.download}
              onLongPress={item.onLongPress}
              // The lightbox mounts its own `ViewTransition` with this same
              // name for whichever photo is open — the grid's copy steps
              // aside for exactly that one photo while it is open, and
              // `open` above is what lets React pair the two up instead of
              // seeing a collision.
              viewTransitionName={i === openIndex ? undefined : item.viewTransitionName}
              onClick={() => open(i)}
            />
          </li>
        ))}
        {trailingItem && <li>{trailingItem}</li>}
      </ul>

      {openIndex !== null &&
        // Portalled straight to `document.body` rather than rendered inline.
        // `fixed inset-0` only covers the viewport if nothing between it and
        // `<body>` establishes its own containing block — and an ancestor
        // with an active `transform` animation (a `.reveal` section, say)
        // does exactly that, trapping the lightbox inside that section's
        // box instead of the screen. A portal sidesteps the question
        // entirely: whatever wraps the grid on any given page, the lightbox
        // is never a descendant of it.
        createPortal(
          <PhotoLightbox
            photos={items.map((item) => ({
              id: item.id,
              src: item.previewSrc,
              alt: item.alt,
              width: item.width,
              height: item.height,
              downloadHref: item.downloadHref,
              viewTransitionName: item.viewTransitionName,
              meta: item.meta,
              deleteAction: item.deleteAction,
              saveAction: item.saveAction,
            }))}
            index={openIndex}
            onClose={() => open(null)}
            onNavigate={open}
            labels={labels}
          />,
          document.body,
        )}
    </>
  );
}
