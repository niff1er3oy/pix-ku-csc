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
  PhotoIcon,
  PrintIcon,
  SettingsIcon,
  TrashIcon,
} from "@/components/ui/icon";
import { publishEvent } from "@/lib/actions/studio";
import { requireApprovedPhotographer } from "@/lib/dal";
import { getDictionary, getLocale, t } from "@/lib/i18n";
import { eventQrSvg, eventUrl } from "@/lib/qr";
import { CopyLinkButton } from "@/components/studio/copy-link-button";
import {
  DELETE_PHOTOS_FORM_ID,
  DeletePhotosForm,
} from "@/components/studio/delete-photos-form";
import { EventHealthCard } from "@/components/studio/event-health-card";
import { PhotoUploader } from "@/components/studio/photo-uploader";
import { RetryIndexButton } from "@/components/studio/retry-index-button";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { StatusChip } from "@/components/studio/status-chip";
import {
  getMyEvent,
  getMyEventPhotos,
  getMyEventSearches,
} from "@/lib/queries/studio";
import { cn, formatDate, formatNumber } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { photographer } = await requireApprovedPhotographer();
  const { id } = await params;
  const event = await getMyEvent(photographer.id, id);
  return { title: event?.nameTh ?? "" };
}

/**
 * One event, from its owner's side.
 *
 * `getMyEvent` filters on `ownerId` inside the query, so an id belonging to
 * somebody else returns nothing and this 404s rather than showing a stranger
 * their access code — the one value that opens an unlisted gallery.
 */
