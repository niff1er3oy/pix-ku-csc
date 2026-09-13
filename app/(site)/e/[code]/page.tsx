import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EventPinGate } from "@/components/events/event-pin-gate";
import { EventGallery } from "@/components/photos/event-gallery";
import { SavedPhotosSection } from "@/components/profile/saved-photos-section";
import { FaceSearchPanel } from "@/components/search/face-search-panel";
import { Avatar } from "@/components/ui/avatar";
import { GridBackground } from "@/components/ui/grid-background";
import { canManageEvent, getPhotographer, getSessionUser } from "@/lib/dal";
import { isPinCookieValid, pinCookieName } from "@/lib/event-pin";
import { getDictionary, getLocale, t } from "@/lib/i18n";
import {
  getEventBySlug,
  getEventPhotos,
  getEventStats,
  getPendingIndexCount,
} from "@/lib/queries/event";
import { getMyFace } from "@/lib/queries/profile";
import { getMySavedPhotosForEvent } from "@/lib/queries/saved-photos";
import { formatDate, formatNumber, mediaSrc } from "@/lib/utils";

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

  const name = locale === "en" && event.nameEn ? event.nameEn : event.nameTh;

  const user = await getSessionUser();
  const [photographer, savedFace, savedPhotos] = await Promise.all([
    user ? getPhotographer(user.id) : null,
    user ? getMyFace(user.id) : null,
    user ? getMySavedPhotosForEvent(user.id, event.id) : [],
  ]);
  const isManager = !!user && canManageEvent(user, event, photographer);

  // Before approval the event exists only for its owner and for admins. A 404
  // rather than a 403 so an unapproved slug cannot be probed for existence.
  if (event.status !== "approved" && !isManager) notFound();

  // A private event's PIN is the second factor its access code alone was
  // never meant to be — see the note on `entryPin` in `db/schema.ts`.
  // Skipped for whoever manages the event, same as the approval gate above.
  if (event.isPrivate && event.entryPin && !isManager) {
    const store = await cookies();
    const verified = isPinCookieValid(
      event.id,
      store.get(pinCookieName(event.id))?.value,
    );
    if (!verified) {
      return <EventPinGate eventId={event.id} eventName={name} dict={dict} />;
    }
  }

  const page = Math.max(1, Number(pageParam) || 1);
  const [{ photos, total, pageCount }, pendingIndex, stats] = await Promise.all([
    getEventPhotos(event.id, page, PAGE_SIZE),
    getPendingIndexCount(event.id),
    getEventStats(event.id),
  ]);

  const description =
    locale === "en" && event.descriptionEn
      ? event.descriptionEn
      : event.descriptionTh;

  return (
    <>
      {/* --- Event header ------------------------------------------------ */}
      <header className="border-b border-edge bg-cloud">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
            {/* The cover a photographer chose (or the first photo uploaded,
                same fallback every card elsewhere uses) — a fixed-size
                square thumbnail beside the details rather than a wide hero
                banner: `buildCoverImage` already smart-crops the stored file
                to a square, so this is the one aspect ratio that shows it
                with no further cropping at all, and staying compact keeps
                the search button below in reach on a phone without
                scrolling past a dominating image — the "thirty seconds from
                QR to photo" promise this page exists for. */}
            {event.coverThumbPath && (
              <div className="enter aspect-square w-24 shrink-0 overflow-hidden rounded-card shadow-card sm:w-36 lg:w-44">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/media/${event.coverThumbPath}`}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div className="min-w-0 flex-1">
              {event.status !== "approved" && (
                <p className="mb-4 inline-block rounded-pill bg-lime-500 px-4 py-1.5 text-label font-semibold text-green-950">
                  {dict.status[event.status]}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-h1 font-bold">{name}</h1>
                <FaceSearchPanel
                  eventId={event.id}
                  eventSlug={event.accessCode}
                  dict={dict}
                  signedIn={Boolean(user)}
                  savedFaceImagePath={savedFace?.imagePath ?? null}
                  watermarked={event.watermarkEnabled}
                  allowDownload={event.allowOriginalDownload}
                />
              </div>

              {/* Two clusters, not one flat row of six: date/location/photo
                  count are what an anonymous QR-scan visitor actually
                  orients by ("is this the right event, is there anything
                  here"), so those keep the pill treatment exactly as
                  before. Face/download/save counts are more like
                  vanity/trust stats than a decision this visitor needs to
                  make — demoted to quiet inline text, same pattern
                  `SavedPhotosByEvent` already uses for secondary figures,
                  and set apart with extra top margin so the two groups
                  read as separate at a glance instead of one long strip. */}
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

              <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption text-slate">
                <span className="tnum">
                  {formatNumber(stats.faceCount, locale)} {dict.common.faces}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tnum">
                  {formatNumber(stats.downloadCount, locale)} {dict.common.downloads}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tnum">
                  {formatNumber(stats.saveCount, locale)} {dict.common.saves}
                </span>
              </div>

              {/* An affiliation-shot event credits the affiliation here, not
                  whichever member happened to create it — the same rule
                  `EventCard` follows (see its own note in
                  `lib/queries/public.ts`), for the same reason: "shot by KU
                  Photo Club" says more here than any one member's name. */}
              <p className="mt-4 flex flex-wrap items-center gap-2 text-label text-slate">
                {dict.event.by}
                {event.affiliationId && event.affiliationName ? (
                  <Link
                    href={`/affiliations/${event.affiliationId}`}
                    className="flex items-center gap-2 font-medium text-ink transition-colors duration-200 hover:text-green-700"
                  >
                    <Avatar src={event.affiliationImage} size={24} />
                    {event.affiliationName}
                  </Link>
                ) : (
                  <Link
                    href={`/profile/${event.photographerUserId}`}
                    className="flex items-center gap-2 font-medium text-ink transition-colors duration-200 hover:text-green-700"
                  >
                    <Avatar src={event.photographerImage} size={24} />
                    {event.photographerName}
                  </Link>
                )}
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
          </div>
        </div>
      </header>

      {/* --- Saved photos, from a search of this same event — skipped
          entirely rather than shown empty, unlike `/profile/[id]`: this is
          a bonus shortcut on an already busy page, not the page's whole
          reason to exist. ------------------------------------------------ */}
      {savedPhotos.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-5 pt-14 sm:px-8 sm:pt-20">
          <SavedPhotosSection dict={dict} photos={savedPhotos} locale={locale} />
        </section>
      )}

      {/* --- Gallery ------------------------------------------------------ */}
      {/* `id` is `FaceSearchPanel`'s own "browse the event yourself" link
          target for a zero-match search — scroll-mt keeps the heading clear
          of the sticky site header when that anchor lands here. */}
      <section
        id="browse-gallery"
        className="scroll-mt-20 mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20"
      >
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
            {/* No `viewTransitionName` on these thumbs — this used to pass
                `photo-${photo.id}` so a grid thumb could morph into the
                lightbox, but opening the lightbox is a same-page state
                toggle, not a navigation, and even wrapped in
                `startTransition` it reliably hit React's "two
                <ViewTransition> with the same name mounted at once" error
                the instant the lightbox opened — a hard console error on
                every click, for an animation that was not reliably working
                anyway. `PhotoThumb`/`PhotoLightbox` still support the prop;
                it is safe to try again here once that pairing is confirmed
                stable in this Next.js version. */}
            <EventGallery
              photos={photos.map((photo) => ({
                id: photo.id,
                thumbSrc: mediaSrc(photo.thumbPath),
                previewSrc: mediaSrc(photo.previewPath),
                width: photo.width,
                height: photo.height,
                originalPath: photo.originalPath,
                faceCount: photo.faceCount,
              }))}
              allowDownload={event.allowOriginalDownload}
              dict={dict}
              locale={locale}
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
