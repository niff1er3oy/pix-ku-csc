import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PhotoGallery } from "@/components/photos/photo-gallery";
import { FaceSearchPanel } from "@/components/search/face-search-panel";
import { GridBackground } from "@/components/ui/grid-background";
import { getPhotographer, getSessionUser } from "@/lib/dal";
import { getDictionary, getLocale, t } from "@/lib/i18n";
import {
  getEventBySlug,
  getEventPhotos,
  getPendingIndexCount,
} from "@/lib/queries/event";
import { formatDate, formatNumber } from "@/lib/utils";

const PAGE_SIZE = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const [locale, event] = await Promise.all([
    getLocale(),
    getEventBySlug(code).catch(() => null),
  ]);
  if (!event) return {};

  const name = locale === "en" && event.nameEn ? event.nameEn : event.nameTh;
  return {
    title: name,
    // Unlisted events must not be indexed — the URL is the access control.
    robots: event.isPrivate ? { index: false, follow: false } : undefined,
  };
}

/**
 * Where the QR code lands. Everything a visitor needs is on this one page —
 * the gallery and the face search sit together rather than across two routes,
 * because the promise is thirty seconds from scan to photos and a navigation
 * step buys nothing.
 */
export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ code }, { page: pageParam }, locale, dict] = await Promise.all([
    params,
    searchParams,
    getLocale(),
    getDictionary(),
  ]);

  const event = await getEventBySlug(code);
  if (!event) notFound();

  const user = await getSessionUser();
  const photographer = user ? await getPhotographer(user.id) : null;
  const isManager =
    user?.role === "admin" || photographer?.id === event.ownerId;

  // Before approval the event exists only for its owner and for admins. A 404
  // rather than a 403 so an unapproved slug cannot be probed for existence.
  if (event.status !== "approved" && !isManager) notFound();

  const page = Math.max(1, Number(pageParam) || 1);
  const [{ photos, total, pageCount }, pendingIndex] = await Promise.all([
    getEventPhotos(event.id, page, PAGE_SIZE),
    getPendingIndexCount(event.id),
  ]);

  const name = locale === "en" && event.nameEn ? event.nameEn : event.nameTh;
  const description =
    locale === "en" && event.descriptionEn
      ? event.descriptionEn
      : event.descriptionTh;

  return (
    <>
      {/* --- Event header ------------------------------------------------ */}
      <header className="border-b border-edge bg-cloud">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
          {event.status !== "approved" && (
            <p className="mb-4 inline-block rounded-pill bg-lime-500 px-4 py-1.5 text-label font-semibold text-green-950">
              {dict.status[event.status]}
            </p>
          )}

          <h1 className="text-h1 font-bold">{name}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-pill bg-paper px-3 py-1 text-caption font-medium text-green-700">
              {formatDate(event.eventDate, locale)}
            </span>
            {event.location && (
              <span className="rounded-pill bg-paper px-3 py-1 text-caption font-medium text-green-700">
                {event.location}
              </span>
            )}
            <span className="tnum rounded-pill bg-paper px-3 py-1 text-caption font-medium text-green-700">
              {formatNumber(total, locale)} {dict.common.photos}
            </span>
          </div>

          <p className="mt-4 text-label text-slate">
            {dict.event.by} {event.photographerName}
          </p>

          {description && (
            <p className="mt-4 max-w-2xl text-body text-slate">{description}</p>
          )}

          {pendingIndex > 0 && (
            <p className="mt-6 rounded-field bg-lime-100 px-4 py-3 text-label text-green-900">
              <strong className="font-semibold">{dict.event.indexing}</strong>{" "}
              {t(dict.event.indexingBody, {
                count: formatNumber(pendingIndex, locale),
              })}
            </p>
          )}
        </div>
      </header>

      {/* --- Face search, inline ------------------------------------------ */}
      <FaceSearchPanel
        eventId={event.id}
        eventSlug={event.accessCode}
        dict={dict}
        signedIn={Boolean(user)}
        watermarked={event.watermarkEnabled}
        allowDownload={event.allowOriginalDownload}
      />

      {/* --- Gallery ------------------------------------------------------ */}
      <section className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <h2 className="text-h2">{dict.event.browseAll}</h2>

        {photos.length === 0 ? (
          <div className="relative mt-8 overflow-hidden rounded-card bg-cloud px-6 py-16 text-center sm:py-20">
            <GridBackground />
            <div className="relative">
              <p className="font-display text-h3 font-semibold">
                {dict.event.galleryEmpty}
              </p>
              <p className="mx-auto mt-2 max-w-sm text-body text-slate">
                {dict.event.galleryEmptyBody}
              </p>
            </div>
          </div>
        ) : (
          <>
            <PhotoGallery
              className="mt-8"
              items={photos.map((photo) => ({
                id: photo.id,
                thumbSrc: `/api/media/${photo.thumbPath}`,
                previewSrc: `/api/media/${photo.previewPath}`,
                width: photo.width,
                height: photo.height,
                viewTransitionName: `photo-${photo.id}`,
                downloadHref: event.allowOriginalDownload
                  ? `/api/media/${photo.originalPath}?download=1`
                  : undefined,
              }))}
              labels={{
                close: dict.common.close,
                previous: dict.common.back,
                next: dict.common.next,
                download: dict.results.downloadOne,
              }}
            />

            {pageCount > 1 && (
              <Pagination
                page={page}
                pageCount={pageCount}
                code={event.accessCode}
                dict={dict}
              />
            )}
          </>
        )}
      </section>
    </>
  );
}

/**
 * Plain links, not an infinite scroller: a 5,000-photo event is 84 pages, and
 * a link keeps a position shareable and the page usable without JavaScript.
 */
function Pagination({
  page,
  pageCount,
  code,
  dict,
}: {
  page: number;
  pageCount: number;
  code: string;
  dict: Awaited<ReturnType<typeof getDictionary>>;
}) {
  const link =
    "rounded-pill px-5 py-2.5 text-label font-medium ring-1 ring-inset ring-edge transition-colors duration-200 hover:bg-green-50 hover:ring-green-300";

  return (
    <nav
      className="mt-10 flex items-center justify-center gap-3"
      aria-label={dict.event.browseAll}
    >
      {page > 1 ? (
        <Link href={`/e/${code}?page=${page - 1}`} className={link}>
          {dict.common.back}
        </Link>
      ) : (
        <span className={`${link} pointer-events-none opacity-40`}>
          {dict.common.back}
        </span>
      )}

      <span className="tnum text-label text-slate">
        {page} / {pageCount}
      </span>

      {page < pageCount ? (
        <Link href={`/e/${code}?page=${page + 1}`} className={link}>
          {dict.common.next}
        </Link>
      ) : (
        <span className={`${link} pointer-events-none opacity-40`}>
          {dict.common.next}
        </span>
      )}
    </nav>
  );
}
