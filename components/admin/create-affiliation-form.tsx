"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  createAffiliation,
  type CreateAffiliationState,
} from "@/lib/actions/affiliations";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * An affiliation is created with its first member already in it — see the
 * note on `createAffiliation` in `lib/actions/affiliations.ts` for why an
 * empty one is not a useful object. `useActionState` rather than a plain
 * form: unlike the name field, the email can fail in three different ways
 * only the server can tell apart, and a form that just silently did nothing
 * would leave an admin re-clicking submit with no idea why.
 */
export function CreateAffiliationForm({ dict }: { dict: Dictionary }) {
  const [state, action] = useActionState<CreateAffiliationState, FormData>(
    createAffiliation,
    undefined,
  );

  const message =
    state?.error === "invalid"
      ? dict.adminAffiliationsPage.createErrorInvalid
      : state?.error === "email_not_found"
        ? dict.adminAffiliationsPage.createErrorEmailNotFound
        : state?.error === "email_not_approved"
          ? dict.adminAffiliationsPage.createErrorEmailNotApproved
          : state?.error === "email_already_in"
            ? dict.adminAffiliationsPage.createErrorEmailAlreadyIn
            : null;

  return (
    <form action={action} className="mt-8 max-w-md space-y-4">
      <div>
        <label htmlFor="name" className="block text-label font-medium text-ink">
          {dict.adminAffiliationsPage.createNameLabel}
        </label>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          className="mt-1.5 h-[46px] w-full rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 focus:ring-2 focus:ring-green-600"
        />
      </div>

      <div>
        <label htmlFor="founder-email" className="block text-label font-medium text-ink">
          {dict.adminAffiliationsPage.createEmailLabel}
        </label>
        <input
          id="founder-email"
          name="email"
          type="email"
          required
          className="mt-1.5 h-[46px] w-full rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 focus:ring-2 focus:ring-green-600"
        />
        <p className="mt-1.5 text-caption text-slate">
          {dict.adminAffiliationsPage.createEmailHint}
        </p>
      </div>

      {message && (
        <p role="alert" className="text-label text-danger">
          {message}
        </p>
      )}

      <Submit label={dict.adminAffiliationsPage.createSubmit} />
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
