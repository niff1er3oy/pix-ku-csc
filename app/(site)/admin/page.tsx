import type { Metadata } from "next";

import { Directory } from "@/components/admin/directory";
import { IndexingMeter, StatTiles } from "@/components/admin/metrics";
import { SearchesChart } from "@/components/admin/searches-chart";
import { ReviewRow } from "@/components/admin/review-row";
import {
  approveEvent,
  approvePhotographer,
  rejectEvent,
  rejectPhotographer,
} from "@/lib/actions/admin";
import { requireRole } from "@/lib/dal";
import { getDictionary, getLocale, t } from "@/lib/i18n";
import {
  getAdminMetrics,
  getDirectory,
  getPendingEvents,
  getPendingPhotographers,
  type DirectoryFilter,
} from "@/lib/queries/admin";
import { safely } from "@/lib/queries/public";
import { formatDate, formatNumber } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.admin.title };
}

const FILTERS = new Set<DirectoryFilter>([
  "all",
  "users",
  "photographers",
  "admins",
]);

/**
 * The admin console: what is waiting, then everyone.
 *
 * That order is the design. An admin opens this page because somebody is
 * blocked — an application nobody has looked at, an event that cannot go live
 * until it is approved — and the directory is what they consult once that is
 * dealt with. A row of total-count tiles across the top would put the least
 * actionable numbers in the most valuable space, so the counts sit beside the
 * heading they describe instead.
 *
 * `requireRole` calls `forbidden()`, which needs `experimental.authInterrupts`
 * and `app/forbidden.tsx` to render as anything at all; without them a
 * signed-in non-admin got a loading state that never resolved.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; filter?: string }>;
}) {
  const admin = await requireRole("admin");
  const params = await searchParams;

  const q = params.q?.slice(0, 80) ?? "";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const filter = (
    FILTERS.has(params.filter as DirectoryFilter) ? params.filter : "all"
  ) as DirectoryFilter;

  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);

  const [photographers, events, directory, metrics] = await Promise.all([
    safely(() => getPendingPhotographers(), []),
    safely(() => getPendingEvents(), []),
    safely(() => getDirectory({ q, page, filter }), {
      rows: [],
      total: 0,
      page: 1,
      pageCount: 1,
    }),
    safely(() => getAdminMetrics(), {
      totals: {
        users: 0,
        photographers: 0,
        events: 0,
        photos: 0,
        faces: 0,
        searches: 0,
      },
      searchesPerDay: [],
      indexing: { total: 0, indexed: 0, working: 0, noFace: 0, failed: 0 },
    }),
  ]);

  const waiting = photographers.length + events.length;

  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <h1 className="text-h1 font-bold">{dict.admin.title}</h1>
      <p className="tnum mt-3 text-body-lg text-slate">
        {waiting > 0
          ? t(dict.admin.reviewCount, {
              count: formatNumber(waiting, locale),
            })
          : dict.admin.reviewClear}
      </p>

      <StatTiles totals={metrics.totals} labels={dict.admin} locale={locale} />

      {/* Stacked rather than side by side. Thirty days of points in half a
          column forced the chart into a horizontal scrollbar and cut the last
          value off its own right edge; a trend chart wants the page width. */}
      <div className="mt-4 grid gap-4">
        <SearchesChart
          points={metrics.searchesPerDay}
          locale={locale}
          labels={{
            title: dict.admin.searchesTitle,
            empty: dict.admin.searchesEmpty,
            emptyBody: dict.admin.searchesEmptyBody,
            tableToggle: dict.admin.searchesTable,
            colDay: dict.admin.searchesColDay,
            colCount: dict.admin.searchesColCount,
            unit: dict.admin.searchesUnit,
          }}
        />
        <IndexingMeter
          indexing={metrics.indexing}
          labels={dict.admin}
          locale={locale}
        />
      </div>

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

      <Directory
        data={directory}
        q={q}
        filter={filter}
        selfId={admin.id}
        labels={dict.admin}
        locale={locale}
      />
    </section>
  );
}
