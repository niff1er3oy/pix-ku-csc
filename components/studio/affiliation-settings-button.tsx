"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";

import { AffiliationImageField } from "@/components/studio/affiliation-image-field";
import { CopyLinkButton } from "@/components/studio/copy-link-button";
import { LeaveAffiliationButton } from "@/components/studio/leave-affiliation-button";
import { Button } from "@/components/ui/button";
import { CloseIcon, SettingsIcon } from "@/components/ui/icon";
import {
  updateAffiliationSettings,
  type AffiliationSettingsState,
} from "@/lib/actions/affiliations";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Everything about the affiliation itself rather than its roster or its
 * events — its name, its join code, and the door out — collected into one
 * popup behind a "ตั้งค่า" button, the same shape `EventsManager` and
 * `CreateAffiliationButton` use: an admin (or here, any member) reaches for
 * this occasionally, and it does not need to sit open under the page the
 * rest of the time.
 */
export function AffiliationSettingsButton({
  dict,
  affiliationName,
  imagePath,
  joinCode,
}: {
  dict: Dictionary;
  affiliationName: string;
  imagePath: string | null;
  joinCode: string;
}) {
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={dict.studio.settingsButton}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill text-slate transition-colors duration-200 hover:bg-cloud hover:text-green-700"
      >
        <SettingsIcon size={18} />
      </button>

      {open && (
        <ModalPortal onClose={() => setOpen(false)}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="pt-2 text-h3 font-semibold text-ink">
              {dict.affiliationStudio.settingsTitle}
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

          <SettingsForm dict={dict} affiliationName={affiliationName} imagePath={imagePath} />

          <div className="mt-6 border-t border-edge pt-5">
            <p className="text-label font-medium text-ink">
              {dict.affiliationStudio.joinCodeLabel}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="tnum rounded-pill bg-cloud px-3 py-1.5 text-label tracking-[0.2em] text-ink">
                {joinCode}
              </span>
              <CopyLinkButton
                value={joinCode}
                label={dict.affiliationStudio.copyCode}
                copiedLabel={dict.affiliationStudio.copyCodeCopied}
              />
            </div>
          </div>

          <div className="mt-5 border-t border-edge pt-5">
            <LeaveAffiliationButton
              label={dict.affiliationStudio.leaveAffiliation}
              confirmMessage={dict.affiliationStudio.leaveConfirm}
            />
          </div>
        </ModalPortal>
      )}
    </>
  );
}

function SettingsForm({
  dict,
  affiliationName,
  imagePath,
}: {
  dict: Dictionary;
  affiliationName: string;
  imagePath: string | null;
}) {
  const [state, action] = useActionState<AffiliationSettingsState, FormData>(
    updateAffiliationSettings,
    undefined,
  );

  const error = state && "error" in state ? state.error : null;
  const message =
    error === "invalid"
      ? dict.affiliationStudio.renameErrorInvalid
      : error === "image_too_large"
        ? dict.affiliationStudio.renameErrorImageTooLarge
        : error === "image_bad_format"
          ? dict.affiliationStudio.renameErrorImageBadFormat
          : null;

  return (
    <form action={action} className="mt-4 space-y-4">
      <AffiliationImageField dict={dict} currentPath={imagePath} />

      <div>
        <label htmlFor="affiliation-name" className="block text-label font-medium text-ink">
          {dict.affiliationStudio.renameLabel}
        </label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <input
            id="affiliation-name"
            name="name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={affiliationName}
            className="h-[46px] min-w-0 flex-1 rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 focus:ring-2 focus:ring-green-600"
          />
          <RenameSubmit label={dict.affiliationStudio.renameSubmit} />
        </div>
      </div>

      {state && "ok" in state && state.ok && (
        <p className="text-label text-green-700">{dict.studio.settingsSaved}</p>
      )}
      {message && (
        <p role="alert" className="text-label text-danger">
          {message}
        </p>
      )}
    </form>
  );
}

function RenameSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="md" pending={pending}>
      {label}
    </Button>
  );
}

/** The exact backdrop/dialog shell `CreateAffiliationButton` and
 *  `EventsManager` each also render — pulled out here only because this
 *  popup, unlike theirs, has three unrelated sections stacked inside it
 *  rather than one form or one list. */
function ModalPortal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="modal-backdrop fixed inset-0 z-50 overflow-y-auto bg-ink/90 p-4 sm:p-8"
      onClick={onClose}
    >
      <div className="mx-auto flex min-h-full max-w-md items-center py-4">
        <div
          className="modal-content w-full rounded-card bg-paper p-5 shadow-[var(--shadow-lift)] sm:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
