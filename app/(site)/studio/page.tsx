import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { GridBackground } from "@/components/ui/grid-background";
import { CalendarIcon, PhotoIcon } from "@/components/ui/icon";
import { requireApprovedPhotographer } from "@/lib/dal";
import { getDictionary, getLocale, t } from "@/lib/i18n";
import { getMyEvents } from "@/lib/queries/studio";
import { safely } from "@/lib/queries/public";
import { cn, formatDate, formatNumber } from "@/lib/utils";

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
        <div>
          <h1 className="text-h1 font-bold">{dict.studio.title}</h1>
          <p className="mt-2 text-label text-slate">
            {photographer.displayName}
            {events.length > 0 &&
              ` · ${t(dict.studio.eventsCount, {
                count: formatNumber(events.length, locale),
              })}`}
          </p>
        </div>
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
          </div>
        </div>
      ) : (
        <ul className="mt-10">
          {events.map((event) => (
            <li key={event.id} className="border-t border-edge">
              <Link
                href={`/studio/events/${event.id}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-5 transition-colors duration-200 hover:bg-cloud"
              >
                <div className="min-w-0">
                  <p className="font-display text-h3 text-ink">
                    {event.nameTh}
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

                <StatusChip status={event.status} labels={dict.status} />
              </Link>

              {event.status === "rejected" && event.rejectionReason && (
                <p className="pb-5 text-label text-danger">
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

/**
 * The event's state, in the photographer's own terms.
 *
 * `draft` and `pending` are deliberately not both grey. A draft is waiting on
 * the photographer; a pending event is waiting on somebody else. Telling those
 * apart at a glance is the whole reason this chip exists.
 */
function StatusChip({
  status,
  labels,
}: {
  status: "draft" | "pending" | "approved" | "rejected" | "archived";
  labels: Record<string, string>;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-pill px-3 py-1 text-caption font-semibold",
        status === "approved" && "bg-green-600 text-paper",
        status === "pending" && "bg-lime-500 text-green-950",
        status === "draft" && "bg-cloud text-slate",
        status === "rejected" && "bg-danger text-paper",
        status === "archived" && "bg-cloud text-slate",
      )}
    >
      {labels[status]}
    </span>
  );
}
