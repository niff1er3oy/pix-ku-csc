"use client";

import { useState } from "react";

import { DownloadAllButton } from "@/components/photos/download-all-button";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { DownloadIcon } from "@/components/ui/icon";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";
import { formatNumber } from "@/lib/utils";

export type EventGalleryPhoto = {
  id: string;
  thumbSrc: string;
  previewSrc: string;
  width?: number;
  height?: number;
  originalPath: string;
};

/**
 * The public "browse the whole event" grid — selection and per-photo
 * download mirror `FaceSearchPanel`'s results grid on purpose (a visitor
 * asked for the two to match). Checkboxes stay off the thumbnails until one
 * is held for about a second; the bulk button acts on every photo rather
 * than going dead when nothing is picked.
 */
export function EventGallery({
  photos,
  allowDownload,
  dict,
  locale,
}: {
  photos: EventGalleryPhoto[];
  allowDownload: boolean;
  dict: Dictionary;
  locale: "th" | "en";
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = photos.length > 0 && selectedIds.size === photos.length;

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(photos.map((p) => p.id)));
  }

  // A selection, if there is one, otherwise every photo — "download
  // selected" with nothing checked would otherwise sit dead beside a grid
  // full of photos it could just as well hand over.
  const downloadTargets =
    selectedIds.size > 0 ? photos.filter((p) => selectedIds.has(p.id)) : photos;

  return (
    <>
      {allowDownload && photos.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <label className="flex min-h-11 w-fit items-center gap-2 text-label font-medium text-ink">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="size-5 rounded-[6px] accent-green-600"
            />
            {allSelected ? dict.results.deselectAll : dict.results.selectAll}
          </label>

          <DownloadAllButton
            hrefs={downloadTargets.map(
              (photo) => `/api/media/${photo.originalPath}?download=1`,
            )}
            label={
              selectedIds.size > 0
                ? dict.results.downloadSelected
                : t(dict.results.downloadAll, {
                    count: formatNumber(photos.length, locale),
                  })
            }
          />
        </div>
      )}

      <PhotoGallery
        className="mt-8"
        variant="card"
        items={photos.map((photo) => ({
          id: photo.id,
          thumbSrc: photo.thumbSrc,
          previewSrc: photo.previewSrc,
          width: photo.width,
          height: photo.height,
          downloadHref: allowDownload
            ? `/api/media/${photo.originalPath}?download=1`
            : undefined,
          // Hidden until something is picked — see `onLongPress` below,
          // which is what starts a selection from nothing.
          select: selectedIds.size > 0 && (
            <input
              type="checkbox"
              checked={selectedIds.has(photo.id)}
              onChange={() => toggleSelect(photo.id)}
              aria-label={dict.event.selectOne}
              className="size-5 rounded border-2 border-paper bg-paper/80 accent-[var(--color-green-600)] shadow-[var(--shadow-card)]"
            />
          ),
          onLongPress: () => toggleSelect(photo.id),
          footer: allowDownload ? (
            <div className="flex items-center justify-end p-3">
              <a
                href={`/api/media/${photo.originalPath}?download=1`}
                aria-label={dict.results.downloadOne}
                className="grid size-7 shrink-0 place-items-center rounded-pill text-slate transition-colors duration-200 hover:text-green-700"
              >
                <DownloadIcon size={18} />
              </a>
            </div>
          ) : undefined,
        }))}
        labels={{
          close: dict.common.close,
          previous: dict.common.back,
          next: dict.common.next,
          download: dict.results.downloadOne,
        }}
      />
    </>
  );
}
