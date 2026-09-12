import Link from "next/link";
import { ViewTransition } from "react";

import { Avatar } from "@/components/ui/avatar";
import { GridBackground } from "@/components/ui/grid-background";
import { LockIcon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/loading";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { EventCard as EventCardData } from "@/lib/queries/public";
import { formatDate, formatNumber } from "@/lib/utils";

/**
 * Shared by the landing page and the events index so the two can never drift.
 * The cover is wrapped in a named ViewTransition, which the event page picks
 * up to carry the image across instead of hard-cutting.
 */
export function EventCard({
  event,
  locale,
  dict,
  className,
  style,
}: {
  event: EventCardData;
  locale: Locale;
  dict: Dictionary;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <li className={className} style={style}>
      {/* `group` moved up to this wrapper rather than staying on the event
          `Link` below — the photographer line is now its own sibling link
          (two `<a>`s cannot nest), and the card's lift/shadow hover should
          still react no matter which of the two a visitor is pointing at. */}
      <div className="group overflow-hidden rounded-card bg-paper shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[3px] hover:shadow-[var(--shadow-lift)]">
        <Link href={`/e/${event.accessCode}`} className="block">
          <ViewTransition name={`event-cover-${event.id}`}>
            <div className="relative aspect-[4/3] overflow-hidden bg-green-100">
              {event.coverThumbPath ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/media/${event.coverThumbPath}`}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                />
              ) : (
                <div className="relative h-full w-full">
                  <GridBackground fade={false} />
                </div>
              )}

              {/* Only an admin's request for this card's data ever sets
                  `isPrivate` on a row that is actually private — see
                  `getPhotographerPortfolio`'s `includePrivate`. Badged so a
                  grid mixing public and private work never reads as if it
                  were all public. */}
              {event.isPrivate && (
                <span
                  title={dict.studio.formPrivate}
                  className="absolute right-3 top-3 grid size-8 place-items-center rounded-pill bg-ink/70 text-paper backdrop-blur-sm"
                >
                  <LockIcon size={16} />
                </span>
              )}
            </div>
          </ViewTransition>

          <div className="px-5 pt-5">
            <h3 className="text-h3 leading-snug text-ink">
              {locale === "en" && event.nameEn ? event.nameEn : event.nameTh}
            </h3>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-pill bg-green-50 px-3 py-1 text-caption font-medium text-green-700">
                {formatDate(event.eventDate, locale)}
              </span>
              <span className="tnum rounded-pill bg-green-50 px-3 py-1 text-caption font-medium text-green-700">
                {formatNumber(event.photoCount, locale)} {dict.common.photos}
              </span>
            </div>
          </div>
        </Link>

        {/* An affiliation-shot event credits the affiliation here, not
            whichever member happened to create it — "shot by KU Photo Club"
            says more on a feed mixing everyone's work than any one member's
            name would. `getAffiliationPortfolio` deliberately leaves
            `affiliationId` null on its own rows so this still falls back to
            the individual on the affiliation's own page, where crediting
            the affiliation you are already looking at would say nothing
            new — see the note on `EventCard` in `lib/queries/public.ts`. */}
        {event.affiliationId && event.affiliationName ? (
          <Link
            href={`/affiliations/${event.affiliationId}`}
            className="mt-3 flex w-fit items-center gap-2 px-5 pb-5 text-label text-slate transition-colors duration-200 hover:text-green-700"
          >
            <Avatar src={event.affiliationImage} size={20} />
            <span className="truncate">
              {dict.event.by} {event.affiliationName}
            </span>
          </Link>
        ) : (
          <Link
            href={`/profile/${event.photographerUserId}`}
            className="mt-3 flex w-fit items-center gap-2 px-5 pb-5 text-label text-slate transition-colors duration-200 hover:text-green-700"
          >
            <Avatar src={event.photographerImage} size={20} />
            <span className="truncate">
              {dict.event.by} {event.photographerName}
            </span>
          </Link>
        )}
      </div>
    </li>
  );
}

/**
 * The card's loading shape, kept in this file on purpose: a skeleton that
 * lives away from the component it imitates is a skeleton that quietly stops
 * matching it. Same radius, same 4:3 media, same three rows of content.
 */
export function EventCardSkeleton() {
  return (
    <li className="overflow-hidden rounded-card shadow-[var(--shadow-card)]">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="p-5">
        <Skeleton className="h-5 w-4/5" />
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-7 w-24 rounded-pill" />
          <Skeleton className="h-7 w-20 rounded-pill" />
        </div>
        <Skeleton className="mt-3 h-4 w-1/2" />
      </div>
    </li>
  );
}
