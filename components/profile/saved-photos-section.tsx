"use client";

import { useState } from "react";

import { PhotoGallery } from "@/components/photos/photo-gallery";
import { TrashIcon } from "@/components/ui/icon";
import { unsavePhotos } from "@/lib/actions/saved-photos";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { SavedPhoto } from "@/lib/queries/saved-photos";

/**
 * Everything a visitor has saved from face searches across every event —
 * see the server action in `savePhotos`/`unsavePhotos` for why saving needs
 * an account at all. No download link here: an event can turn downloads off
 * after a photo was saved, and `/api/media` is what actually enforces that,
 * not this list — showing a link that might 403 on a per-event setting this
 * component has no way to know isn't worth it when the event's own page is
 * right there for it.
 */
export function SavedPhotosSection({
  photos,
  dict,
}: {
  photos: SavedPhoto[];
  dict: Dictionary;
}) {
  const [items, setItems] = useState(photos);

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

  return (
    <div className="rounded-card bg-cloud p-5 sm:p-6">
      <h2 className="text-h3 font-semibold text-ink">{dict.profile.savedPhotosTitle}</h2>

      {items.length === 0 ? (
        <p className="mt-1 text-label text-slate">{dict.profile.savedPhotosNoneBody}</p>
      ) : (
        <PhotoGallery
          className="mt-5"
          variant="card"
          items={items.map((photo) => ({
            id: photo.photoId,
            thumbSrc: `/api/media/${photo.thumbPath}`,
            previewSrc: `/api/media/${photo.previewPath}`,
            footer: (
              <div className="flex items-center justify-between gap-2 p-3">
                <span className="min-w-0 truncate text-caption text-slate">
                  {photo.eventNameTh}
                </span>
                <button
                  type="button"
                  onClick={() => remove(photo)}
                  className="inline-flex shrink-0 items-center gap-1 text-caption font-semibold text-danger underline underline-offset-4"
                >
                  <TrashIcon size={14} />
                  {dict.profile.savedPhotosRemove}
                </button>
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
      )}
    </div>
  );
}
