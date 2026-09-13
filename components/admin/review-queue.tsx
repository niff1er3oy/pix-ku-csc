"use client";

import {
  cloneElement,
  isValidElement,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import { useFormStatus } from "react-dom";

import { SelectAllToggle } from "@/components/photos/select-all-toggle";
import { Button } from "@/components/ui/button";
import { CheckIcon, SearchIcon } from "@/components/ui/icon";
import { usePhotoSelection } from "@/lib/hooks/use-photo-selection";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Wraps a review queue — pending photographers, pending events — with a
 * client-side search over each item's title, the same pattern
 * `PortfolioGrid`/`EventsManager` use for their own lists. A queue drains as
 * an admin works through it, but if it falls behind (a busy launch week, a
 * campus event season) it can grow to dozens before anyone catches up, which
 * is exactly the point past which scrolling stops being the fastest way to
 * find one name.
 *
 * `rows` arrives already built as `<ReviewRow>` elements — this is a Client
 * Component and its caller (`/admin`) is a Server Component, and a function
 * that builds JSX from raw data cannot cross that boundary the way a value
 * can. `titles` is the plain-string parallel array this searches against,
 * matched by index; a non-matching row gets `hidden` set on its already-
 * built element via `cloneElement` (which `ReviewRow` reads to hide itself)
 * rather than being left out of `rows` — a queue row is a real `<form>` with
 * its own reject-reason text field, and unmounting one on every keystroke
 * would drop whatever an admin had half-typed into a row that later matches
 * again.
 *
 * `bulkApprove` is opt-in — only the pending-photographers queue passes it.
 * The taken-down-events queue (rows are `TakenDownEventRow`, only a
 * `restore` form) has no bulk action and renders exactly as before. When
 * present, `bulkApprove.ids` must be the row ids, parallel to `titles`/
 * `rows` by index — the same convention those two already use.
 *
 * Each `ReviewRow` already renders two `<form>`s of its own (approve,
 * reject — kept apart so a stray Enter key in the reject-reason box can
 * never submit "approve"), so a third, outer bulk-approve `<form>` cannot
 * wrap the `<ul>` — a browser does not allow a `<form>` to contain other
 * `<form>`s. Instead the bulk form lives here, wrapping only the toolbar
 * (select-all + the bulk submit button); each row's new checkbox is a
 * sibling of its two forms, pointed at this one via the HTML `form="…"`
 * attribute, exactly the way `DeletePhotosForm`'s lightbox buttons and
 * `EventsManager`'s checkboxes already reach a `<form>` they are not
 * nested inside.
 */
export function ReviewQueue({
  titles,
  rows,
  labels,
  bulkApprove,
}: {
  titles: string[];
  rows: ReactElement[];
  labels: Dictionary["admin"];
  bulkApprove?: {
    /** Row ids, parallel to `titles`/`rows` by index. */
    ids: string[];
    action: (formData: FormData) => Promise<void>;
    /** Unique per queue instance — more than one `ReviewQueue` can be on the page at once. */
    formId: string;
    selectAllLabel: string;
    deselectAllLabel: string;
  };
}) {
  const [query, setQuery] = useState("");
  const { selectedIds, toggleSelect, allSelected, toggleSelectAll } = usePhotoSelection(
    bulkApprove?.ids ?? [],
  );
  const needle = query.trim().toLowerCase();
  const matches = (i: number) => !needle || titles[i]?.toLowerCase().includes(needle);
  const visibleCount = titles.filter((_, i) => matches(i)).length;

  function onBulkSubmit(event: FormEvent<HTMLFormElement>) {
    if (
      !window.confirm(
        t(labels.approveSelectedConfirm, { count: String(selectedIds.size) }),
      )
    ) {
      event.preventDefault();
    }
  }

  return (
    <>
      {titles.length > 1 && (
        <div className="relative mt-6 max-w-sm">
          <SearchIcon
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.reviewSearchPlaceholder}
            aria-label={labels.reviewSearchLabel}
            className="h-11 w-full rounded-pill bg-cloud pl-11 pr-4 text-body text-ink ring-1 ring-inset ring-edge placeholder:text-slate focus:ring-2 focus:ring-green-600"
          />
        </div>
      )}

      {bulkApprove && titles.length > 1 && (
        <form
          id={bulkApprove.formId}
          action={bulkApprove.action}
          onSubmit={onBulkSubmit}
          className="mt-4 flex flex-wrap items-center justify-between gap-3"
        >
          <SelectAllToggle
            checked={allSelected}
            onChange={toggleSelectAll}
            selectLabel={bulkApprove.selectAllLabel}
            deselectLabel={bulkApprove.deselectAllLabel}
          />
          <BulkApproveSubmit label={labels.approveSelected} count={selectedIds.size} />
        </form>
      )}

      {needle && visibleCount === 0 && (
        <p className="mt-6 rounded-card bg-cloud px-6 py-12 text-center text-body text-slate">
          {t(labels.reviewSearchEmpty, { query: query.trim() })}
        </p>
      )}

      <ul className={titles.length > 1 ? "mt-4 space-y-4" : "mt-6 space-y-4"}>
        {rows.map((row, i) => {
          if (!isValidElement(row)) return row;
          const extra: { hidden: boolean; selected?: boolean; onToggleSelect?: () => void; bulkFormId?: string } = {
            hidden: !matches(i),
          };
          if (bulkApprove && titles.length > 1) {
            const id = bulkApprove.ids[i];
            extra.selected = selectedIds.has(id);
            extra.onToggleSelect = () => toggleSelect(id);
            extra.bulkFormId = bulkApprove.formId;
          }
          return cloneElement(row, extra as never);
        })}
      </ul>
    </>
  );
}

function BulkApproveSubmit({ label, count }: { label: string; count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      size="sm"
      disabled={count === 0 || pending}
      pending={pending}
    >
      <CheckIcon size={16} />
      {label}
      {count > 0 && ` (${count})`}
    </Button>
  );
}
