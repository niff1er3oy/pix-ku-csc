"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { CreateAffiliationForm } from "@/components/admin/create-affiliation-form";
import { Button } from "@/components/ui/button";
import { CloseIcon } from "@/components/ui/icon";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Opens `CreateAffiliationForm` in a popup rather than leaving it inline on
 * the page — the same call `EventsManager` makes: a form an admin reaches
 * for occasionally does not need to sit open under the list it is about to
 * add to, pushing every existing affiliation down the page whether or not
 * anyone is creating one right now.
 */
export function CreateAffiliationButton({ dict }: { dict: Dictionary }) {
  const [open, setOpen] = useState(false);

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
    <>
      <Button type="button" size="md" onClick={() => setOpen(true)}>
        {dict.adminAffiliationsPage.createSubmit}
      </Button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-affiliation-title"
            className="modal-backdrop fixed inset-0 z-50 overflow-y-auto bg-ink/90 p-4 sm:p-8"
            onClick={() => setOpen(false)}
          >
            <div className="mx-auto flex min-h-full max-w-md items-center py-4">
              <div
                className="modal-content w-full rounded-card bg-paper p-5 shadow-[var(--shadow-lift)] sm:p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3
                    id="create-affiliation-title"
                    className="pt-2 text-h3 font-semibold text-ink"
                  >
                    {dict.adminAffiliationsPage.createTitle}
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

                <CreateAffiliationForm dict={dict} onSuccess={() => setOpen(false)} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
