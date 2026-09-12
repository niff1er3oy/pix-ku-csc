"use client";

import { useState } from "react";

import { DownloadAllButton } from "@/components/photos/download-all-button";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { SelectAllToggle } from "@/components/photos/select-all-toggle";
import { SelectCheckbox } from "@/components/photos/select-checkbox";
import { BookmarkIcon, DownloadIcon } from "@/components/ui/icon";
import { usePhotoSelection } from "@/lib/hooks/use-photo-selection";
import { unsavePhotos } from "@/lib/actions/saved-photos";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";
import type { SavedPhoto } from "@/lib/queries/saved-photos";
import { enterDelay, formatNumber, mediaSrc } from "@/lib/utils";

/**
 * What a visitor has saved from this one event's own face search results —
 * `getMySavedPhotosForEvent` narrows the list, so unlike
 * `SavedPhotosByEvent` on `/profile/[id]` there is only ever one event's
 * worth here, and nothing to group or name per photo.
 *
 * Selection and bulk download mirror the same pattern as `FaceSearchPanel`
 * and `EventGallery` — hidden checkboxes until a photo is held for ~1s,
 * "select all" flipping to "deselect all", the bulk button falling back to
 * "download all" when nothing's checked — but only for photos whose saving
 * event still allows it. The event can turn downloads off after a photo was
 * saved, and `/api/media` is the actual enforcement either way; this is
 * just what keeps every link on screen from ever being a 403 waiting to
 * happen.
 */
export function SavedPhotosSection({
  photos,
  dict,
  locale,
}: {
  photos: SavedPhoto[];
  dict: Dictionary;
  locale: "th" | "en";
}) {
  const [items, setItems] = useState(photos);
  const downloadable = items.filter((p) => p.allowOriginalDownload);
  const { selectedIds, toggleSelect, allSelected, toggleSelectAll } =
    usePhotoSelection(downloadable.map((p) => p.photoId));

  // Optimistic, and reverts by re-inserting the one photo removed rather
  // than resetting to the original list — resetting would also undo any
  // other removal already in flight.
  async function remove(photo: SavedPhoto) {
    setItems((current) => current.filter((p) => p.photoId !== photo.photoId));
    try {
      await unsavePhotos([photo.photoId]);
    } catch {
      setItems((current) => [photo, ...current]);
    }
  }

  // A selection, if there is one, otherwise every downloadable photo —
  // never the ones whose event has downloads turned off, selected or not.
  const downloadTargets =
    selectedIds.size > 0
      ? downloadable.filter((p) => selectedIds.has(p.photoId))
      : downloadable;

  return (
    <div className="rounded-card bg-cloud p-5 sm:p-6">
      <h2 className="text-h3 font-semibold text-ink">{dict.profile.savedPhotosTitle}</h2>

      {items.length === 0 ? (
        <p className="mt-1 text-label text-slate">{dict.profile.savedPhotosNoneBody}</p>
      ) : (
        <>
          {downloadable.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
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
                        count: formatNumber(downloadable.length, locale),
                      })
                }
              />
            </div>
          )}

          <PhotoGallery
            className="mt-5"
            variant="card"
            items={items.map((photo, i) => ({
              id: photo.photoId,
              thumbSrc: mediaSrc(photo.thumbPath),
              previewSrc: mediaSrc(photo.previewPath),
              className: `bg-green-50 enter ${enterDelay(i)}`,
              downloadHref: photo.allowOriginalDownload
                ? `/api/media/${photo.originalPath}?download=1`
                : undefined,
              // Hidden until something is picked, and only ever offered for
              // a photo whose event still allows downloads — see
              // `onLongPress` below, which is what starts a selection from
              // nothing.
              select: photo.allowOriginalDownload && selectedIds.size > 0 && (
                <SelectCheckbox
                  checked={selectedIds.has(photo.photoId)}
                  onChange={() => toggleSelect(photo.photoId)}
                  ariaLabel={dict.results.downloadOne}
                />
              ),
              onLongPress: photo.allowOriginalDownload
                ? () => toggleSelect(photo.photoId)
                : undefined,
              footer: (
                <div className="flex items-center justify-end gap-2 p-3">
                  <div className="flex items-center gap-1">
                    {photo.allowOriginalDownload && (
                      <a
                        href={`/api/media/${photo.originalPath}?download=1`}
                        aria-label={dict.results.downloadOne}
                        className="grid size-7 shrink-0 place-items-center rounded-pill text-slate transition-colors duration-200 hover:text-green-700"
                      >
                        <DownloadIcon size={18} />
                      </a>
                    )}
                    {/* Every photo here is already saved by definition, so
                        the icon always shows the same filled state the
                        search results' own bookmark toggle uses for
                        "saved" — clicking it removes, rather than a
                        separate trash icon and label. */}
                    <button
                      type="button"
                      onClick={() => remove(photo)}
                      aria-label={dict.profile.savedPhotosRemove}
                      className="grid size-7 shrink-0 place-items-center rounded-pill"
                    >
                      <BookmarkIcon
                        size={18}
                        className="fill-lime-500 text-lime-700 transition-colors duration-200 hover:fill-lime-600 hover:text-lime-800"
                      />
                    </button>
                  </div>
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
      )}
    </div>
  );
}
