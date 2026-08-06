"use client";

import { useState, type ReactNode } from "react";

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
  /** Omit to hide the download button for this photo in the lightbox. */
  downloadHref?: string;
  viewTransitionName?: string;
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
}: {
  items: PhotoGalleryItem[];
  aspect?: "square" | "wide";
  variant?: "frame" | "card";
  gridClassName?: string;
  labels: LightboxLabels;
  className?: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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
              viewTransitionName={item.viewTransitionName}
              onClick={() => setOpenIndex(i)}
            />
          </li>
        ))}
      </ul>

      {openIndex !== null && (
        <PhotoLightbox
          photos={items.map((item) => ({
            id: item.id,
            src: item.previewSrc,
            alt: item.alt,
            width: item.width,
            height: item.height,
            downloadHref: item.downloadHref,
            viewTransitionName: item.viewTransitionName,
          }))}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
          labels={labels}
        />
      )}
    </>
  );
}
