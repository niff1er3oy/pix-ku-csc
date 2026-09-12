"use client";

import { type FormEvent, type ReactNode } from "react";
import { flushSync, useFormStatus } from "react-dom";

import { PhotoGallery } from "@/components/photos/photo-gallery";
import { SelectAllToggle } from "@/components/photos/select-all-toggle";
import { SelectCheckbox } from "@/components/photos/select-checkbox";
import { RetryIndexButton } from "@/components/studio/retry-index-button";
import { Button } from "@/components/ui/button";
import { DownloadIcon, TrashIcon } from "@/components/ui/icon";
import { deletePhotos } from "@/lib/actions/studio";
import { usePhotoSelection } from "@/lib/hooks/use-photo-selection";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";

/** Only ever one of these per page today, so a fixed id is safe — exported
 *  so the lightbox's own per-photo delete button, rendered through a portal
 *  well outside this form's own DOM subtree, can still submit into it via
 *  the standard `form="…"` attribute. */
export const DELETE_PHOTOS_FORM_ID = "delete-photos-form";

export type ManagedPhoto = {
  id: string;
  /** Null while still processing — see `PhotoThumb`'s own `src`. */
  thumbSrc: string | null;
  previewSrc: string | null;
  alt: string;
  originalPath: string;
  statusLabel: string | undefined;
  indexFailed: boolean;
};

/**
 * The photographer's own grid: selection, bulk download, and delete —
 * mirroring `FaceSearchPanel`'s and `EventGallery`'s selection UI (hidden
 * checkboxes until a photo is held for ~1s, "select all" flipping to
 * "deselect all") per an explicit request to bring this grid to parity too.
 *
 * That parity has a real cost here that the other two grids don't have:
 * this form's checkboxes are how bulk delete has always worked with
 * JavaScript disabled — a plain `<input name="photoIds">` posting straight
 * into a native form. Hiding them until a JS-only long press makes bulk
 * delete-by-checkbox JS-required; a no-JS visitor can still delete one photo
 * at a time from the lightbox's own delete button, which submits directly
 * and never goes through a checkbox.
 */
