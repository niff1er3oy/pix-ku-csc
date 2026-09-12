"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  createAffiliation,
  lookupAffiliationFounder,
  type CreateAffiliationState,
  type FounderPreview,
} from "@/lib/actions/affiliations";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/** A full email, not just "has an @" — otherwise every half-typed domain
 *  would round-trip a lookup that can only ever come back not-found. */
const FULL_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * An affiliation is created with its first member already in it — see the
 * note on `createAffiliation` in `lib/actions/affiliations.ts` for why an
 * empty one is not a useful object. `useActionState` rather than a plain
 * form: unlike the name field, the email can fail in three different ways
 * only the server can tell apart, and a form that just silently did nothing
 * would leave an admin re-clicking submit with no idea why.
 *
 * `onSuccess` fires once, exactly when a submit comes back `{ ok: true }` —
 * not on the identical `undefined` this hook also starts with, which is why
 * the action returns that literal rather than falling off the end. The popup
 * this renders inside (`CreateAffiliationButton`) uses it to close itself;
 * there is nothing left on screen worth reading once creation succeeds.
 */
export function CreateAffiliationForm({
  dict,
  onSuccess,
}: {
  dict: Dictionary;
  onSuccess?: () => void;
}) {
  const [state, action] = useActionState<CreateAffiliationState, FormData>(
    createAffiliation,
    undefined,
  );

  useEffect(() => {
    if (state && "ok" in state && state.ok) onSuccess?.();
  }, [state, onSuccess]);

  const [email, setEmail] = useState("");
  // Tagged with the email it was fetched for, so a preview never gets
  // rendered against an input that has since changed underneath it —
  // computed at render time below rather than mirrored into its own reset
  // effect, which would just be state chasing state.
  const [preview, setPreview] = useState<(FounderPreview & { forEmail: string }) | null>(
    null,
  );

  const trimmedEmail = email.trim();
  const isFullEmail = FULL_EMAIL.test(trimmedEmail);
  const activePreview = preview && preview.forEmail === trimmedEmail ? preview : null;
  const checking = isFullEmail && !activePreview;

  // Debounced, and guarded against the reply for an email the admin has
  // already typed past arriving after a later, faster one — without
  // `ignore`, a slow lookup for "a@example.com" landing after a fast one for
  // "ab@example.com" would silently overwrite the right preview with a
  // stale wrong one.
  useEffect(() => {
    if (!isFullEmail) return;

    let ignore = false;
    const timer = setTimeout(() => {
      lookupAffiliationFounder(trimmedEmail).then((result) => {
        if (!ignore) setPreview({ ...result, forEmail: trimmedEmail });
      });
    }, 400);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [trimmedEmail, isFullEmail]);

  const error = state && "error" in state ? state.error : null;
  const message =
    error === "invalid"
      ? dict.adminAffiliationsPage.createErrorInvalid
      : error === "email_not_found"
        ? dict.adminAffiliationsPage.createErrorEmailNotFound
        : error === "email_not_approved"
          ? dict.adminAffiliationsPage.createErrorEmailNotApproved
          : error === "email_already_in"
            ? dict.adminAffiliationsPage.createErrorEmailAlreadyIn
            : null;

  return (
    <form action={action} className="mt-4 space-y-4">
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
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1.5 h-[46px] w-full rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 focus:ring-2 focus:ring-green-600"
        />
        <p className="mt-1.5 text-caption text-slate">
          {dict.adminAffiliationsPage.createEmailHint}
        </p>

        {checking && (
          <p className="mt-2 text-caption text-slate">
            {dict.adminAffiliationsPage.createChecking}
          </p>
        )}

        {activePreview && (
          <div className="mt-2 flex items-center gap-2 rounded-field bg-cloud px-3 py-2">
            {activePreview.found ? (
              <>
                <Avatar src={activePreview.image} size={28} />
                <span className="min-w-0 flex-1 truncate text-label text-ink">
                  {activePreview.name}
                </span>
                {!activePreview.eligible && (
                  <span className="shrink-0 text-caption text-danger">
                    {activePreview.reason === "not_approved"
                      ? dict.adminAffiliationsPage.createErrorEmailNotApproved
                      : dict.adminAffiliationsPage.createErrorEmailAlreadyIn}
                  </span>
                )}
              </>
            ) : (
              <span className="text-label text-slate">
                {dict.adminAffiliationsPage.createErrorEmailNotFound}
              </span>
            )}
          </div>
        )}
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
