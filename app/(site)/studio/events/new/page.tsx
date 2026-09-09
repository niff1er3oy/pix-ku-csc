import type { Metadata } from "next";

import { EventForm } from "@/components/studio/event-form";
import { requireApprovedPhotographer } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.studio.newEvent };
}

export default async function NewEventPage() {
  await requireApprovedPhotographer();
  const dict = await getDictionary();

  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <h1 className="text-h1 font-bold">{dict.studio.newEvent}</h1>

      <EventForm labels={dict.studio} />
    </section>
  );
}
