"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { DeleteEvent } from "@/components/studio/delete-event";
import { StatusChip } from "@/components/studio/status-chip";
import { SearchIcon, CalendarIcon, LockIcon, PhotoIcon, SettingsIcon } from "@/components/ui/icon";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locale";
import type { StudioEventListItem } from "@/lib/queries/studio";
import { cn, enterDelay, formatDate, formatNumber } from "@/lib/utils";

/**
 * The event-list card `/studio` and `/studio/affiliation` each render, with
 * a client-side, no-round-trip search over the event name — the same
 * pattern `PortfolioGrid`/`EventsManager` use for their own lists, for the
 * same reason: a photographer active for a few years, or an affiliation
 * pooling several members' events, is exactly the shape of list that grows
 * past "just scroll" the way the public `/events` index already did before
 * it got one.
 *
 * `footer`, when given, renders below each card's own content — only
 * `/studio/affiliation` uses it, for the "ถ่ายโดย …" line an event a
 * photographer's own personal list has no reason to show.
 */
export function StudioEventList<T extends StudioEventListItem>({
  events,
  dict,
  locale,
  footer,
}: {
  events: T[];
  dict: Dictionary;
  locale: Locale;
  footer?: (event: T) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = (event: T) => !needle || event.nameTh.toLowerCase().includes(needle);
  const visibleCount = events.filter(matches).length;

  return (
    <>
      {events.length > 1 && (
        <div className="relative mt-6 max-w-sm">
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
            className="h-11 w-full rounded-pill bg-cloud pl-11 pr-4 text-body text-ink ring-1 ring-inset ring-edge placeholder:text-slate focus:ring-2 focus:ring-green-600"
          />
        </div>
      )}

      {needle && visibleCount === 0 ? (
        <p className="mt-6 rounded-card bg-cloud px-6 py-12 text-center text-body text-slate">
          {t(dict.eventsPage.searchEmpty, { query: query.trim() })}
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {events.map((event, i) => (
            <li
              key={event.id}
              className={cn(
                "enter rounded-card bg-paper p-4 ring-1 ring-edge transition-shadow duration-200 hover:shadow-[var(--shadow-card)] sm:p-5",
                enterDelay(i),
                !matches(event) && "hidden",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <Link
                  href={`/studio/events/${event.id}`}
                  className="group flex min-w-0 flex-1 items-center gap-4 rounded-field"
                >
                  <div className="aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-media bg-cloud ring-1 ring-inset ring-edge">
                    {event.coverThumbPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/media/${event.coverThumbPath}`}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="grid h-full place-items-center">
                        <PhotoIcon size={20} className="text-slate" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-display text-h3 text-ink transition-colors duration-200 group-hover:text-green-700">
                      {event.isPrivate && (
                        <LockIcon
                          size={16}
                          className="shrink-0 text-slate"
                          title={dict.studio.formPrivate}
                        />
                      )}
                      <span className="truncate">{event.nameTh}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-slate">
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
                      <span className="tnum tracking-[0.15em] text-ink">{event.accessCode}</span>
                    </p>
                  </div>
                </Link>

                <div className="flex shrink-0 items-center gap-1">
                  <StatusChip status={event.status} labels={dict.status} />

                  <Link
                    href={`/studio/events/${event.id}/settings`}
                    aria-label={dict.studio.settingsButton}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill text-slate transition-colors duration-200 hover:bg-cloud hover:text-green-700"
                  >
                    <SettingsIcon size={18} />
                  </Link>

                  {/* The exact same popup `DeleteEvent` shows on the settings
                      page — not a second copy of the warning/confirm flow,
                      just a smaller trigger sized for this row. */}
                  <DeleteEvent
                    eventId={event.id}
                    accessCode={event.accessCode}
                    photoCount={event.photoCount}
                    isLive={event.status === "approved"}
                    labels={dict.studio}
                    closeLabel={dict.common.close}
                    compact
                  />
                </div>
              </div>

              {footer?.(event)}

              {event.status === "rejected" && event.rejectionReason && (
                <p className="mt-3 rounded-field bg-danger/5 px-3 py-2 text-label text-danger">
                  {event.rejectionReason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
