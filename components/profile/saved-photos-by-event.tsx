"use client";

import Link from "next/link";
import { useState } from "react";

import { DownloadAllButton } from "@/components/photos/download-all-button";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { SelectAllToggle } from "@/components/photos/select-all-toggle";
import { SelectCheckbox } from "@/components/photos/select-checkbox";
import { hideEventFromProfile, showEventOnProfile } from "@/lib/actions/profile";
import { unsavePhotos } from "@/lib/actions/saved-photos";
import { usePhotoSelection } from "@/lib/hooks/use-photo-selection";
import { BookmarkIcon, DownloadIcon, EyeIcon, EyeOffIcon } from "@/components/ui/icon";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";
import type { SavedPhotosGroup } from "@/lib/queries/saved-photos";
import { formatNumber } from "@/lib/utils";

type Photo = SavedPhotosGroup["photos"][number];

/**
 * A saved-photos list, grouped by event rather than one flat grid, since
 * "which of these photos are mine" already answered itself the moment they
 * were saved from that event's own search. Lives on `/profile/[id]`, for
 * whoever that account is looking at — the account itself (`isOwner`) can
 * hide a group from every other viewer without unsaving anything
 * (`hideEventFromProfile`) and gets the controls for that plus removing a
 * photo outright; anyone else only ever receives the non-hidden groups to
 * begin with (the caller filters those out before this component sees
 * them), so there is nothing here it could leak by rendering the wrong
 * thing. A private event's group never reaches this component at all
 * regardless of viewer — see `getMySavedPhotosGroupedByEvent`'s own `where`
 * clause for why that is a query-level rule, not a prop here.
 */
export function SavedPhotosByEvent({
  groups,
  dict,
  locale,
  isOwner,
}: {
  groups: SavedPhotosGroup[];
  dict: Dictionary;
  locale: "th" | "en";
  isOwner: boolean;
}) {
  const [items, setItems] = useState(groups);

  async function removePhoto(eventId: string, photo: Photo) {
    setItems((current) =>
      current.map((group) =>
        group.eventId === eventId
          ? { ...group, photos: group.photos.filter((p) => p.photoId !== photo.photoId) }
          : group,
      ),
    );
    try {
      await unsavePhotos([photo.photoId]);
    } catch {
      setItems((current) =>
        current.map((group) =>
          group.eventId === eventId
            ? { ...group, photos: [photo, ...group.photos] }
            : group,
        ),
      );
    }
  }

  async function toggleHidden(group: SavedPhotosGroup) {
    const nextHidden = !group.hidden;
    setItems((current) =>
      current.map((g) => (g.eventId === group.eventId ? { ...g, hidden: nextHidden } : g)),
    );
    try {
      await (nextHidden ? hideEventFromProfile : showEventOnProfile)(group.eventId);
    } catch {
      setItems((current) =>
        current.map((g) => (g.eventId === group.eventId ? { ...g, hidden: group.hidden } : g)),
      );
    }
  }

  // A group can end up with nothing in it — every photo removed, one at a
  // time — without a page reload to clear it away.
  const nonEmpty = items.filter((g) => g.photos.length > 0);

  if (nonEmpty.length === 0) {
    return <p className="mt-1 text-label text-slate">{dict.profile.savedPhotosNoneBody}</p>;
  }

  return (
    <div className="mt-5 space-y-8">
      {nonEmpty.map((group) => (
        <EventGroup
          key={group.eventId}
          group={group}
          dict={dict}
          locale={locale}
          isOwner={isOwner}
          onRemovePhoto={(photo) => removePhoto(group.eventId, photo)}
          onToggleHidden={() => toggleHidden(group)}
        />
      ))}
    </div>
  );
}

