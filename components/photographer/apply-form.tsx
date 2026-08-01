"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  applyAsPhotographer,
  type ApplyState,
} from "@/lib/actions/photographer";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const field =
  "mt-2 h-[46px] w-full rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 placeholder:text-slate/70 focus:ring-2 focus:ring-green-600";

export function PhotographerApplyForm({ dict }: { dict: Dictionary }) {
  const [state, action] = useActionState<ApplyState, FormData>(
    applyAsPhotographer,
    undefined,
  );

  return (
    <form action={action} className="mt-10 space-y-6">
      <div>
        <label htmlFor="displayName" className="text-label font-medium">
          {dict.photographer.displayName}
        </label>
        <input id="displayName" name="displayName" required className={field} />
        <p className="mt-1.5 text-caption text-slate">
          {dict.photographer.displayNameHint}
        </p>
      </div>

      <div>
        <label htmlFor="affiliation" className="text-label font-medium">
          {dict.photographer.affiliation}
        </label>
        <input id="affiliation" name="affiliation" className={field} />
        <p className="mt-1.5 text-caption text-slate">
          {dict.photographer.affiliationHint}
        </p>
      </div>

      <div>
        <label htmlFor="bio" className="text-label font-medium">
          {dict.photographer.bio}
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={4}
          className={`${field} h-auto py-3`}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="contactEmail" className="text-label font-medium">
            {dict.photographer.contactEmail}
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            className={field}
          />
        </div>
        <div>
          <label htmlFor="contactPhone" className="text-label font-medium">
            {dict.photographer.contactPhone}
          </label>
          <input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            className={field}
          />
        </div>
      </div>

      {state?.error && (
        <p role="alert" className="text-label text-danger">
          {state.error === "duplicate"
            ? dict.photographer.statusPending
            : state.error === "unauthorized"
              ? dict.common.forbiddenBody
              : dict.common.required}
        </p>
      )}

      <SubmitButton label={dict.photographer.submit} />
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-14 rounded-pill bg-green-600 px-8 font-display text-base font-semibold text-paper shadow-[var(--shadow-pop)] transition-[background-color,transform] duration-200 hover:bg-green-700 active:scale-[0.98] disabled:opacity-60"
    >
      {label}
    </button>
  );
}
