import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button, ButtonLink } from "@/components/ui/button";
import { GridBackground } from "@/components/ui/grid-background";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  PhotoIcon,
  SettingsIcon,
} from "@/components/ui/icon";
import { publishEvent } from "@/lib/actions/studio";
import { requireApprovedPhotographer } from "@/lib/dal";
import { getDictionary, getLocale, t } from "@/lib/i18n";
import { eventQrSvg, eventUrl } from "@/lib/qr";
import { DeletePhotosForm } from "@/components/studio/delete-photos-form";
import { PhotoUploader } from "@/components/studio/photo-uploader";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { StatusChip } from "@/components/studio/status-chip";
import { getMyEvent, getMyEventPhotos } from "@/lib/queries/studio";
import { formatDate, formatNumber } from "@/lib/utils";

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
}: {
  params: Promise<{ id: string }>;
}) {
  const { photographer } = await requireApprovedPhotographer();
  const { id } = await params;
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);

  const event = await getMyEvent(photographer.id, id);
  if (!event) notFound();

  const photos = await getMyEventPhotos(photographer.id, id);
  const [qr, url] = [await eventQrSvg(event.accessCode), eventUrl(event.accessCode)];

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/studio"
          className="inline-flex min-h-11 items-center gap-1 text-label font-medium text-green-700 hover:underline"
        >
          <ChevronLeftIcon size={18} />
          {dict.studio.backToStudio}
        </Link>

        <ButtonLink
          href={`/studio/events/${event.id}/settings`}
          variant="ghost"
          size="sm"
        >
          <SettingsIcon size={16} />
          {dict.studio.settingsButton}
        </ButtonLink>
      </div>

      {event.coverPath && (
        /* The photographer's own choice, shown back to them at the size it
           will appear on the event card. A cover picked from a phone gallery
           and never seen again is a cover nobody checked. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={`/api/media/${event.coverPath}`}
          alt=""
          className="mt-6 aspect-[4/3] w-full max-w-sm rounded-card object-cover ring-1 ring-edge"
        />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-h1 font-bold">{event.nameTh}</h1>
        <StatusChip status={event.status} labels={dict.status} />
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-label text-slate">
        <span className="inline-flex items-center gap-1.5">
          <CalendarIcon size={16} />
          {formatDate(event.eventDate, locale)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <PhotoIcon size={16} />
          {t(dict.studio.photosInEvent, {
            count: formatNumber(event.photoCount, locale),
          })}
        </span>
        {event.location && <span>{event.location}</span>}
      </p>

      <p className="mt-3 text-label text-slate">{statusNote}</p>
      {event.status === "rejected" && event.rejectionReason && (
        <p className="mt-2 text-label text-danger">{event.rejectionReason}</p>
      )}

      {/* The QR and the code together, because they are one thing: the QR
          resolves to /e/{code} and the code is what somebody types when the
          sign is across a crowded field and their camera will not focus. */}
      <div className="mt-10 grid gap-6 rounded-card bg-cloud p-5 sm:grid-cols-[auto_1fr] sm:p-6">
        <div
          className="mx-auto w-40 [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qr }}
        />

        <div className="min-w-0">
          <p className="text-label font-medium text-ink">
            {dict.studio.qrTitle}
          </p>
          <p className="tnum mt-2 font-display text-h1 font-bold tracking-[0.2em] text-green-700">
            {event.accessCode}
          </p>
          <p className="mt-2 break-all text-caption text-slate">{url}</p>
          <p className="mt-2 text-caption text-slate">
            {dict.studio.formAccessCodeHint}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
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
              {dict.studio.qrPrint}
            </ButtonLink>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {event.status === "draft" && (
          <form action={publishEvent}>
            <input type="hidden" name="id" value={event.id} />
            <Button type="submit" size="md">
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
      </div>

      <PhotoUploader eventId={event.id} labels={dict.studio} />

      <section className="mt-12">
        <h2 className="text-h2">{dict.studio.photosTitle}</h2>

        {photos.length === 0 ? (
          <div className="relative mt-5 overflow-hidden rounded-card bg-cloud px-6 py-16 text-center">
            <GridBackground />
            <p className="relative text-body text-slate">
              {dict.studio.photosNone}
            </p>
          </div>
        ) : (
          <DeletePhotosForm
            eventId={event.id}
            submitLabel={dict.studio.photosDeleteSelected}
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
                select: (
                  <input
                    type="checkbox"
                    name="photoIds"
                    value={photo.id}
                    aria-label={t(dict.studio.photosSelect, {
                      name: photo.originalFilename,
                    })}
                    className="size-5 rounded border-2 border-paper bg-paper/80 accent-[var(--color-green-600)] shadow-[var(--shadow-card)]"
                  />
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
      </section>
    </section>
  );
}
