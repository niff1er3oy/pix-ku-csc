"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  joinAffiliation,
  type JoinAffiliationState,
} from "@/lib/actions/affiliations";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function JoinAffiliationForm({ dict }: { dict: Dictionary }) {
  const [state, action] = useActionState<JoinAffiliationState, FormData>(
    joinAffiliation,
    undefined,
  );

  const message =
    state?.error === "invalid"
      ? dict.affiliationStudio.joinErrorInvalid
      : state?.error === "not_found"
        ? dict.affiliationStudio.joinErrorNotFound
        : state?.error === "already_in"
          ? dict.affiliationStudio.joinErrorAlreadyIn
          : null;

  return (
    <form action={action} className="mt-6 flex max-w-sm flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1">
        <label htmlFor="joinCode" className="block text-label font-medium text-ink">
          {dict.affiliationStudio.joinLabel}
        </label>
        <input
          id="joinCode"
          name="joinCode"
          required
          maxLength={32}
          // Always six digits — `generatePin()` in `lib/event-pin.ts` is the
          // same generator the event PIN uses, and `PinField` already opens
          // the number pad for that one. A plain text keyboard here made
          // someone type a numeric code on the full alphabet layout for no
          // reason other than this field forgetting to ask for the other one.
          inputMode="numeric"
          autoComplete="off"
          className="mt-1.5 h-[46px] w-full rounded-field bg-paper px-4 text-body tracking-[0.2em] text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 focus:ring-2 focus:ring-green-600"
        />
      </div>
      <Submit label={dict.affiliationStudio.joinSubmit} />
      {message && (
        <p role="alert" className="w-full text-label text-danger">
          {message}
        </p>
      )}
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="md" pending={pending}>
      {label}
    </Button>
  );
}
