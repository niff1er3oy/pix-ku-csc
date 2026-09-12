import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { GridBackground } from "@/components/ui/grid-background";
import { CalendarIcon, LockIcon, PhotoIcon, SettingsIcon } from "@/components/ui/icon";
import { DeleteEvent } from "@/components/studio/delete-event";
import { StatusChip } from "@/components/studio/status-chip";
import { requireApprovedPhotographer } from "@/lib/dal";
import { getDictionary, getLocale, t } from "@/lib/i18n";
import { getMyEvents } from "@/lib/queries/studio";
import { safely } from "@/lib/queries/public";
import { enterDelay, formatDate, formatNumber } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.studio.title };
}

/**
 * A photographer's own events.
 *
 * `requireApprovedPhotographer` gates on `photographer.status === "approved"`,
 * not on the role — an application still sitting at `pending` must not be able
 * to create events by typing the URL. The proxy redirects a signed-out visitor
 * before this runs; this is the check that actually decides.
 */
export default async function StudioPage() {
  const { photographer } = await requireApprovedPhotographer();
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const events = await safely(() => getMyEvents(photographer.id), []);

  return (
    <section className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-h1 font-bold">{dict.studio.title}</h1>
        <ButtonLink href="/studio/events/new" size="md">
          {dict.studio.newEvent}
        </ButtonLink>
      </div>

      {events.length === 0 ? (
        <div className="relative mt-12 overflow-hidden rounded-card bg-cloud px-6 py-16 text-center">
          <GridBackground />
          <div className="relative">
            <p className="text-h3">{dict.studio.eventsEmpty}</p>
            <p className="mx-auto mt-3 max-w-sm text-body text-slate">
              {dict.studio.eventsEmptyBody}
            </p>
            <ButtonLink href="/studio/events/new" size="md" className="mt-6">
              {dict.studio.newEvent}
            </ButtonLink>
          </div>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {events.map((event, i) => (
            <li
              key={event.id}
              className={`enter rounded-card bg-paper p-4 ring-1 ring-edge transition-shadow duration-200 hover:shadow-[var(--shadow-card)] sm:p-5 ${enterDelay(i)}`}
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
                      {/* The code is on the list, not buried one level down: a
                          photographer setting up a booth needs it to print, and
                          it is the one field they cannot look up anywhere else. */}
                      <span className="tnum tracking-[0.15em] text-ink">
                        {event.accessCode}
                      </span>
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

              {event.status === "rejected" && event.rejectionReason && (
                <p className="mt-3 rounded-field bg-danger/5 px-3 py-2 text-label text-danger">
                  {event.rejectionReason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
