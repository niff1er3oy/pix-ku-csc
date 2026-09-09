"use client";

import { useEffect, ViewTransition, type ReactNode } from "react";

import { buttonClass } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, DownloadIcon } from "@/components/ui/icon";

export type LightboxPhoto = {
  id: string;
  src: string;
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

  if (!photo) return null;

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.src}
      alt={photo.alt ?? ""}
      width={photo.width}
      height={photo.height}
      className="max-h-[85vh] max-w-full rounded-card object-contain"
    />
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="modal-backdrop fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink/90 p-4 sm:p-8"
      onClick={onClose}
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
          {photo.meta && (
            <span className="text-caption text-paper/70">{photo.meta}</span>
          )}
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
          {photo.deleteAction}
        </div>
      </div>
    </div>
  );
}
