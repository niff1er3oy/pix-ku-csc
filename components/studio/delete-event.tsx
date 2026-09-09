"use client";

import { useEffect, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  AlertIcon,
  CloseIcon,
  FaceScanIcon,
  PhotoIcon,
  ShieldIcon,
  TrashIcon,
} from "@/components/ui/icon";
import { deleteEvent } from "@/lib/actions/studio";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * Deleting an event, with the friction the action deserves.
 *
 * The photographer has to retype the event's own six-character code. A confirm
 * dialog gets clicked through on reflex; six characters that are only correct
 * for the event actually on screen force a look at which one this is. The
 * server checks it again — this is a hint to the person, not the guard.
 *
 * The warning lists what actually goes, with the real photo count, because
 * "this cannot be undone" tells somebody nothing about the size of what they
 * are about to lose. An approved event says so too: students may already have
 * been handed the code and told to come back for their photographs.
 *
 * A popup rather than an inline disclosure — the same `PhotoUploader` uses,
 * see the note there: it puts the confirm step on top of the page instead of
 * pushing everything below it down, which matters more here than there,
 * since this is the one control on the page a stray click should never
 * casually reveal.
 */
export function DeleteEvent({
  eventId,
  accessCode,
  photoCount,
  isLive,
  labels,
  closeLabel,
}: {
  eventId: string;
  accessCode: string;
  photoCount: number;
  isLive: boolean;
  labels: Dictionary["studio"];
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toUpperCase() === accessCode.toUpperCase();

  // Scrolling the page behind the popup makes it look stuck rather than on
  // top of it, and Escape is the fastest way out of a modal on a keyboard —
  // see the same note on `PhotoUploader`.
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

  return (
    <div className="mt-6 text-right">
      <Button type="button" variant="danger" size="md" onClick={() => setOpen(true)}>
        <AlertIcon size={18} />
        {labels.deleteEvent}
      </Button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-event-title"
            className="modal-backdrop fixed inset-0 z-50 overflow-y-auto bg-ink/90 p-4 sm:p-8"
            onClick={() => setOpen(false)}
          >
            <div className="mx-auto flex min-h-full max-w-lg items-center py-4">
              <div
                className="modal-content w-full rounded-card bg-paper p-5 shadow-[var(--shadow-lift)] sm:p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-pill bg-danger/10 text-danger">
                      <AlertIcon size={22} />
                    </span>
                    <h3
                      id="delete-event-title"
                      className="pt-2 text-h3 font-semibold text-ink"
                    >
                      {labels.deleteWarnTitle}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={closeLabel}
                    className="grid size-11 shrink-0 place-items-center rounded-pill text-slate transition-colors duration-200 hover:bg-cloud"
                  >
                    <CloseIcon size={20} />
                  </button>
                </div>

                {/* What actually goes, read as a receipt rather than a
                    disclaimer — a tinted row list carries more weight than
                    gray bullet points, and each line earns its own icon
                    instead of repeating the same dot three times. */}
                <ul className="mt-5 divide-y divide-danger/15 overflow-hidden rounded-field bg-danger/5 ring-1 ring-inset ring-danger/15">
                  <Row icon={PhotoIcon}>
                    {t(labels.deleteWarnPhotos, { count: String(photoCount) })}
                  </Row>
                  <Row icon={FaceScanIcon}>{labels.deleteWarnFaces}</Row>
                  <Row icon={ShieldIcon}>{labels.deleteWarnCode}</Row>
                  {isLive && (
                    <Row icon={AlertIcon} emphasis>
                      {labels.deleteWarnLive}
                    </Row>
                  )}
                </ul>

                <form action={deleteEvent} className="mt-6 text-left">
                  <input type="hidden" name="id" value={eventId} />

                  <label
                    htmlFor="confirm"
                    className="block text-label font-medium text-ink"
                  >
                    {t(labels.deleteConfirmLabel, { code: accessCode })}
                  </label>
                  <input
                    id="confirm"
                    name="confirm"
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="tnum mt-1.5 h-[46px] w-full rounded-field bg-paper px-4 text-center font-display text-lg font-semibold uppercase tracking-[0.2em] text-ink ring-1 ring-inset ring-edge focus:ring-2 focus:ring-danger"
                  />

                  <Submit label={labels.deleteEventConfirm} enabled={matches} />
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** One line of the "what this takes with it" list — an icon fixed to the
 *  same column so three unrelated facts (a count, a dataset, a live gate)
 *  still read as one list instead of three differently-shaped sentences. */
function Row({
  icon: Icon,
  emphasis = false,
  children,
}: {
  icon: (props: { size?: number; className?: string }) => React.ReactElement;
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Icon size={18} className="mt-0.5 shrink-0 text-danger" />
      <span className={cn("text-label", emphasis ? "font-semibold text-danger" : "text-ink")}>
        {children}
      </span>
    </li>
  );
}

function Submit({ label, enabled }: { label: string; enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="danger"
      size="md"
      className="mt-4 w-full sm:w-auto"
      disabled={!enabled || pending}
      pending={pending}
    >
      <TrashIcon size={18} />
      {label}
    </Button>
  );
}
