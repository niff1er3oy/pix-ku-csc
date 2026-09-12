"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { AlertIcon, CloseIcon, TrashIcon } from "@/components/ui/icon";
import { deleteAccount, type DeleteAccountState } from "@/lib/actions/profile";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";

/**
 * The one irreversible thing a signed-in user can do to their own account.
 *
 * Retyping the account's own email is the same friction `DeleteEvent` asks
 * for with an access code — a confirm dialog gets clicked through on
 * reflex, and typing something specific to *this* account forces a look at
 * which one is actually about to go.
 *
 * `deleteAccount` refuses outright while the account owns any event — see
 * its own doc comment for why a plain cascade delete would be the wrong
 * thing to run here. That refusal surfaces as `dangerHasEvents` rather than
 * a form left blank.
 */
export function DeleteAccountSection({
  dict,
  email,
}: {
  dict: Dictionary;
  email: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, action] = useActionState<DeleteAccountState, FormData>(
    deleteAccount,
    undefined,
  );
  const matches = email !== null && typed.trim().toLowerCase() === email.toLowerCase();

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
    <section className="enter [--d:80ms] rounded-card bg-danger/5 p-5 ring-1 ring-inset ring-danger/15 sm:p-6">
      <h2 className="text-h3 font-semibold text-ink">{dict.profile.dangerTitle}</h2>
      <p className="mt-2 text-label text-slate">{dict.profile.dangerBody}</p>

      <Button
        type="button"
        variant="danger"
        size="md"
        className="mt-4"
        onClick={() => setOpen(true)}
      >
        <AlertIcon size={18} />
        {dict.profile.dangerCta}
      </Button>

      {open &&
        email &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
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
                      id="delete-account-title"
                      className="pt-2 text-h3 font-semibold text-ink"
                    >
                      {dict.profile.dangerTitle}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={dict.common.close}
                    className="grid size-11 shrink-0 place-items-center rounded-pill text-slate transition-colors duration-200 hover:bg-cloud"
                  >
                    <CloseIcon size={20} />
                  </button>
                </div>

                <p className="mt-4 text-label text-slate">{dict.profile.dangerBody}</p>

                <form action={action} className="mt-5 text-left">
                  <label
                    htmlFor="confirm"
                    className="block text-label font-medium text-ink"
                  >
                    {t(dict.profile.dangerConfirmLabel, { email })}
                  </label>
                  <input
                    id="confirm"
                    name="confirm"
                    type="email"
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    className="mt-1.5 h-[46px] w-full rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge focus:ring-2 focus:ring-danger"
                  />

                  {state?.error && (
                    <p role="alert" className="mt-2 text-label text-danger">
                      {state.error === "has_events"
                        ? dict.profile.dangerHasEvents
                        : dict.profile.dangerMismatch}
                    </p>
                  )}

                  <Submit label={dict.profile.dangerConfirm} enabled={matches} />
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
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
