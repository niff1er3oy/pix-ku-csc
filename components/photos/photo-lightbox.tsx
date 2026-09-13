"use client";

import { useEffect, useRef, ViewTransition, type ReactNode } from "react";

import { buttonClass } from "@/components/ui/button";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DownloadIcon,
  PhotoIcon,
} from "@/components/ui/icon";

export type LightboxPhoto = {
  id: string;
  /** Null while still processing — see `PhotoThumb`'s own `src`. Reachable
   *  here even though the grid never opens one directly (`onClick` is
   *  omitted for those thumbnails): stepping through the set with the arrow
   *  keys has no such gate, since `hasNext`/`hasPrev` only check position. */
  src: string | null;
  alt?: string;
  width?: number;
  height?: number;
  /** Omit to hide the download button for this photo. */
  downloadHref?: string;
  viewTransitionName?: string;
  /** Extra detail shown next to the "n / total" counter — the studio grid
   *  uses this for a photo's face count and indexing status; other galleries
   *  have nothing of their own to say here and just omit it. */
  meta?: ReactNode;
  /** A delete control for this one photo, shown beside the download link —
   *  the studio grid's own delete button, submitting into its form via the
   *  `form="…"` attribute since this renders through a portal outside that
   *  form's DOM. Other galleries show someone else's photos and omit it. */
  deleteAction?: ReactNode;
  /** A save/unsave toggle for this one photo, shown beside the download
   *  link — face search results use this; other galleries have nothing to
   *  save here and omit it. */
  saveAction?: ReactNode;
};

export type LightboxLabels = {
  close: string;
  previous: string;
  next: string;
  download: string;
};

/**
 * The full-size view a grid opens into. One instance is shared by every photo
 * in the set rather than mounted per-thumbnail, so `index` — not visibility —
 * is what changes as somebody steps through a hundred photos.
 */
export function PhotoLightbox({
  photos,
  index,
  onClose,
  onNavigate,
  labels,
}: {
  photos: LightboxPhoto[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  labels: LightboxLabels;
}) {
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  // Scrolling the page behind a full-screen photo makes the photo look stuck
  // rather than on top of it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft" && hasPrev) onNavigate(index - 1);
      else if (event.key === "ArrowRight" && hasNext) onNavigate(index + 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, hasPrev, hasNext, onClose, onNavigate]);

  // Touch-swipe stepping through the set — the desktop-only arrow keys above
  // had no phone equivalent beyond the two 44px chevrons pinned to the
  // screen edges, which asks for real precision one-handed in a crowd.
  // Plain pointer events rather than a gesture library, mirroring
  // `PhotoThumb`'s own long-press tracking: a horizontal-drag check against
  // `touchStart` on pointer up, so a mostly-vertical drag (or a pinch-zoom,
  // which never fires a single pointer's up past the threshold on its own)
  // is left alone rather than misread as "go to the next photo."
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const SWIPE_THRESHOLD_PX = 50;

  function onPointerDown(event: React.PointerEvent) {
    if (event.pointerType !== "touch") return;
    touchStart.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: React.PointerEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || event.pointerType !== "touch") return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;

    if (dx > 0 && hasPrev) onNavigate(index - 1);
    else if (dx < 0 && hasNext) onNavigate(index + 1);
  }

  if (!photo) return null;

  const image = photo.src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.src}
      alt={photo.alt ?? ""}
      width={photo.width}
      height={photo.height}
      className="max-h-[85vh] max-w-full rounded-card object-contain"
    />
  ) : (
    <div className="grid aspect-[4/3] max-h-[85vh] w-full max-w-2xl place-items-center gap-2 rounded-card bg-cloud/10">
      <PhotoIcon size={32} className="text-paper/60" />
      <span aria-hidden className="animate-pulse-dot size-2 rounded-pill bg-paper/60" />
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="modal-backdrop fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink/90 p-4 sm:p-8"
      onClick={onClose}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={labels.close}
        className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-pill bg-paper/10 text-paper transition-colors duration-200 hover:bg-paper/20"
      >
        <CloseIcon size={22} />
      </button>

      {hasPrev && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onNavigate(index - 1);
          }}
          aria-label={labels.previous}
          className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-pill bg-paper/10 text-paper transition-colors duration-200 hover:bg-paper/20 sm:left-4"
        >
          <ChevronLeftIcon size={24} />
        </button>
      )}

      {hasNext && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onNavigate(index + 1);
          }}
          aria-label={labels.next}
          className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-pill bg-paper/10 text-paper transition-colors duration-200 hover:bg-paper/20 sm:right-4"
        >
          <ChevronRightIcon size={24} />
        </button>
      )}

      {/* Stops the backdrop's onClose from firing when the click lands on the
          photo itself or the toolbar under it. */}
      <div
        className="modal-content flex max-w-full flex-col items-center gap-4"
        onClick={(event) => event.stopPropagation()}
      >
        {photo.viewTransitionName ? (
          <ViewTransition name={photo.viewTransitionName}>{image}</ViewTransition>
        ) : (
          image
        )}

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <span className="tnum text-caption text-paper/70">
            {index + 1} / {photos.length}
          </span>
          {photo.downloadHref && (
            // `buttonClass` rather than a hand-rolled pill — this now sits
            // beside `photo.deleteAction`, itself a real `<Button>`, and the
            // two only read as a matched pair (both `size="sm"`, both real
            // pill buttons) if this one is built from the same styles.
            <a
              href={photo.downloadHref}
              className={buttonClass({ variant: "primary", size: "sm" })}
            >
              <DownloadIcon size={16} />
              {labels.download}
            </a>
          )}
          {photo.saveAction}
          {photo.deleteAction}
        </div>
      </div>
    </div>
  );
}
