import type { Metadata } from "next";
import Link from "next/link";

import { AffiliationMembers } from "@/components/studio/affiliation-members";
import { AffiliationSettingsButton } from "@/components/studio/affiliation-settings-button";
import { JoinAffiliationForm } from "@/components/studio/join-affiliation-form";
import { StudioEventList } from "@/components/studio/studio-event-list";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { GridBackground } from "@/components/ui/grid-background";
import { UsersIcon } from "@/components/ui/icon";
import { requireApprovedPhotographer } from "@/lib/dal";
import { getDictionary, getLocale, t } from "@/lib/i18n";
import {
  getAffiliationById,
  getAffiliationEvents,
  getAffiliationMembers,
  type AffiliationEventListItem,
} from "@/lib/queries/affiliations";
import { safely } from "@/lib/queries/public";

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
        <div className="flex items-center gap-4">
          <Avatar src={affiliation.imagePath ? `/api/media/${affiliation.imagePath}` : null} size={56} />
          <div>
            <p className="flex items-center gap-1.5 text-label font-medium text-green-700">
              <UsersIcon size={16} />
              {dict.affiliationStudio.title}
            </p>
            <h1 className="mt-1 text-h1 font-bold">{affiliation.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AffiliationSettingsButton
            dict={dict}
            affiliationName={affiliation.name}
            imagePath={affiliation.imagePath}
            joinCode={affiliation.joinCode}
          />
          <ButtonLink href="/studio/events/new?affiliation=1" size="md">
            {dict.affiliationStudio.newEvent}
          </ButtonLink>
        </div>
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
          <StudioEventList
            events={events}
            dict={dict}
            locale={locale}
            footer={(event: AffiliationEventListItem) => (
              // "งานของสังกัดจะบอกว่าใครเป็นคนถ่ายด้วย" — the one thing this
              // list adds over the personal studio's own: who among every
              // member with full editing rights actually shot it.
              <Link
                href={`/profile/${event.ownerUserId}`}
                className="mt-3 flex w-fit items-center gap-1.5 text-label text-slate transition-colors duration-200 hover:text-green-700"
              >
                <Avatar src={event.ownerImage} size={20} />
                {t(dict.affiliationStudio.shotBy, { name: event.ownerName })}
              </Link>
            )}
          />
        )}
      </div>
    </section>
  );
}
