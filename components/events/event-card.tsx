import Link from "next/link";
import { ViewTransition } from "react";

import { GridBackground } from "@/components/ui/grid-background";
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
      <Link
        href={`/e/${event.slug}`}
        className="group block overflow-hidden rounded-card bg-paper shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[3px] hover:shadow-[var(--shadow-lift)]"
      >
        <ViewTransition name={`event-cover-${event.id}`}>
          <div className="aspect-[4/3] overflow-hidden bg-green-100">
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
          </div>
        </ViewTransition>

        <div className="p-5">
          <h3 className="text-h3 leading-snug text-ink">
            {locale === "en" && event.nameEn ? event.nameEn : event.nameTh}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-pill bg-green-50 px-3 py-1 text-caption font-medium text-green-700">
              {formatDate(event.startsAt, locale)}
            </span>
            <span className="tnum rounded-pill bg-green-50 px-3 py-1 text-caption font-medium text-green-700">
              {formatNumber(event.photoCount, locale)} {dict.common.photos}
            </span>
          </div>
          <p className="mt-3 truncate text-label text-slate">
            {dict.event.by} {event.photographerName}
          </p>
        </div>
      </Link>
    </li>
  );
}
