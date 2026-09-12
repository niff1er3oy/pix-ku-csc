import Link from "next/link";

import { AffiliationsPanel } from "@/components/admin/affiliations-panel";
import { DirectoryRow } from "@/components/admin/directory-row";
import { DirectorySearch } from "@/components/admin/directory-search";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icon";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { AdminAffiliationRow } from "@/lib/queries/affiliations";
import type { Directory as Data, DirectoryFilter } from "@/lib/queries/admin";
import { cn, formatDate, formatNumber } from "@/lib/utils";

export type DirectoryTab = "members" | "affiliations";

/**
 * The account directory: search, filter, one row per person, paging.
 *
 * The controls are a plain GET `<form>` and the pager is plain links, so the
 * whole thing runs without JavaScript and every state has an address. An admin
 * who has found the one person they were looking for can send that URL to
 * somebody else, and the back button behaves.
 *
 * Search and paging happen in Postgres. The owner expects hundreds to low
 * thousands of accounts, which is exactly the range where filtering an array
 * in the page looks fine in development and stops being acceptable in the
 * second term.
 */
export function Directory({
  data,
  q,
  filter,
  tab,
  affiliations,
  selfId,
  labels,
  dict,
  locale,
}: {
  data: Data;
  q: string;
  filter: DirectoryFilter;
  /** Which of the section's two tabs is showing — the member list this
   *  component always rendered, or the affiliation-management panel that
   *  used to be its own page at `/admin/affiliations` before it moved in
   *  here. */
  tab: DirectoryTab;
  affiliations: AdminAffiliationRow[];
  selfId: string;
  labels: Dictionary["admin"];
  /** Threaded through only for `DirectoryRow`'s `EventsManager` popup, which
   *  reaches into several other namespaces (`eventsPage`, `results`,
   *  `status`, `studio`) beyond `admin`'s own — everything else here still
   *  reads off `labels`. */
  dict: Dictionary;
  locale: "th" | "en";
}) {
  const filters: { key: DirectoryFilter; label: string }[] = [
    { key: "all", label: labels.filterAll },
    { key: "users", label: labels.filterUsers },
    { key: "photographers", label: labels.filterPhotographers },
    { key: "admins", label: labels.filterAdmins },
  ];

  /**
   * Every link out of this section lands back on the section.
   *
   * Without the fragment, clicking a filter threw the reader to the top of the
   * page — measured at 988px back to 64px — because a Next navigation scrolls
   * to the top by default and the directory sits below the stats, the chart and
   * the review queue. Choosing "photographers" and being shown the headline
   * numbers instead is not a small annoyance; it costs a scroll every time.
   *
   * A fragment rather than `scroll={false}`: the search box below is a plain
   * GET form, which is a real browser navigation and cannot be told not to
   * scroll. The anchor is the one mechanism that behaves the same for the
   * links, the form, and a visitor with no JavaScript — and it makes the URL
   * land somebody you send it to on the list rather than at the top.
   */
  const withAnchor = (params: URLSearchParams) => {
    const query = params.toString();
    return query ? `/admin?${query}#directory` : "/admin#directory";
  };

  const href = (page: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filter !== "all") params.set("filter", filter);
    if (page > 1) params.set("page", String(page));
    return withAnchor(params);
  };

  return (
    /* `scroll-mt` keeps the heading clear of the sticky header when the
       anchor above brings the reader here. */
    <section id="directory" className="mt-16 scroll-mt-20">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-h2">
          {tab === "affiliations" ? dict.adminAffiliationsPage.title : labels.directoryTitle}
        </h2>
        {/* Totals live here rather than in a row of big-number tiles at the
            top. The count of accounts is context for reading this list; it is
            not something an admin arrives needing to act on. */}
        <p className="tnum text-label text-slate">
          {tab === "affiliations"
            ? t(dict.adminAffiliationsPage.count, {
                count: formatNumber(affiliations.length, locale),
              })
            : t(labels.directoryCount, {
                count: formatNumber(data.total, locale),
              })}
        </p>
      </div>

      {/* The account directory and the affiliation roster are two views onto
          the same "everyone in the system" section, not two unrelated
          screens — a tab switch here rather than a second page, so an admin
          never leaves this scroll position to move between them. */}
      <nav className="mt-3 flex flex-wrap gap-1.5">
        <Link
          href="/admin#directory"
          aria-current={tab === "members" ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center whitespace-nowrap rounded-pill px-4 text-sm font-semibold transition-colors duration-200",
            tab === "members"
              ? "bg-ink text-paper"
              : "text-slate hover:bg-cloud hover:text-green-700",
          )}
        >
          {labels.tabMembers}
        </Link>
        <Link
          href="/admin?tab=affiliations#directory"
          aria-current={tab === "affiliations" ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center whitespace-nowrap rounded-pill px-4 text-sm font-semibold transition-colors duration-200",
            tab === "affiliations"
              ? "bg-ink text-paper"
              : "text-slate hover:bg-cloud hover:text-green-700",
          )}
        >
          {labels.tabAffiliations}
        </Link>
      </nav>

      {tab === "affiliations" ? (
        <AffiliationsPanel dict={dict} locale={locale} affiliations={affiliations} />
      ) : (
        <>
          <DirectorySearch
            q={q}
            filter={filter}
            label={labels.directorySearch}
            submitLabel={labels.directorySearchSubmit}
          />

          <nav className="mt-3 flex flex-wrap gap-1.5" aria-label={labels.filterAll}>
            {filters.map((item) => {
              const params = new URLSearchParams();
              if (q) params.set("q", q);
              if (item.key !== "all") params.set("filter", item.key);
              const active = item.key === filter;

              return (
                <Link
                  key={item.key}
                  href={withAnchor(params)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center whitespace-nowrap rounded-pill px-4 text-sm font-medium transition-colors duration-200",
                    active
                      ? "bg-green-600 text-paper"
                      : "text-slate hover:bg-cloud hover:text-green-700",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {data.rows.length === 0 ? (
            <p className="mt-10 rounded-card bg-cloud px-6 py-12 text-center text-body text-slate">
              {labels.directoryNoResults}
            </p>
          ) : (
            <ul className="mt-4">
              {data.rows.map((row) => (
                <DirectoryRow
                  key={row.userId}
                  row={row}
                  isSelf={row.userId === selfId}
                  labels={labels}
                  dict={dict}
                  locale={locale}
                  joined={t(labels.joined, {
                    date: formatDate(row.joinedAt, locale),
                  })}
                />
              ))}
            </ul>
          )}

          {data.pageCount > 1 && (
            <nav className="mt-8 flex items-center justify-between gap-4 border-t border-edge pt-6">
              <PagerLink
                href={href(data.page - 1)}
                disabled={data.page <= 1}
                label={labels.prevPage}
                side="prev"
              />
              <p className="tnum text-label text-slate">
                {t(labels.pageOf, {
                  page: formatNumber(data.page, locale),
                  total: formatNumber(data.pageCount, locale),
                })}
              </p>
              <PagerLink
                href={href(data.page + 1)}
                disabled={data.page >= data.pageCount}
                label={labels.nextPage}
                side="next"
              />
            </nav>
          )}
        </>
      )}
    </section>
  );
}

/**
 * A pager end-stop is rendered as text rather than a disabled link: a link to
 * nowhere is still focusable and still announces as a link, which sends a
 * keyboard user to a page that cannot exist.
 */
function PagerLink({
  href,
  disabled,
  label,
  side,
}: {
  href: string;
  disabled: boolean;
  label: string;
  side: "prev" | "next";
}) {
  if (disabled) {
    return (
      <span aria-hidden className="px-4 text-label text-edge">
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1 rounded-pill px-4 text-label font-medium text-green-700 transition-colors duration-200 hover:bg-cloud"
    >
      {side === "prev" && <ChevronLeftIcon size={18} />}
      {label}
      {side === "next" && <ChevronRightIcon size={18} />}
    </Link>
  );
}
