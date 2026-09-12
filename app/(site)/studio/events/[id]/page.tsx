import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button, ButtonLink } from "@/components/ui/button";
import { GridBackground } from "@/components/ui/grid-background";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  PlayIcon,
  PrintIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/ui/icon";
import { publishEvent, resumeEvent } from "@/lib/actions/studio";
import { requireApprovedPhotographer } from "@/lib/dal";
import { sweepStuckIndexing } from "@/lib/face/pipeline";
import { getDictionary, getLocale, t } from "@/lib/i18n";
import { eventQrSvg, eventUrl } from "@/lib/qr";
import { CopyLinkButton } from "@/components/studio/copy-link-button";
import { DeletePhotosForm } from "@/components/studio/delete-photos-form";
import { EventHealthCard } from "@/components/studio/event-health-card";
import { PhotoUploader } from "@/components/studio/photo-uploader";
import { SearchableList } from "@/components/studio/searchable-list";
import { StatusChip } from "@/components/studio/status-chip";
import {
  getMyEvent,
  getMyEventDownloaders,
  getMyEventPhotos,
  getMyEventSearches,
} from "@/lib/queries/studio";
import { avatarRingClass, cn, formatDate, formatNumber } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { photographer } = await requireApprovedPhotographer();
  const { id } = await params;
  const event = await getMyEvent(photographer, id);
  return { title: event?.nameTh ?? "" };
}

/**
 * One event, from a manager's side — its owner, or (see `ownedOrSharedEvents`
 * in `lib/dal.ts`) any other member of the affiliation it was created under.
 *
 * `getMyEvent` filters on that same condition inside the query, so an id
 * nobody here may manage returns nothing and this 404s rather than showing a
 * stranger their access code — the one value that opens an unlisted gallery.
 */
