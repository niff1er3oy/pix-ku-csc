import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button, ButtonLink } from "@/components/ui/button";
import { ChevronLeftIcon, PauseIcon, PlayIcon } from "@/components/ui/icon";
import { DeleteEvent } from "@/components/studio/delete-event";
import { EventInfoForm } from "@/components/studio/event-info-form";
import { EventSettingsForm } from "@/components/studio/event-settings-form";
import { pauseEvent, resumeEvent } from "@/lib/actions/studio";
import { requireApprovedPhotographer } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n";
import { getMyEventSettings } from "@/lib/queries/studio";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { photographer } = await requireApprovedPhotographer();
  const { id } = await params;
  const event = await getMyEventSettings(photographer.id, id);
  return { title: event ? `${event.nameTh} · Settings` : "" };
}

/**
 * Everything about an event that is not "add photos" — name, cover,
 * privacy, watermark, and whether it is open at all. Split from the main
 * event page rather than folded into it, the same way `PhotoUploader` is:
 * that page is where a photographer checks on an event, this is where they
 * change it, and the two only overlap for the pause/resume switch, which
 * belongs on both.
 */
export default async function StudioEventSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { photographer } = await requireApprovedPhotographer();
  const { id } = await params;
  const dict = await getDictionary();

  const event = await getMyEventSettings(photographer.id, id);
  if (!event) notFound();

  const canPause = event.status === "approved" || event.status === "archived";

  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="flex flex-wrap items-center gap-3">
        {/* Sized and weighted to read as one unit with the `text-h1` beside
            it — the standard `size="lg"` pill assumes text needs `px-8` of
            breathing room either side, which reads as an odd sliver of a
            pill around one bare icon, so this overrides the box to a plain
            square instead. */}
        <ButtonLink
          href={`/studio/events/${event.id}`}
          variant="ghost"
          size="lg"
          className="size-14 px-0"
          aria-label={event.nameTh}
          title={event.nameTh}
        >
          <ChevronLeftIcon size={32} strokeWidth={2.5} />
        </ButtonLink>

        <h1 className="text-h1 font-bold">{dict.studio.settingsTitle}</h1>
      </div>

      <div className="mt-8 space-y-6">
        {canPause && (
          <section className="enter rounded-card bg-cloud p-5 sm:p-6">
            <h2 className="text-h3 font-semibold text-ink">
              {dict.studio.pauseTitle}
            </h2>
            <p className="mt-1 text-label text-slate">
              {dict.studio.pauseEventHint}
            </p>
            <form
              action={event.status === "approved" ? pauseEvent : resumeEvent}
              className="mt-5"
            >
              <input type="hidden" name="id" value={event.id} />
              <Button
                type="submit"
                variant={event.status === "approved" ? "danger" : "secondary"}
                size="md"
              >
                {event.status === "approved" ? (
                  <PauseIcon size={18} />
                ) : (
                  <PlayIcon size={18} />
                )}
                {event.status === "approved"
                  ? dict.studio.pauseEvent
                  : dict.studio.resumeEvent}
              </Button>
            </form>
          </section>
        )}

        <EventInfoForm event={event} labels={dict.studio} />

        <EventSettingsForm event={event} labels={dict.studio} />
      </div>

      <DeleteEvent
        eventId={event.id}
        accessCode={event.accessCode}
        photoCount={event.photoCount}
        isLive={event.status === "approved"}
        labels={dict.studio}
        closeLabel={dict.common.close}
      />
    </section>
  );
}