export function DeletePhotosForm({
  eventId,
  photos,
  dict,
  trailingItem,
}: {
  eventId: string;
  photos: ManagedPhoto[];
  dict: Dictionary;
  trailingItem?: ReactNode;
}) {
  const { selectedIds, setSelectedIds, toggleSelect, allSelected, toggleSelectAll } =
    usePhotoSelection(photos.map((p) => p.id));

  /**
   * No zip, no new route — each target already carries the same per-photo
   * `/api/media/...?download=1` link its own thumbnail uses. Firing them off
   * with a delay between each is a real limitation next to a single zip
   * download, but it reuses a route that is already correctly authorized
   * and watermark-aware rather than standing up a second way to read a
   * photo off disk. The stagger exists because Chrome silently blocks a
   * burst of automatic downloads fired in the same tick — spaced out, each
   * one lands as an ordinary user-triggered download instead.
   */
  function downloadSelected() {
    // Nothing selected falls back to every photo in the grid, the same way
    // the bulk save/download buttons elsewhere on the site do, rather than
    // going dead.
    const targets = selectedIds.size > 0 ? photos.filter((p) => selectedIds.has(p.id)) : photos;
    const hrefs = targets.map((p) => `/api/media/${p.originalPath}?download=1`);

    hrefs.forEach((href, index) => {
      window.setTimeout(() => {
        const link = document.createElement("a");
        link.href = href;
        link.download = "";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, index * 400);
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // A per-photo retry button (`name="photoId"`, its own `formAction`)
    // lives inside this same form — see the grid's `select` slot below. It
    // submits through here too, and must skip the checks below, which only
    // make sense for a delete.
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | null;
    if (submitter?.name === "photoId") return;

    // The lightbox's own delete button submits its one photo id directly as
    // the submitter's own name/value, not through a checked checkbox — it is
    // never "nothing selected", so it always confirms as exactly one photo.
    const isSinglePhotoDelete = submitter?.name === "photoIds";
    if (isSinglePhotoDelete) {
      if (!window.confirm(t(dict.studio.photosDeleteConfirm, { count: "1" }))) {
        event.preventDefault();
      }
      return;
    }

    // Bulk delete: nothing checked falls back to every photo in the grid,
    // the same way the bulk download button does, rather than blocking —
    // the confirm dialog says "all N photos" so that is never a surprise.
    const targetCount = selectedIds.size > 0 ? selectedIds.size : photos.length;
    const confirmMessage =
      selectedIds.size > 0
        ? dict.studio.photosDeleteConfirm
        : dict.studio.photosDeleteConfirmAll;

    if (!window.confirm(t(confirmMessage, { count: String(targetCount) }))) {
      event.preventDefault();
      return;
    }

    // The browser collects form data right after this handler returns, so
    // the fallback-to-all selection has to land in the DOM synchronously —
    // an ordinary `setSelectedIds` wouldn't re-render in time to check every
    // box before the native submission reads them.
    if (selectedIds.size === 0) {
      flushSync(() => setSelectedIds(new Set(photos.map((p) => p.id))));
    }
  }

  return (
    <form id={DELETE_PHOTOS_FORM_ID} action={deletePhotos} onSubmit={onSubmit}>
      <input type="hidden" name="eventId" value={eventId} />

      {/* "Select all" beside the buttons it feeds, right before the moment
          of acting on whatever ends up checked. */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SelectAllToggle
          checked={allSelected}
          onChange={toggleSelectAll}
          selectLabel={dict.studio.photosSelectAll}
          deselectLabel={dict.studio.photosDeselectAll}
        />

        <Button type="button" size="sm" onClick={downloadSelected}>
          <DownloadIcon size={16} />
          {selectedIds.size > 0
            ? dict.studio.photosDownloadSelected
            : dict.studio.photosDownloadAll}
        </Button>

        <Submit
          label={
            selectedIds.size > 0
              ? dict.studio.photosDeleteSelected
              : dict.studio.photosDeleteAll
          }
        />
      </div>

      <PhotoGallery
        className="mt-5"
        variant="card"
        aspect="square"
        items={photos.map((photo) => ({
          id: photo.id,
          thumbSrc: photo.thumbSrc,
          previewSrc: photo.previewSrc,
          alt: photo.alt,
          // The owner can always pull their own original — see the
          // `isManager` bypass in `/api/media`'s authorize().
          downloadHref: `/api/media/${photo.originalPath}?download=1`,
          className: "bg-green-50",
          badge: photo.indexFailed ? (
            <span className="rounded-pill bg-danger px-1.5 py-0.5 text-caption font-semibold text-paper">
              !
            </span>
          ) : undefined,
          meta: photo.statusLabel,
          // The same left-text/right-icon footer `EventGallery` uses on
          // `/e/[code]` — face count (or whatever indexing status is
          // current) on the left, quick download and delete on the right.
          footer: (
            <div className="flex items-center justify-between gap-2 p-3">
              <span className="min-w-0 truncate text-caption font-medium text-slate">
                {photo.statusLabel}
              </span>
              <div className="flex items-center gap-1">
                <a
                  href={`/api/media/${photo.originalPath}?download=1`}
                  aria-label={dict.results.downloadOne}
                  className="grid size-7 shrink-0 place-items-center rounded-pill text-slate transition-colors duration-200 hover:text-green-700"
                >
                  <DownloadIcon size={16} />
                </a>
                {/* Same `onSubmit` path as the lightbox's own delete button —
                    submitted by `name="photoIds"`, this one photo id is what
                    tells the handler "a single specific delete", confirm
                    dialog and all, with no checkbox involved. */}
                <button
                  type="submit"
                  form={DELETE_PHOTOS_FORM_ID}
                  name="photoIds"
                  value={photo.id}
                  aria-label={dict.studio.photosDeleteOne}
                  className="grid size-7 shrink-0 place-items-center rounded-pill text-slate transition-colors duration-200 hover:text-danger"
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            </div>
          ),
          // Submits into this form by id rather than by DOM position — the
          // lightbox this renders inside of is portalled to `document.body`,
          // well outside this form's own subtree, and `form="…"` is exactly
          // what that attribute is for.
          deleteAction: (
            <Button
              type="submit"
              form={DELETE_PHOTOS_FORM_ID}
              name="photoIds"
              value={photo.id}
              variant="danger"
              size="sm"
            >
              <TrashIcon size={16} />
              {dict.studio.photosDeleteOne}
            </Button>
          ),
          // Hidden until something is picked — see `onLongPress` below,
          // which is what starts a selection from nothing.
          select: selectedIds.size > 0 && (
            <div className="flex flex-col items-start gap-1">
              <SelectCheckbox
                name="photoIds"
                value={photo.id}
                checked={selectedIds.has(photo.id)}
                onChange={() => toggleSelect(photo.id)}
                ariaLabel={t(dict.studio.photosSelect, { name: photo.alt })}
              />
              {photo.indexFailed && (
                <RetryIndexButton
                  photoId={photo.id}
                  label={dict.studio.photosRetryIndex}
                />
              )}
            </div>
          ),
          onLongPress: () => toggleSelect(photo.id),
        }))}
        labels={{
          close: dict.common.close,
          previous: dict.common.back,
          next: dict.common.next,
          download: dict.results.downloadOne,
        }}
        trailingItem={trailingItem}
      />
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="sm" pending={pending}>
      <TrashIcon size={16} />
      {label}
    </Button>
  );
}
