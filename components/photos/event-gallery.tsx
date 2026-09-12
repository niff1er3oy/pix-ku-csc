"use client";

import { DownloadAllButton } from "@/components/photos/download-all-button";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { SelectAllToggle } from "@/components/photos/select-all-toggle";
import { SelectCheckbox } from "@/components/photos/select-checkbox";
import { DownloadIcon } from "@/components/ui/icon";
import { usePhotoSelection } from "@/lib/hooks/use-photo-selection";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";
import { enterDelay, formatNumber } from "@/lib/utils";

export type EventGalleryPhoto = {
  id: string;
  thumbSrc: string;
  previewSrc: string;
  width?: number;
  height?: number;
  originalPath: string;
  faceCount: number;
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
  const { selectedIds, toggleSelect, allSelected, toggleSelectAll } =
    usePhotoSelection(photos.map((p) => p.id));

  // A selection, if there is one, otherwise every photo — "download
  // selected" with nothing checked would otherwise sit dead beside a grid
  // full of photos it could just as well hand over.
  const downloadTargets =
    selectedIds.size > 0 ? photos.filter((p) => selectedIds.has(p.id)) : photos;

  return (
    <>
      {allowDownload && photos.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <SelectAllToggle
            checked={allSelected}
            onChange={toggleSelectAll}
            selectLabel={dict.results.selectAll}
            deselectLabel={dict.results.deselectAll}
          />

          <DownloadAllButton
            paths={downloadTargets.map((photo) => photo.originalPath)}
            dict={dict}
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
        items={photos.map((photo, i) => ({
          id: photo.id,
          thumbSrc: photo.thumbSrc,
          previewSrc: photo.previewSrc,
          width: photo.width,
          height: photo.height,
          downloadHref: allowDownload
            ? `/api/media/${photo.originalPath}?download=1`
            : undefined,
          // Overrides the card's default white background — the footer sits
          // directly on this, so this is what actually makes it read as a
          // light green bar rather than white. `enter` + a per-item delay is
          // the same arrival motion the rest of the app uses for a freshly
          // rendered list — see `enterDelay`.
          className: `bg-green-50 enter ${enterDelay(i)}`,
          // Hidden until something is picked — see `onLongPress` below,
          // which is what starts a selection from nothing.
          select: selectedIds.size > 0 && (
            <SelectCheckbox
              checked={selectedIds.has(photo.id)}
              onChange={() => toggleSelect(photo.id)}
              ariaLabel={dict.event.selectOne}
            />
          ),
          onLongPress: () => toggleSelect(photo.id),
          footer: (
            <div className="flex items-center justify-between gap-2 p-3">
              <span className="min-w-0 truncate text-caption font-medium text-slate">
                {t(dict.event.faceCount, {
                  count: formatNumber(photo.faceCount, locale),
                })}
              </span>
              {allowDownload && (
                <a
                  href={`/api/media/${photo.originalPath}?download=1`}
                  aria-label={dict.results.downloadOne}
                  className="grid size-7 shrink-0 place-items-center rounded-pill text-slate transition-colors duration-200 hover:text-green-700"
                >
                  <DownloadIcon size={18} />
                </a>
              )}
            </div>
          ),
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
