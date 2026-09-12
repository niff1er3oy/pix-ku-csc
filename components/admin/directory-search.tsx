"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SearchIcon } from "@/components/ui/icon";
import type { DirectoryFilter } from "@/lib/queries/admin";

/**
 * The directory's search box.
 *
 * A `<form method="get">` underneath, so with no JavaScript it still submits
 * and still filters — but the submit is intercepted, because a native one
 * threw the reader back to the top of the page.
 *
 * The `#directory` fragment alone does not fix that for the form the way it
 * fixes it for the links. A native submit is a fresh document load, and at the
 * moment the browser looks for `#directory` to scroll to, the element is not
 * in the layout yet: React streams it inside a hidden container and swaps it in
 * afterwards. The browser finds nothing, gives up, and stays at the top.
 * Measured before this component existed: scrollY 988 → 0, with the heading
 * left 1,088px down the page.
 *
 * `router.push(…, { scroll: false })` sidesteps the whole problem — there is no
 * new document, so there is nothing to re-scroll.
 */
export function DirectorySearch({
  q,
  filter,
  label,
  submitLabel,
}: {
  q: string;
  filter: DirectoryFilter;
  label: string;
  submitLabel: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(q);

  const target = () => {
    const params = new URLSearchParams();
    if (value.trim()) params.set("q", value.trim());
    if (filter !== "all") params.set("filter", filter);
    const query = params.toString();
    return query ? `/admin?${query}#directory` : "/admin#directory";
  };

  return (
    <form
      method="get"
      action="/admin#directory"
      className="relative mt-5 max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(target(), { scroll: false });
      }}
    >
      {/* Carries the current filter through a no-JS submit; the intercepted
          path builds it from props instead. */}
      <input type="hidden" name="filter" value={filter} />

      <label htmlFor="admin-search" className="sr-only">
        {label}
      </label>
      <SearchIcon
        size={20}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate"
      />
      <input
        id="admin-search"
        name="q"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={label}
        className="h-[46px] w-full rounded-pill bg-paper pl-11 pr-24 text-body text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 placeholder:text-slate focus:ring-2 focus:ring-green-600"
      />
      <button
        type="submit"
        className="absolute right-1.5 top-1/2 h-9 -translate-y-1/2 rounded-pill bg-green-600 px-4 font-display text-label font-semibold text-paper transition-colors duration-200 hover:bg-green-700"
      >
        {submitLabel}
      </button>
    </form>
  );
}