export default async function StudioEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ face?: string; search?: string; show?: string }>;
}) {
  const { photographer } = await requireApprovedPhotographer();
  const { id } = await params;
  // Rekognition face ids are UUIDs (36 chars); sliced defensively the same
  // way `admin`'s `q` param is, since this reaches a `where` clause below.
  // `search` is a `search.id`, same shape, same reasoning.
  const resolvedSearchParams = await searchParams;
  const face = resolvedSearchParams.face?.slice(0, 64) || undefined;
  const search = resolvedSearchParams.search?.slice(0, 64) || undefined;
  // How many photos "show more" has raised the grid to, in steps of 20 —
  // clamped below so a hand-edited URL cannot ask for an unbounded fetch.
  const rawShow = Number(resolvedSearchParams.show);
  const show =
    Number.isFinite(rawShow) && rawShow > 20
      ? Math.min(Math.floor(rawShow), 2000)
      : 20;
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);

  const event = await getMyEvent(photographer.id, id);
  if (!event) notFound();

  const [photos, searches] = await Promise.all([
    getMyEventPhotos(photographer.id, id, {
      faceId: face,
      searchId: search,
      limit: show,
    }),
    getMyEventSearches(photographer.id, id),
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

  // Builds the link each search row's face chips use, so clicking one lands
  // on the same filtered photo grid no matter which search it came from.
  const faceHref = (faceId: string) =>
    faceId === face
      ? `/studio/events/${event.id}#photos`
      : `/studio/events/${event.id}?face=${faceId}#photos`;
  // Same idea, but for a search row's own "view all matches" button — this
  // filters by every face that one search hit, not just one of them.
  const searchHref = (searchId: string) =>
    searchId === search
      ? `/studio/events/${event.id}#photos`
      : `/studio/events/${event.id}?search=${searchId}#photos`;
  // "Show more" just raises `show` by 20 and reloads this same query at the
  // new limit — carrying `face`/`search` along so loading more photos never
  // drops whichever filter is active.
  const loadMoreParams = new URLSearchParams();
  if (face) loadMoreParams.set("face", face);
  if (search) loadMoreParams.set("search", search);
  loadMoreParams.set("show", String(show + 20));
  // `#load-more` rather than `#photos`: the button re-renders at the bottom
  // of the (now longer) grid on every click, so anchoring there lands the
  // photographer back where they were — next to the photos that just
  // appeared — instead of yanking them up to the section heading they
  // already scrolled past to get here.
  const loadMoreHref = `/studio/events/${event.id}?${loadMoreParams}#load-more`;
  const faceChipClass = (active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center whitespace-nowrap rounded-pill px-4 font-mono text-sm font-medium transition-colors duration-200",
      active
        ? "bg-green-600 text-paper"
        : "bg-cloud text-slate hover:bg-green-50 hover:text-green-700",
    );

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
          <ul className="mt-4 divide-y divide-edge rounded-card ring-1 ring-edge">
            {searches.map((s) => (
              <li
                key={s.id}
                className="p-4 transition-colors duration-200 hover:bg-cloud"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-label font-medium text-ink">
                    {s.userName ?? s.userEmail ?? dict.studio.searchesAnonymous}
                  </p>
                  <p className="tnum text-caption text-slate">
                    {formatDate(s.createdAt, locale, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <p className="mt-1 text-label text-slate">
                  {s.matchCount > 0
                    ? t(dict.studio.searchesMatchCount, {
                        count: formatNumber(s.matchCount, locale),
                      })
                    : dict.studio.searchesNoMatch}
                </p>
                {s.faceIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {s.faceIds.length > 1 && (
                      <Link
                        href={searchHref(s.id)}
                        aria-current={s.id === search ? "page" : undefined}
                        className={cn(
                          "inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-pill px-4 text-label font-medium transition-colors duration-200",
                          s.id === search
                            ? "bg-green-600 text-paper"
                            : "bg-green-50 text-green-700 hover:bg-green-100",
                        )}
                      >
                        <PhotoIcon size={16} />
                        {dict.studio.searchesViewAll}
                      </Link>
                    )}
                    {s.faceIds.map((faceId) => {
                      const active = faceId === face;
                      return (
                        <Link
                          key={faceId}
                          href={faceHref(faceId)}
                          aria-current={active ? "page" : undefined}
                          title={faceId}
                          className={faceChipClass(active)}
                        >
                          {faceId.slice(0, 8)}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
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
            {(face || search) && (
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
            submitLabel={dict.studio.photosDeleteSelected}
            downloadLabel={dict.studio.photosDownloadSelected}
            selectAllLabel={dict.studio.photosSelectAll}
            confirmMessage={dict.studio.photosDeleteConfirm}
            selectNoneMessage={dict.studio.photosSelectNone}
          >
            <PhotoGallery
              className="mt-5"
              gridClassName="grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
              aspect="square"
              items={photos.map((photo) => ({
                id: photo.id,
                thumbSrc: `/api/media/${photo.thumbPath}`,
                previewSrc: `/api/media/${photo.previewPath}`,
                alt: photo.originalFilename,
                // The owner can always pull their own original — see the
                // `isManager` bypass in `/api/media`'s authorize().
                downloadHref: `/api/media/${photo.originalPath}?download=1`,
                badge:
                  photo.indexStatus === "failed" ? (
                    <span className="rounded-pill bg-danger px-1.5 py-0.5 text-caption font-semibold text-paper">
                      !
                    </span>
                  ) : undefined,
                meta: photoStatusLabel(photo),
                // Submits into `DeletePhotosForm`'s form by id rather than
                // by DOM position — the lightbox this renders inside of is
                // portalled to `document.body`, well outside that form's own
                // subtree, and `form="…"` is exactly what that attribute is
                // for.
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
                select: (
                  <div className="flex flex-col items-start gap-1">
                    <input
                      type="checkbox"
                      name="photoIds"
                      value={photo.id}
                      // Read back by `DeletePhotosForm`'s download button —
                      // piggybacking on the checkbox that is already there
                      // for delete means bulk download needs no selection
                      // state of its own and no new endpoint: it is the same
                      // per-photo authorized route each thumbnail's own
                      // download link already uses, just triggered several
                      // times over.
                      data-download-href={`/api/media/${photo.originalPath}?download=1`}
                      aria-label={t(dict.studio.photosSelect, {
                        name: photo.originalFilename,
                      })}
                      className="size-5 rounded border-2 border-paper bg-paper/80 accent-[var(--color-green-600)] shadow-[var(--shadow-card)]"
                    />
                    {photo.indexStatus === "failed" && (
                      <RetryIndexButton
                        photoId={photo.id}
                        label={dict.studio.photosRetryIndex}
                      />
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
          </DeletePhotosForm>
        )}

        {/* Always rendered, the button inside it conditional — not the
            other way around. The click that exhausts the last photos lands
            on a page where the button's own condition is now false, and a
            `#load-more` in the URL with no matching id anywhere on the page
            is exactly what was scrolling straight to the top: the browser
            found nothing to scroll to and fell back to the default. An
            anchor with nothing inside it some of the time is still an
            anchor every time. */}
        <div id="load-more" className="mt-5 flex scroll-mt-20 justify-center">
          {/* `>=` rather than `===`: a filtered result can come back shorter
              than `show` even when there is nothing left to raise `show`
              for — this is the same "did we actually hit the cap" check
              that decides whether there might be more, not a promise there
              is. */}
          {photos.length >= show && (
            <ButtonLink href={loadMoreHref} variant="secondary" size="md">
              <ChevronDownIcon size={18} />
              {dict.studio.photosLoadMore}
            </ButtonLink>
          )}
        </div>
      </section>
    </section>
  );
}
