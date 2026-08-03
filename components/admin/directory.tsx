import Link from "next/link";

import { DirectoryRow } from "@/components/admin/directory-row";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Directory as Data, DirectoryFilter } from "@/lib/queries/admin";
import { cn, formatDate, formatNumber } from "@/lib/utils";

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
  selfId,
  labels,
  locale,
}: {
  data: Data;
  q: string;
  filter: DirectoryFilter;
  selfId: string;
  labels: Dictionary["admin"];
  locale: "th" | "en";
}) {
  const filters: { key: DirectoryFilter; label: string }[] = [
    { key: "all", label: labels.filterAll },
    { key: "users", label: labels.filterUsers },
    { key: "photographers", label: labels.filterPhotographers },
    { key: "admins", label: labels.filterAdmins },
  ];

  const href = (page: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filter !== "all") params.set("filter", filter);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/admin?${query}` : "/admin";
  };

  return (
    <section className="mt-16">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-h2">{labels.directoryTitle}</h2>
        {/* Totals live here rather than in a row of big-number tiles at the
            top. The count of accounts is context for reading this list; it is
            not something an admin arrives needing to act on. */}
        <p className="tnum text-label text-slate">
          {t(labels.directoryCount, {
            count: formatNumber(data.total, locale),
          })}
        </p>
      </div>

      <form method="get" action="/admin" className="mt-5 flex flex-wrap gap-2">
        <input type="hidden" name="filter" value={filter} />
        <label htmlFor="admin-search" className="sr-only">
          {labels.directorySearch}
        </label>
        <input
          id="admin-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={labels.directorySearch}
          className="h-[46px] min-w-0 flex-1 rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 placeholder:text-slate focus:ring-2 focus:ring-green-600 sm:max-w-xs"
        />
        <Button type="submit" variant="secondary" size="md">
          {labels.directorySearchSubmit}
        </Button>
      </form>

      <nav className="mt-3 flex flex-wrap gap-1.5" aria-label={labels.filterAll}>
        {filters.map((item) => {
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (item.key !== "all") params.set("filter", item.key);
          const query = params.toString();
          const active = item.key === filter;

          return (
            <Link
              key={item.key}
              href={query ? `/admin?${query}` : "/admin"}
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
          />
        </nav>
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
}: {
  href: string;
  disabled: boolean;
  label: string;
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
      className="inline-flex min-h-11 items-center rounded-pill px-4 text-label font-medium text-green-700 transition-colors duration-200 hover:bg-cloud"
    >
      {label}
    </Link>
  );
}
