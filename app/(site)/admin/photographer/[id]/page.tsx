import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/dal";
import { getDictionary, getLocale, t } from "@/lib/i18n";
import { getPhotographerEvents } from "@/lib/queries/admin";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatDate, formatNumber } from "@/lib/utils";

/**
 * Everything one photographer has run.
 *
 * A separate page rather than an expander in the directory row: this is the
 * view an admin reaches for when they are about to make a decision about
 * somebody, and a decision wants the whole record on screen at once rather
 * than a panel that pushes the rest of the list around.
 */
export default async function PhotographerEventsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);

  const [photographer] = await db
    .select({
      displayName: photographers.displayName,
      affiliation: photographers.affiliation,
      status: photographers.status,
      contactEmail: photographers.contactEmail,
    })
    .from(photographers)
    .where(eq(photographers.id, id))
    .limit(1);

  if (!photographer) notFound();

  const events = await getPhotographerEvents(id);

  return (
    <section className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
      <Link
        href="/admin"
        className="inline-flex min-h-11 items-center text-label font-medium text-green-700 hover:underline"
      >
        ← {dict.admin.title}
      </Link>

      <h1 className="mt-4 text-h1 font-bold">{photographer.displayName}</h1>
      <p className="mt-2 text-label text-slate">
        {[photographer.affiliation, photographer.contactEmail]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {events.length === 0 ? (
        <p className="mt-10 rounded-card bg-cloud px-6 py-12 text-center text-body text-slate">
          {dict.studio.eventsEmpty}
        </p>
      ) : (
        <ul className="mt-10">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-edge py-4"
            >
              <Link
                href={`/e/${event.slug}`}
                className="font-display font-semibold text-ink hover:text-green-700"
              >
                {event.nameTh}
              </Link>
              <p className="tnum text-label text-slate">
                {dict.status[event.status]}
                {" · "}
                {formatDate(event.startsAt, locale)}
                {" · "}
                {t(dict.event.photosCount, {
                  count: formatNumber(event.photoCount, locale),
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
