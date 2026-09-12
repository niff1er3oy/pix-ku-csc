import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { GridBackground } from "@/components/ui/grid-background";
import { UsersIcon } from "@/components/ui/icon";
import { StudioEventList } from "@/components/studio/studio-event-list";
import { requireApprovedPhotographer } from "@/lib/dal";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getMyEvents } from "@/lib/queries/studio";
import { safely } from "@/lib/queries/public";

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
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/studio/affiliation" variant="secondary" size="md">
            <UsersIcon size={18} />
            {dict.affiliationStudio.title}
          </ButtonLink>
          <ButtonLink href="/studio/events/new" size="md">
            {dict.studio.newEvent}
          </ButtonLink>
        </div>
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
        <StudioEventList events={events} dict={dict} locale={locale} />
      )}
    </section>
  );
}
