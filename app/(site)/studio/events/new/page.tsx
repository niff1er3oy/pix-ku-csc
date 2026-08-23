import type { Metadata } from "next";
import Link from "next/link";

import { EventForm } from "@/components/studio/event-form";
import { ChevronLeftIcon } from "@/components/ui/icon";
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
      <Link
        href="/studio"
        className="inline-flex min-h-11 items-center gap-1 text-label font-medium text-green-700 hover:underline"
      >
        <ChevronLeftIcon size={18} />
        {dict.studio.backToStudio}
      </Link>

      <h1 className="mt-4 text-h1 font-bold">{dict.studio.newEvent}</h1>

      <EventForm labels={dict.studio} />
    </section>
  );
}
