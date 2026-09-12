import type { Metadata } from "next";

import { EventForm } from "@/components/studio/event-form";
import { requireApprovedPhotographer } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n";
import { getAffiliationById } from "@/lib/queries/affiliations";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.studio.newEvent };
}

/**
 * `?affiliation=1` is a flag, not an id — the id itself always comes from
 * `photographer.affiliationId` on this side, never from the URL, so there is
 * nothing here for a crafted link to redirect at someone else's group. A
 * photographer with no affiliation who lands here with the flag set just
 * gets the ordinary solo form, the same as leaving it off.
 */
export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ affiliation?: string }>;
}) {
  const { photographer } = await requireApprovedPhotographer();
  const { affiliation: wantsAffiliation } = await searchParams;
  const dict = await getDictionary();

  const affiliation =
    wantsAffiliation === "1" && photographer.affiliationId
      ? await getAffiliationById(photographer.affiliationId)
      : null;

  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <h1 className="text-h1 font-bold">
        {affiliation ? affiliation.name : dict.studio.newEvent}
      </h1>
      {affiliation && (
        <p className="mt-2 text-label text-slate">
          {dict.affiliationStudio.lede}
        </p>
      )}

      <EventForm labels={dict.studio} affiliationId={affiliation?.id} />
    </section>
  );
}