export default async function StudioEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    face?: string;
    search?: string;
    downloader?: string;
    show?: string;
  }>;
}) {
  const { photographer } = await requireApprovedPhotographer();
  const { id } = await params;
  // Rekognition face ids are UUIDs (36 chars); sliced defensively the same
  // way `admin`'s `q` param is, since this reaches a `where` clause below.
  // `search` is a `search.id`, `downloader` a `user.id` — same shape, same
  // reasoning.
  const resolvedSearchParams = await searchParams;
  const face = resolvedSearchParams.face?.slice(0, 64) || undefined;
  const search = resolvedSearchParams.search?.slice(0, 64) || undefined;
  const downloader = resolvedSearchParams.downloader?.slice(0, 64) || undefined;
  // How many photos "show more" has raised the grid to, in steps of 20 —
  // clamped below so a hand-edited URL cannot ask for an unbounded fetch.
  const rawShow = Number(resolvedSearchParams.show);
  const show =
    Number.isFinite(rawShow) && rawShow > 20
      ? Math.min(Math.floor(rawShow), 2000)
      : 20;
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);

  const event = await getMyEvent(photographer, id);
  if (!event) notFound();

  // Catches whatever `indexPhotoFaces` itself couldn't — see the note on
  // `sweepStuckIndexing`. Run before the photo query below so a stuck row
  // this call just flipped shows up as "failed", retry button and all,
  // instead of "indexing" forever on the very page that would reveal it.
  await sweepStuckIndexing(id);

  // "anonymous" is a URL sentinel, not a real user id — `getMyEventPhotos`
  // reads `null` as "every download with no userId" (see the note there),
  // and a real UUID never collides with this literal string.
  const downloaderId =
    downloader === undefined ? undefined : downloader === "anonymous" ? null : downloader;

  const [photos, searches, downloaders] = await Promise.all([
    getMyEventPhotos(photographer, id, {
      faceId: face,
      searchId: search,
      downloaderId,
      limit: show,
    }),
    getMyEventSearches(photographer, id),
    getMyEventDownloaders(photographer, id),
  ]);
  const [qr, url] = [await eventQrSvg(event.accessCode), eventUrl(event.accessCode)];
  const activeSearch = search ? searches.find((s) => s.id === search) : undefined;

  // What the lightbox shows next to "n / total" for one photo — the same
  // indexing state the grid's "!" badge and retry button react to, spelled
  // out instead of just flagged.
  const photoStatusLabel = (photo: (typeof photos)[number]) => {
    switch (photo.indexStatus) {
      case "pending":
        return dict.studio.photoStatusPending;
      case "indexing":
        return dict.studio.photoStatusIndexing;
      case "indexed":
        return t(dict.studio.photoStatusIndexed, {
          count: formatNumber(photo.faceCount, locale),
        });
      case "no_face":
        return dict.studio.photoStatusNoFace;
      case "failed":
        return dict.studio.photoStatusFailed;
    }
  };

  // A search row's own "view all matches" button — filters the photo grid
  // by every face that one search hit.
  const searchHref = (searchId: string) =>
    searchId === search
      ? `/studio/events/${event.id}#photos`
      : `/studio/events/${event.id}?search=${searchId}#photos`;
  // Same idea for a downloader row's "view downloaded photos" button —
  // `null` is the anonymous bucket, given no real id of its own, so it gets
  // the same "anonymous" URL sentinel `downloaderId` above reads back.
  const downloaderHref = (userId: string | null) => {
    const key = userId ?? "anonymous";
    return key === downloader
      ? `/studio/events/${event.id}#photos`
      : `/studio/events/${event.id}?downloader=${key}#photos`;
  };
  // "Show more" just raises `show` by 20 and reloads this same query at the
  // new limit — carrying `face`/`search`/`downloader` along so loading more
  // photos never drops whichever filter is active.
  const loadMoreParams = new URLSearchParams();
  if (face) loadMoreParams.set("face", face);
  if (search) loadMoreParams.set("search", search);
  if (downloader) loadMoreParams.set("downloader", downloader);
  loadMoreParams.set("show", String(show + 20));
  // `#load-more` rather than `#photos`: the button re-renders at the bottom
  // of the (now longer) grid on every click, so anchoring there lands the
  // photographer back where they were — next to the photos that just
  // appeared — instead of yanking them up to the section heading they
  // already scrolled past to get here.
  const loadMoreHref = `/studio/events/${event.id}?${loadMoreParams}#load-more`;
  // `event.photoCount` is the whole event's total, which only means "how
  // many are left" when nothing is filtering `photos` down to a subset of
  // it — under a face/search/downloader filter there is no cheap total for
  // *that* subset, so the count is left off rather than shown wrong.
  const remaining =
    face || search || downloader
      ? null
      : Math.max(event.photoCount - photos.length, 0);

  const statusNote =
    event.status === "draft"
      ? dict.studio.formStatusDraft
      : event.status === "pending"
        ? dict.studio.formStatusPending
        : event.status === "approved"
          ? dict.studio.formStatusApproved
          : event.status === "rejected"
            ? dict.studio.formStatusRejected
            : dict.studio.formStatusArchived;

  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-h1 font-bold">{event.nameTh}</h1>
        <StatusChip status={event.status} labels={dict.status} />
      </div>

      <p className="mt-3 inline-flex items-center gap-1.5 text-label text-slate">
        <ClockIcon size={16} />
        {t(dict.studio.eventCreatedAt, {
          date: formatDate(event.createdAt, locale),
        })}
      </p>
      {event.status === "rejected" && event.rejectionReason && (
        <p className="mt-2 text-label text-danger">{event.rejectionReason}</p>
      )}

      <EventHealthCard
        photoCount={event.photoCount}
        faceCount={event.faceCount}
        processedCount={event.processedCount}
        failedCount={event.failedCount}
        downloadCount={event.downloadCount}
        searchCount={event.searchCount}
        locale={locale}
        labels={dict.studio}
      />

      {/* The QR and the code together, because they are one thing: the QR
          resolves to /e/{code} and the code is what somebody types when the
          sign is across a crowded field and their camera will not focus.
          `--d` follows `EventHealthCard`'s own 80ms so the two read as one
          quick arrival, not two unrelated cards animating at random.
          The QR sits in its own paper card inside the cloud one — it is the
          object a photographer would actually screenshot or print, and a
          flat SVG loose on a tinted background didn't read as one.
          Two bands, not one: *what this is* (QR beside the code and what to
          do with them) on top, *do something with it* (copy, download,
          print) below, split by a rule the way a receipt separates a
          header from its line items — the top band's two halves get their
          own rule too, on `sm` and up where they actually sit side by side. */}
      <div
        className="enter mt-6 overflow-hidden rounded-card bg-cloud"
        style={{ "--d": "140ms" } as React.CSSProperties}
      >
        <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-6 sm:p-6">
          <div className="mx-auto rounded-card bg-paper p-3 shadow-[var(--shadow-card)] sm:mx-0">
            <div
              className="w-36 [&>svg]:h-auto [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qr }}
            />
          </div>

          {/* A real border on this one element rather than `divide-x`/
              `divide-y` on the parent — sibling-selector borders like those
              turned out invisible in practice at this breakpoint, and a
              border declared directly on the element it belongs to has
              nothing left to go wrong. */}
          <div className="min-w-0 border-t border-edge pt-5 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <p className="text-label font-medium text-ink">
              {dict.studio.qrTitle}
            </p>
            <p className="tnum mt-2 font-display text-display font-bold tracking-[0.2em] text-green-700">
              {event.accessCode}
            </p>
            <p className="mt-2 text-label text-slate">{dict.studio.qrBody}</p>
          </div>
        </div>

        <div className="border-t border-edge p-5 sm:p-6">
          {/* The link itself, with a one-tap way to grab it — printing the
              QR covers the booth, but PRODUCT.md names the group-chat link
              as the other real path in, and that one starts with a copy,
              not a screenshot of a URL. */}
          <div className="flex items-center gap-2 rounded-field bg-paper px-3 py-2 ring-1 ring-inset ring-edge">
            <p className="min-w-0 flex-1 truncate text-caption text-slate">
              {url}
            </p>
            <CopyLinkButton
              value={url}
              label={dict.studio.qrCopyLink}
              copiedLabel={dict.studio.qrCopied}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink
              href={`/api/studio/events/${event.id}/qr?download=1`}
              variant="secondary"
              size="sm"
            >
              <DownloadIcon size={16} />
              {dict.studio.qrDownload}
            </ButtonLink>
            <ButtonLink
              href={`/studio/events/${event.id}/print`}
              variant="ghost"
              size="sm"
            >
              <PrintIcon size={16} />
              {dict.studio.qrPrint}
            </ButtonLink>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {event.status === "draft" && (
          <form action={publishEvent}>
            <input type="hidden" name="id" value={event.id} />
            <Button type="submit" size="md">
              <CheckIcon size={18} />
              {dict.studio.formSubmitForReview}
            </Button>
          </form>
        )}

        {event.status === "approved" && (
          <ButtonLink href={`/e/${event.accessCode}`} variant="secondary" size="md">
            {dict.studio.openPublicPage}
            <ChevronRightIcon size={18} />
          </ButtonLink>
        )}

        {/* The other half of the pause/resume switch on the settings page —
            an archived event otherwise has no way back to "approved" from
            here, and this is where a photographer lands to check on it. */}
        {event.status === "archived" && (
          <form action={resumeEvent}>
            <input type="hidden" name="id" value={event.id} />
            <Button type="submit" variant="secondary" size="md">
              <PlayIcon size={18} />
              {dict.studio.resumeEvent}
            </Button>
          </form>
        )}

        {/* Unconditional, unlike the two buttons above it — draft, pending,
            rejected, or archived, this is still where a photographer reaches
            settings from, now that the top-of-page link to it is gone. */}
        <ButtonLink
          href={`/studio/events/${event.id}/settings`}
          variant="secondary"
          size="md"
        >
          <SettingsIcon size={16} />
          {dict.studio.settingsButton}
        </ButtonLink>
      </div>

      {/* `.reveal` from here down — these sit below the QR card on any
          screen that matters, so they animate in as the photographer
          scrolls to them rather than racing the QR card on first paint. */}
      {searches.length > 0 && (
        <section className="reveal mt-12">
          <h2 className="text-h2">{dict.studio.searchesTitle}</h2>
          {/* Five rows tall, not paginated — older ones are one scroll away
              rather than behind a "show more" click, since this list is
              read for a pattern (who's showing up) more than clicked
              through row by row the way the photo grid is. The search box
              `SearchableList` adds does not change that — it is empty by
              default and the full list still scrolls the same way; it just
              gives a photographer who already has one name in mind a way to
              jump straight to it. */}
          <SearchableList
            items={searches}
            getSearchText={(s) => s.userName ?? s.userEmail ?? dict.studio.searchesAnonymous}
            dict={dict}
            renderItem={(s, rowHidden) => {
              const name = s.userName ?? s.userEmail;
              const initial = name?.trim().charAt(0).toUpperCase();
              const hasMatch = s.matchCount > 0;
              const clickable = s.faceIds.length > 0;
              const active = s.id === search;

              // A real photo wins when there is one; a letter still reads as
              // "someone specific" without one, and the icon is reserved for
              // the one case that genuinely isn't — swapping them per row
              // would make neither mean anything.
              const avatarContent = s.userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.userImage}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : initial ? (
                <span className="font-display text-label font-semibold" aria-hidden>
                  {initial}
                </span>
              ) : (
                <UsersIcon size={18} />
              );

              return (
                <li
                  key={s.id}
                  className={cn(
                    "flex items-center gap-4 p-4 transition-colors duration-200",
                    active && "bg-green-50",
                    rowHidden && "hidden",
                  )}
                >
                  {/* Only the avatar leads to the profile — the name and
                      timestamp beside it are just more detail about this
                      row, not a second copy of the same link. */}
                  {s.userId ? (
                    <Link
                      href={`/profile/${s.userId}`}
                      aria-label={t(dict.studio.viewProfile, {
                        name: name ?? dict.studio.searchesAnonymous,
                      })}
                      className={cn(
                        "grid size-11 shrink-0 place-items-center overflow-hidden rounded-pill bg-green-50 text-green-700 transition-colors duration-200 hover:bg-green-100",
                        s.userRole && avatarRingClass(s.userRole),
                      )}
                    >
                      {avatarContent}
                    </Link>
                  ) : (
                    <span className="grid size-11 shrink-0 place-items-center rounded-pill bg-green-50 text-green-700">
                      {avatarContent}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="truncate text-label font-medium text-ink">
                        {name ?? dict.studio.searchesAnonymous}
                      </p>
                      <p className="tnum shrink-0 text-caption text-slate">
                        {formatDate(s.createdAt, locale, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "mt-0.5 text-label",
                        hasMatch ? "text-green-700" : "text-slate",
                      )}
                    >
                      {hasMatch
                        ? t(dict.studio.searchesMatchCount, {
                            count: formatNumber(s.matchCount, locale),
                          })
                        : dict.studio.searchesNoMatch}
                    </p>
                  </div>

                  {clickable && (
                    <Link
                      href={searchHref(s.id)}
                      aria-current={active ? "page" : undefined}
                      aria-label={dict.studio.searchesViewAll}
                      title={dict.studio.searchesViewAll}
                      className={cn(
                        "mr-2 grid size-11 shrink-0 place-items-center rounded-pill transition-colors duration-200",
                        active
                          ? "bg-green-600 text-paper"
                          : "text-slate hover:bg-cloud hover:text-green-700",
                      )}
                    >
                      <ChevronRightIcon size={18} />
                    </Link>
                  )}
                </li>
              );
            }}
          />
        </section>
      )}

      {downloaders.length > 0 && (
        <section className="reveal mt-12">
          <h2 className="text-h2">{dict.studio.downloadersTitle}</h2>
          {/* Same reasoning as the searches list above: five rows visible,
              the rest a scroll away rather than paginated — the search box
              only adds a way to jump to one name, it does not replace the
              full scrolling list. */}
          <SearchableList
            items={downloaders}
            getSearchText={(d) => d.userName ?? d.userEmail ?? dict.studio.searchesAnonymous}
            dict={dict}
            renderItem={(d, rowHidden) => {
              const name = d.userName ?? d.userEmail;
              const initial = name?.trim().charAt(0).toUpperCase();
              const active = (d.userId ?? "anonymous") === downloader;

              const avatarContent = d.userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={d.userImage}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : initial ? (
                <span className="font-display text-label font-semibold" aria-hidden>
                  {initial}
                </span>
              ) : (
                <UsersIcon size={18} />
              );

              return (
                <li
                  key={d.userId ?? "anonymous"}
                  className={cn(
                    "flex items-center gap-4 p-4 transition-colors duration-200",
                    active && "bg-green-50",
                    rowHidden && "hidden",
                  )}
                >
                  {/* Only the avatar leads to the profile — see the same
                      note on the searches list above. The chevron is its
                      own separate target, for what they downloaded. */}
                  {d.userId ? (
                    <Link
                      href={`/profile/${d.userId}`}
                      aria-label={t(dict.studio.viewProfile, {
                        name: name ?? dict.studio.searchesAnonymous,
                      })}
                      className={cn(
                        "grid size-11 shrink-0 place-items-center overflow-hidden rounded-pill bg-green-50 text-green-700 transition-colors duration-200 hover:bg-green-100",
                        d.userRole && avatarRingClass(d.userRole),
                      )}
                    >
                      {avatarContent}
                    </Link>
                  ) : (
                    <span className="grid size-11 shrink-0 place-items-center rounded-pill bg-green-50 text-green-700">
                      {avatarContent}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="truncate text-label font-medium text-ink">
                        {name ?? dict.studio.searchesAnonymous}
                      </p>
                      <p className="tnum shrink-0 text-caption text-slate">
                        {formatDate(d.lastDownloadAt, locale, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <p className="mt-0.5 text-label text-green-700">
                      {t(dict.studio.downloadersCount, {
                        count: formatNumber(d.downloadCount, locale),
                      })}
                    </p>
                  </div>

                  <Link
                    href={downloaderHref(d.userId)}
                    aria-current={active ? "page" : undefined}
                    aria-label={dict.studio.downloadersViewAll}
                    title={dict.studio.downloadersViewAll}
                    className={cn(
                      "mr-2 grid size-11 shrink-0 place-items-center rounded-pill transition-colors duration-200",
                      active
                        ? "bg-green-600 text-paper"
                        : "text-slate hover:bg-cloud hover:text-green-700",
                    )}
                  >
                    <ChevronRightIcon size={18} />
                  </Link>
                </li>
              );
            }}
          />
        </section>
      )}

      <section id="photos" className="reveal mt-12 scroll-mt-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-h2">{dict.studio.photosTitle}</h2>
            <PhotoUploader
              eventId={event.id}
              labels={dict.studio}
              closeLabel={dict.common.close}
            />
          </div>
          {(face || search) && (
            <p className="flex flex-wrap items-center gap-2 text-label text-slate">
              <span className={face ? "font-mono" : undefined}>
                {face
                  ? t(dict.studio.facesFilterActive, { id: face.slice(0, 8) })
                  : t(dict.studio.searchesFilterActive, {
                      name:
                        activeSearch?.userName ??
                        activeSearch?.userEmail ??
                        dict.studio.searchesAnonymous,
                    })}
              </span>
              <Link
                href={`/studio/events/${event.id}#photos`}
                className="font-medium text-green-700 underline underline-offset-4"
              >
                {dict.studio.facesFilterClear}
              </Link>
            </p>
          )}
        </div>

        {photos.length === 0 ? (
          <div className="relative mt-5 overflow-hidden rounded-card bg-cloud px-6 py-16 text-center">
            <GridBackground />
            <p className="relative text-body text-slate">
              {dict.studio.photosNone}
            </p>
            {(face || search || downloader) && (
              <Link
                href={`/studio/events/${event.id}#photos`}
                className="relative mt-3 inline-block text-label font-medium text-green-700 underline underline-offset-4"
              >
                {dict.studio.facesFilterClear}
              </Link>
            )}
          </div>
        ) : (
          <DeletePhotosForm
            eventId={event.id}
            dict={dict}
            photos={photos.map((photo) => ({
              id: photo.id,
              thumbSrc: `/api/media/${photo.thumbPath}`,
              previewSrc: `/api/media/${photo.previewPath}`,
              alt: photo.originalFilename,
              originalPath: photo.originalPath,
              statusLabel: photoStatusLabel(photo),
              indexFailed: photo.indexStatus === "failed",
            }))}
            // A grid cell appended after the last photo rather than a
            // button sitting below the whole grid — "more of the same set"
            // reads more naturally as one more card in that set than as a
            // separate control underneath it.
            //
            // Always rendered, the link inside it conditional — not the
            // other way around. The click that exhausts the last photos
            // lands on a page where the link's own condition is now false,
            // and a `#load-more` in the URL with no matching id anywhere
            // on the page is exactly what was scrolling straight to the
            // top: the browser found nothing to scroll to and fell back to
            // the default. An anchor with nothing inside it some of the
            // time is still an anchor every time.
            trailingItem={
              <div id="load-more" className="scroll-mt-20">
                {/* `>=` rather than `===`: a filtered result can come back
                    shorter than `show` even when there is nothing left to
                    raise `show` for — this is the same "did we actually
                    hit the cap" check that decides whether there might be
                    more, not a promise there is. */}
                {photos.length >= show && (
                  <Link
                    href={loadMoreHref}
                    className="group flex aspect-square min-h-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-media bg-cloud p-1 text-center ring-1 ring-edge transition-colors duration-200 hover:bg-green-50 hover:ring-green-300"
                  >
                    <ChevronDownIcon
                      size={16}
                      className="shrink-0 text-slate transition-colors duration-200 group-hover:text-green-700"
                    />
                    {remaining !== null && remaining > 0 && (
                      <span className="tnum whitespace-nowrap font-display text-body font-bold leading-none text-ink transition-colors duration-200 group-hover:text-green-700">
                        {t(dict.studio.photosRemaining, {
                          count: formatNumber(remaining, locale),
                        })}
                      </span>
                    )}
                    <span className="px-1 text-caption leading-tight font-medium text-slate transition-colors duration-200 group-hover:text-green-700">
                      {dict.studio.photosLoadMore}
                    </span>
                  </Link>
                )}
              </div>
            }
          />
        )}
      </section>
    </section>
  );
}
