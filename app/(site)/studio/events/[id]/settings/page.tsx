import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ChevronLeftIcon } from "@/components/ui/icon";
import { DeleteEvent } from "@/components/studio/delete-event";
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
      <Link
        href={`/studio/events/${event.id}`}
        className="inline-flex min-h-11 items-center gap-1 text-label font-medium text-green-700 hover:underline"
      >
        <ChevronLeftIcon size={18} />
        {event.nameTh}
      </Link>

      <h1 className="mt-4 text-h1 font-bold">{dict.studio.settingsTitle}</h1>

      <div className="mt-8 space-y-6">
        {canPause && (
          <section className="rounded-card bg-cloud p-5 sm:p-6">
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
                {event.status === "approved"
                  ? dict.studio.pauseEvent
                  : dict.studio.resumeEvent}
              </Button>
            </form>
          </section>
        )}

        <EventSettingsForm event={event} labels={dict.studio} />
      </div>

      <DeleteEvent
        eventId={event.id}
        accessCode={event.accessCode}
        photoCount={event.photoCount}
        isLive={event.status === "approved"}
        labels={dict.studio}
      />
    </section>
  );
}
