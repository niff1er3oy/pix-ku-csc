"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal, useFormStatus } from "react-dom";

import { SelectAllToggle } from "@/components/photos/select-all-toggle";
import { Button } from "@/components/ui/button";
import { CloseIcon, SearchIcon, SettingsIcon, TrashIcon } from "@/components/ui/icon";
import { adminDeleteEvents } from "@/lib/actions/admin";
import { usePhotoSelection } from "@/lib/hooks/use-photo-selection";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";
import type { EventStatus } from "@/db/schema";
import { cn, formatDate, formatNumber } from "@/lib/utils";

export type ManagedEvent = {
  id: string;
  accessCode: string;
  nameTh: string;
  status: EventStatus;
  eventDate: string;
  photoCount: number;
};

/**
 * One photographer's events, in a popup rather than the separate page this
 * used to send an admin to — a list this short does not need a whole page,
 * and a popup keeps the directory row it was opened from on screen.
 *
 * Search filters which rows are *visible*, never which are *mounted* — a
 * checked `<input type="checkbox">` that gets removed from the DOM does not
 * submit its value, so an admin who selects a few events, then searches to
 * find one more, would silently lose the earlier picks the moment a native
 * form collected them. Every row stays mounted; a non-matching one is
 * hidden with `hidden`, not filtered out of the list.
 *
 * Deletes through `adminDeleteEvents`, the admin's own version of
 * `deleteEvent` in `lib/actions/studio.ts` — same cleanup, no ownership
 * check, no retype-to-confirm (a checkbox list already says exactly which
 * ones), just a plain confirm naming how many are about to go for good.
 */
export function EventsManager({
  photographerName,
  events,
  dict,
  locale,
}: {
  photographerName: string;
  events: ManagedEvent[];
  dict: Dictionary;
  locale: "th" | "en";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { selectedIds, toggleSelect, allSelected, toggleSelectAll } = usePhotoSelection(
    events.map((event) => event.id),
  );

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const needle = query.trim().toLowerCase();
  const matches = (event: ManagedEvent) => !needle || event.nameTh.toLowerCase().includes(needle);
  const visibleCount = events.filter(matches).length;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (selectedIds.size === 0) {
      event.preventDefault();
      return;
    }
    if (
      !window.confirm(
        t(dict.admin.eventsManagerDeleteConfirm, { count: String(selectedIds.size) }),
      )
    ) {
      event.preventDefault();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-pill px-3 text-sm text-slate transition-colors duration-200 hover:bg-cloud hover:text-green-700"
      >
        <SettingsIcon size={16} />
        {dict.admin.manageEvents}
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="events-manager-title"
            className="modal-backdrop fixed inset-0 z-50 overflow-y-auto bg-ink/90 p-4 sm:p-8"
            onClick={() => setOpen(false)}
          >
            <div className="mx-auto flex min-h-full max-w-lg items-center py-4">
              <div
                className="modal-content w-full rounded-card bg-paper p-5 shadow-[var(--shadow-lift)] sm:p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3
                    id="events-manager-title"
                    className="pt-2 text-h3 font-semibold text-ink"
                  >
                    {t(dict.admin.eventsManagerTitle, { name: photographerName })}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={dict.common.close}
                    className="grid size-11 shrink-0 place-items-center rounded-pill text-slate transition-colors duration-200 hover:bg-cloud"
                  >
                    <CloseIcon size={20} />
                  </button>
                </div>

                {events.length > 1 && (
                  <div className="relative mt-4">
                    <SearchIcon
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate"
                    />
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={dict.eventsPage.searchPlaceholder}
                      aria-label={dict.eventsPage.searchLabel}
                      className="h-11 w-full rounded-pill bg-cloud pl-11 pr-4 text-body text-ink ring-1 ring-inset ring-edge placeholder:text-slate focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                )}

                {events.length === 0 ? (
                  <p className="mt-4 text-label text-slate">
                    {dict.admin.eventsManagerEmpty}
                  </p>
                ) : (
                  <form action={adminDeleteEvents} onSubmit={onSubmit} className="mt-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <SelectAllToggle
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        selectLabel={dict.results.selectAll}
                        deselectLabel={dict.results.deselectAll}
                      />
                      <DeleteSubmit
                        label={dict.admin.eventsManagerDeleteSelected}
                        count={selectedIds.size}
                      />
                    </div>

                    {needle && visibleCount === 0 && (
                      <p className="mt-4 text-label text-slate">
                        {t(dict.eventsPage.searchEmpty, { query: query.trim() })}
                      </p>
                    )}

                    <ul className="mt-4 max-h-80 divide-y divide-edge overflow-y-auto">
                      {events.map((event) => (
                        <li
                          key={event.id}
                          className={cn(
                            "flex items-center gap-3 py-3",
                            !matches(event) && "hidden",
                          )}
                        >
                          <input
                            type="checkbox"
                            name="eventIds"
                            value={event.id}
                            checked={selectedIds.has(event.id)}
                            onChange={() => toggleSelect(event.id)}
                            aria-label={event.nameTh}
                            className="size-5 shrink-0 rounded-[6px] accent-green-600"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-label font-medium text-ink">
                              {event.nameTh}
                            </p>
                            <p className="tnum text-caption text-slate">
                              {dict.status[event.status]}
                              {" · "}
                              {formatDate(event.eventDate, locale)}
                              {" · "}
                              {t(dict.studio.photosInEvent, {
                                count: formatNumber(event.photoCount, locale),
                              })}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </form>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function DeleteSubmit({ label, count }: { label: string; count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="danger"
      size="sm"
      disabled={count === 0 || pending}
      pending={pending}
    >
      <TrashIcon size={16} />
      {label}
      {count > 0 && ` (${count})`}
    </Button>
  );
}
