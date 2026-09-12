"use client";

import Link from "next/link";
import { useState } from "react";

import { DownloadAllButton } from "@/components/photos/download-all-button";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { SelectAllToggle } from "@/components/photos/select-all-toggle";
import { SelectCheckbox } from "@/components/photos/select-checkbox";
import { Avatar } from "@/components/ui/avatar";
import { hideEventFromProfile, showEventOnProfile } from "@/lib/actions/profile";
import { unsavePhotos } from "@/lib/actions/saved-photos";
import { usePhotoSelection } from "@/lib/hooks/use-photo-selection";
import {
  BookmarkIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  SearchIcon,
} from "@/components/ui/icon";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";
import type { SavedPhotosGroup } from "@/lib/queries/saved-photos";
import { cn, enterDelay, formatNumber } from "@/lib/utils";

type Photo = SavedPhotosGroup["photos"][number];

/**
 * A saved-photos list, grouped by event rather than one flat grid, since
 * "which of these photos are mine" already answered itself the moment they
 * were saved from that event's own search. Lives on `/profile/[id]`, for
 * whoever that account is looking at — the account itself (`isOwner`) can
 * hide a group from every other viewer without unsaving anything
 * (`hideEventFromProfile`) and gets the controls for that plus removing a
 * photo outright; anyone else only ever receives the non-hidden, non-private
 * groups to begin with (the caller decides what to send before this
 * component sees it — see `getMySavedPhotosGroupedByEvent`'s
 * `includePrivate`), so there is nothing here it could leak by rendering the
 * wrong thing.
 *
 * A private event's group gets its own tab rather than sitting alongside the
 * rest: it is only ever present for the owner's own view (nobody else's
 * `groups` ever contains one), and the hide-from-profile toggle has nothing
 * to do there either — a private event is already invisible to every other
 * viewer regardless, so "hide" would be asking to hide something that was
 * never shown.
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
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"visible" | "hidden" | "private">("visible");

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

  // Only ever splits anything for the owner — everyone else's `groups`
  // never contained a hidden or private one to begin with (see the note on
  // `getMySavedPhotosGroupedByEvent`), so both extra tabs stay empty for
  // them and neither has a reason to appear.
  const visibleGroups = nonEmpty.filter((g) => !g.isPrivate && !g.hidden);
  const hiddenGroups = nonEmpty.filter((g) => !g.isPrivate && g.hidden);
  const privateGroups = nonEmpty.filter((g) => g.isPrivate);
  const showHiddenTab = isOwner && hiddenGroups.length > 0;
  const showPrivateTab = isOwner && privateGroups.length > 0;
  const activeGroups =
    showHiddenTab && view === "hidden"
      ? hiddenGroups
      : showPrivateTab && view === "private"
        ? privateGroups
        : visibleGroups;

  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? activeGroups.filter(
        (g) =>
          g.eventNameTh.toLowerCase().includes(needle) ||
          g.eventNameEn?.toLowerCase().includes(needle),
      )
    : activeGroups;

  return (
    <div className="mt-5">
      {/* Separate tabs rather than hidden/private ones sitting dimmed in the
          same list — an owner checking their saved photos is asking "what's
          on my profile," and a hidden or private group answering that
          question at all was the wrong default. Each tab only ever appears
          once there is actually something on it. */}
      {(showHiddenTab || showPrivateTab) && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <TabButton active={view === "visible"} onClick={() => setView("visible")}>
            {dict.profile.savedPhotosVisibleTab}
          </TabButton>
          {showHiddenTab && (
            <TabButton active={view === "hidden"} onClick={() => setView("hidden")}>
              {t(dict.profile.savedPhotosHiddenTab, {
                count: formatNumber(hiddenGroups.length, locale),
              })}
            </TabButton>
          )}
          {showPrivateTab && (
            <TabButton active={view === "private"} onClick={() => setView("private")}>
              {t(dict.profile.savedPhotosPrivateTab, {
                count: formatNumber(privateGroups.length, locale),
              })}
            </TabButton>
          )}
        </div>
      )}

      {/* Filters client-side against groups already on the page rather than
          a `?q=` round trip like `/events`' own search box — everything
          this could ever match is already sitting in `items`. Always shown
          — `nonEmpty.length === 0` already returned above, so there is
          always at least one album by the time this renders, a single one
          included: a saved face search can turn up dozens of small albums
          even for someone who has been to one event so far, and there is no
          reason to make the box wait for a second one to exist. */}
      <div className="relative mb-5">
        <SearchIcon
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={dict.eventsPage.searchPlaceholder}
          aria-label={dict.eventsPage.searchLabel}
          className="h-12 w-full rounded-pill bg-paper pl-11 pr-4 text-body text-ink ring-1 ring-inset ring-edge placeholder:text-slate focus:ring-2 focus:ring-green-600"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card bg-cloud p-6 text-center">
          <p className="text-label text-slate">
            {needle
              ? t(dict.eventsPage.searchEmpty, { query: query.trim() })
              : view === "hidden"
                ? dict.profile.savedPhotosHiddenEmpty
                : view === "private"
                  ? dict.profile.savedPhotosPrivateEmpty
                  : dict.profile.savedPhotosNoneBody}
          </p>
          {needle && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-2 text-label font-medium text-green-700 underline underline-offset-4"
            >
              {dict.eventsPage.searchClear}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {filtered.map((group, i) => (
            <EventGroup
              key={group.eventId}
              group={group}
              dict={dict}
              locale={locale}
              isOwner={isOwner}
              delay={i}
              onRemovePhoto={(photo) => removePhoto(group.eventId, photo)}
              onToggleHidden={group.isPrivate ? undefined : () => toggleHidden(group)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EventGroup({
  group,
  dict,
  locale,
  isOwner,
  delay,
  onRemovePhoto,
  onToggleHidden,
}: {
  group: SavedPhotosGroup;
  dict: Dictionary;
  locale: "th" | "en";
  isOwner: boolean;
  /** This group's own place in the list — staggers its card in the same way
   *  `enterDelay` staggers the photos inside it, just on a coarser step. */
  delay: number;
  onRemovePhoto: (photo: Photo) => void;
  /** Omitted for a private group — see the note on `SavedPhotosByEvent`
   *  for why hiding one from other viewers is not a thing to offer. */
  onToggleHidden?: () => void;
}) {
  const downloadable = group.allowOriginalDownload ? group.photos : [];
  const { selectedIds, toggleSelect, allSelected, toggleSelectAll } = usePhotoSelection(
    downloadable.map((p) => p.photoId),
  );

  const downloadTargets =
    selectedIds.size > 0
      ? downloadable.filter((p) => selectedIds.has(p.photoId))
      : downloadable;

  // The group's own first save, standing in for a cover — there is no
  // event cover to reach for here (a saved photo can outlive the event
  // changing its own), and the photo that made someone save from this
  // event in the first place is a better representative of it than a
  // blank placeholder would be.
  const cover = group.photos[0]?.thumbPath;

  return (
    // No dimming here — `group.hidden` only ever renders inside the parent's
    // "hidden" tab now (see `activeGroups` there), so every card on screen
    // in that view is hidden by definition. Dimming all of them equally
    // would say nothing a plain card does not already say by sitting on
    // that tab.
    <div
      className="enter rounded-card bg-paper p-5 shadow-[var(--shadow-card)] sm:p-6"
      style={{ "--d": `${Math.min(delay, 6) * 60}ms` } as React.CSSProperties}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/media/${cover}`}
              alt=""
              className="size-12 shrink-0 rounded-media object-cover ring-1 ring-edge"
            />
          )}
          <div className="min-w-0">
            <Link
              href={`/e/${group.eventAccessCode}`}
              className="flex items-center gap-1.5 truncate text-label font-semibold text-ink underline-offset-4 hover:text-green-700 hover:underline"
            >
              {group.isPrivate && (
                <LockIcon size={14} className="shrink-0 text-slate" title={dict.studio.formPrivate} />
              )}
              <span className="truncate">
                {locale === "en" && group.eventNameEn ? group.eventNameEn : group.eventNameTh}
              </span>
            </Link>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption text-slate">
              <span>
                {t(dict.studio.photosInEvent, {
                  count: formatNumber(group.photos.length, locale),
                })}
              </span>
              <span aria-hidden="true">·</span>
              {/* Whoever shot it, avatar and all — a saved-photos list can
                  span several photographers' events, unlike a portfolio
                  where it always goes without saying whose it is. */}
              <Link
                href={`/profile/${group.photographerUserId}`}
                className="flex min-w-0 items-center gap-1.5 transition-colors duration-200 hover:text-green-700"
              >
                <Avatar src={group.photographerImage} size={16} />
                <span className="truncate">{group.photographerName}</span>
              </Link>
            </div>
          </div>
        </div>

        {isOwner && onToggleHidden && (
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
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-edge pt-4">
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
        className="mt-4"
        variant="card"
        items={group.photos.map((photo, i) => ({
          id: photo.photoId,
          thumbSrc: `/api/media/${photo.thumbPath}`,
          previewSrc: `/api/media/${photo.previewPath}`,
          className: `bg-green-50 enter ${enterDelay(i)}`,
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

/** One pill in the visible/hidden/private switcher — a local view toggle,
 *  not a navigation, so `aria-pressed` rather than the `aria-current` a
 *  `Link`-based tab bar elsewhere on this site uses. */
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 items-center whitespace-nowrap rounded-pill px-4 text-sm font-medium transition-colors duration-200",
        active ? "bg-green-600 text-paper" : "text-slate hover:bg-cloud hover:text-green-700",
      )}
    >
      {children}
    </button>
  );
}