function EventGroup({
  group,
  dict,
  locale,
  isOwner,
  onRemovePhoto,
  onToggleHidden,
}: {
  group: SavedPhotosGroup;
  dict: Dictionary;
  locale: "th" | "en";
  isOwner: boolean;
  onRemovePhoto: (photo: Photo) => void;
  onToggleHidden: () => void;
}) {
  const downloadable = group.allowOriginalDownload ? group.photos : [];
  const { selectedIds, toggleSelect, allSelected, toggleSelectAll } = usePhotoSelection(
    downloadable.map((p) => p.photoId),
  );

  const downloadTargets =
    selectedIds.size > 0
      ? downloadable.filter((p) => selectedIds.has(p.photoId))
      : downloadable;

  return (
    // Toggling hidden only ever changes this one group's own header — the
    // group stays right where it was in the list, for the owner exactly
    // like every other one, just with a note and the button's label/icon
    // swapped. Nothing moves to a separate section.
    <div className={isOwner && group.hidden ? "opacity-70" : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/e/${group.eventAccessCode}`}
            className="text-label font-semibold text-ink underline-offset-4 hover:text-green-700 hover:underline"
          >
            {locale === "en" && group.eventNameEn ? group.eventNameEn : group.eventNameTh}
          </Link>
          {isOwner && group.hidden && (
            <p className="text-caption text-slate">{dict.profile.savedPhotosHiddenNote}</p>
          )}
        </div>

        {isOwner && (
          <button
            type="button"
            onClick={onToggleHidden}
            aria-pressed={group.hidden}
            className="inline-flex shrink-0 items-center gap-1.5 text-caption font-medium text-slate transition-colors duration-200 hover:text-green-700"
          >
            {group.hidden ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
            {group.hidden ? dict.profile.savedPhotosShowEvent : dict.profile.savedPhotosHideEvent}
          </button>
        )}
      </div>

      {downloadable.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <SelectAllToggle
            checked={allSelected}
            onChange={toggleSelectAll}
            selectLabel={dict.results.selectAll}
            deselectLabel={dict.results.deselectAll}
          />

          <DownloadAllButton
            hrefs={downloadTargets.map(
              (photo) => `/api/media/${photo.originalPath}?download=1`,
            )}
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
        className="mt-4"
        variant="card"
        items={group.photos.map((photo) => ({
          id: photo.photoId,
          thumbSrc: `/api/media/${photo.thumbPath}`,
          previewSrc: `/api/media/${photo.previewPath}`,
          className: "bg-green-50",
          downloadHref: group.allowOriginalDownload
            ? `/api/media/${photo.originalPath}?download=1`
            : undefined,
          select: group.allowOriginalDownload && selectedIds.size > 0 && (
            <SelectCheckbox
              checked={selectedIds.has(photo.photoId)}
              onChange={() => toggleSelect(photo.photoId)}
              ariaLabel={dict.results.downloadOne}
            />
          ),
          onLongPress: group.allowOriginalDownload
            ? () => toggleSelect(photo.photoId)
            : undefined,
          footer: (
            <div className="flex items-center justify-end gap-1 p-3">
              {group.allowOriginalDownload && (
                <a
                  href={`/api/media/${photo.originalPath}?download=1`}
                  aria-label={dict.results.downloadOne}
                  className="grid size-7 shrink-0 place-items-center rounded-pill text-slate transition-colors duration-200 hover:text-green-700"
                >
                  <DownloadIcon size={18} />
                </a>
              )}
              {/* Removing is the account's own call, not a viewer's —
                  someone else's saved photo isn't this viewer's to unsave.
                  Every photo here is already saved by definition, so the
                  icon always shows the same filled state the search
                  results' own bookmark toggle uses for "saved". */}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => onRemovePhoto(photo)}
                  aria-label={dict.profile.savedPhotosRemove}
                  className="grid size-7 shrink-0 place-items-center rounded-pill"
                >
                  <BookmarkIcon
                    size={18}
                    className="fill-lime-500 text-lime-700 transition-colors duration-200 hover:fill-lime-600 hover:text-lime-800"
                  />
                </button>
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
    </div>
  );
}
