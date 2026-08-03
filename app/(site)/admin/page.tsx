import type { Metadata } from "next";

import { ReviewRow } from "@/components/admin/review-row";
import { GridBackground } from "@/components/ui/grid-background";
import {
  approveEvent,
  approvePhotographer,
  rejectEvent,
  rejectPhotographer,
} from "@/lib/actions/admin";
import { requireRole } from "@/lib/dal";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getPendingEvents, getPendingPhotographers } from "@/lib/queries/admin";
import { safely } from "@/lib/queries/public";
import { formatDate } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.admin.title };
}

/**
 * The review desk.
 *
 * This screen is the only thing that turns a photographer application into a
 * capability, and the only thing that makes an event publicly reachable.
 * Without it the whole photographer side is a dead end: applications write a
 * `pending` row that nothing can ever act on.
 *
 * `requireRole` calls `forbidden()`, so a signed-in non-admin gets a 403 rather
 * than a 404 — pretending the page does not exist would be a small lie to
 * someone who simply lacks a permission.
 */
export default async function AdminPage() {
  await requireRole("admin");
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);

  const [photographers, events] = await Promise.all([
    safely(() => getPendingPhotographers(), []),
    safely(() => getPendingEvents(), []),
  ]);

  const nothing = photographers.length === 0 && events.length === 0;

  return (
    <section className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
      <h1 className="text-h1 font-bold">{dict.admin.title}</h1>

      {nothing ? (
        <div className="relative mt-10 overflow-hidden rounded-card bg-cloud px-6 py-16 text-center">
          <GridBackground />
          <p className="relative text-body-lg text-slate">
            {dict.admin.nothingPending}
          </p>
        </div>
      ) : null}

      {photographers.length > 0 && (
        <section className="mt-12">
          <h2 className="text-h2">{dict.admin.pendingPhotographers}</h2>
          <ul className="mt-6 space-y-4">
            {photographers.map((row) => (
              <ReviewRow
                key={row.id}
                id={row.id}
                title={row.displayName}
                meta={[row.affiliation, row.contactEmail]}
                body={row.bio}
                submitted={formatDate(row.createdAt, locale)}
                approve={approvePhotographer}
                reject={rejectPhotographer}
                labels={dict.admin}
              />
            ))}
          </ul>
        </section>
      )}

      {events.length > 0 && (
        <section className="mt-12">
          <h2 className="text-h2">{dict.admin.pendingEvents}</h2>
          <ul className="mt-6 space-y-4">
            {events.map((row) => (
              <ReviewRow
                key={row.id}
                id={row.id}
                title={row.nameTh}
                meta={[row.ownerName, row.location, `/e/${row.slug}`]}
                body={row.descriptionTh}
                submitted={formatDate(row.startsAt, locale)}
                approve={approveEvent}
                reject={rejectEvent}
                labels={dict.admin}
              />
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
