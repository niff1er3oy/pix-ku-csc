import type { Metadata } from "next";
import Link from "next/link";

import { CopyLinkButton } from "@/components/studio/copy-link-button";
import { AffiliationMembers } from "@/components/studio/affiliation-members";
import { JoinAffiliationForm } from "@/components/studio/join-affiliation-form";
import { LeaveAffiliationButton } from "@/components/studio/leave-affiliation-button";
import { DeleteEvent } from "@/components/studio/delete-event";
import { StatusChip } from "@/components/studio/status-chip";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { GridBackground } from "@/components/ui/grid-background";
import { CalendarIcon, LockIcon, PhotoIcon, SettingsIcon, UsersIcon } from "@/components/ui/icon";
import { requireApprovedPhotographer } from "@/lib/dal";
import { getDictionary, getLocale, t } from "@/lib/i18n";
import {
  getAffiliationById,
  getAffiliationEvents,
  getAffiliationMembers,
} from "@/lib/queries/affiliations";
import { safely } from "@/lib/queries/public";
import { enterDelay, formatDate, formatNumber } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.affiliationStudio.title };
}

/**
 * The shared studio a photographer's affiliation gives them — every event
 * created here, and the roster that can manage them, both scoped by
 * `photographer.affiliationId` rather than anything the URL carries. A
 * photographer with none yet sees the join form instead; there is no id in
 * this route to guess your way into somebody else's.
 */
export default async function AffiliationStudioPage() {
  const { user, photographer } = await requireApprovedPhotographer();
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);

  if (!photographer.affiliationId) {
    return (
      <section className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
        <h1 className="text-h1 font-bold">{dict.affiliationStudio.notInTitle}</h1>
        <p className="mt-3 max-w-prose text-body text-slate">
          {dict.affiliationStudio.notInBody}
        </p>
        <JoinAffiliationForm dict={dict} />
      </section>
    );
  }

  const affiliationId = photographer.affiliationId;
  const [affiliation, members, events] = await Promise.all([
    getAffiliationById(affiliationId),
    safely(() => getAffiliationMembers(affiliationId), []),
    safely(() => getAffiliationEvents(affiliationId), []),
  ]);

  // The affiliation itself was deleted out from under a membership row that
  // has not been cleared yet (`onDelete: "set null"` catches up on the next
  // write to this photographer's own row, not instantly) — treat it the
  // same as never having joined one.
  if (!affiliation) {
    return (
      <section className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
        <h1 className="text-h1 font-bold">{dict.affiliationStudio.notInTitle}</h1>
        <p className="mt-3 max-w-prose text-body text-slate">
          {dict.affiliationStudio.notInBody}
        </p>
        <JoinAffiliationForm dict={dict} />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-label font-medium text-green-700">
            <UsersIcon size={16} />
            {dict.affiliationStudio.title}
          </p>
          <h1 className="mt-1 text-h1 font-bold">{affiliation.name}</h1>
        </div>
        <ButtonLink href="/studio/events/new?affiliation=1" size="md">
          {dict.affiliationStudio.newEvent}
        </ButtonLink>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-card bg-cloud px-5 py-4">
        <p className="text-label text-slate">
          <span className="font-medium text-ink">{dict.affiliationStudio.joinCodeLabel}:</span>{" "}
          <span className="tnum tracking-[0.2em] text-ink">{affiliation.joinCode}</span>
        </p>
        <CopyLinkButton
          value={affiliation.joinCode}
          label={dict.affiliationStudio.copyCode}
          copiedLabel={dict.affiliationStudio.copyCodeCopied}
        />
        <LeaveAffiliationButton
          label={dict.affiliationStudio.leaveAffiliation}
          confirmMessage={dict.affiliationStudio.leaveConfirm}
        />
      </div>

      <div className="mt-10">
        <AffiliationMembers dict={dict} members={members} selfUserId={user.id} />
      </div>

      <div className="mt-12">
        <h2 className="text-h3 font-semibold text-ink">{dict.studio.title}</h2>

        {events.length === 0 ? (
          <div className="relative mt-6 overflow-hidden rounded-card bg-cloud px-6 py-16 text-center">
            <GridBackground />
            <div className="relative">
              <p className="text-h3">{dict.affiliationStudio.eventsEmpty}</p>
              <p className="mx-auto mt-3 max-w-sm text-body text-slate">
                {dict.affiliationStudio.eventsEmptyBody}
              </p>
              <ButtonLink href="/studio/events/new?affiliation=1" size="md" className="mt-6">
                {dict.affiliationStudio.newEvent}
              </ButtonLink>
            </div>
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
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

                {/* "งานของสังกัดจะบอกว่าใครเป็นคนถ่ายด้วย" — the one thing
                    this list adds over the personal studio's own: who among
                    every member with full editing rights actually shot it. */}
                <Link
                  href={`/profile/${event.ownerUserId}`}
                  className="mt-3 flex w-fit items-center gap-1.5 text-label text-slate transition-colors duration-200 hover:text-green-700"
                >
                  <Avatar src={event.ownerImage} size={20} />
                  {t(dict.affiliationStudio.shotBy, { name: event.ownerName })}
                </Link>

                {event.status === "rejected" && event.rejectionReason && (
                  <p className="mt-3 rounded-field bg-danger/5 px-3 py-2 text-label text-danger">
                    {event.rejectionReason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
