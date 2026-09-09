"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { CoverField } from "@/components/studio/cover-field";
import { PinField } from "@/components/studio/pin-field";
import { createEvent, type StudioState } from "@/lib/actions/studio";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const field =
  "h-[46px] w-full rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 placeholder:text-slate focus:ring-2 focus:ring-green-600";

/**
 * Create an event.
 *
 * On success the action redirects, so the state this holds is only ever an
 * error — and it carries the submitted values back with it. A form that clears
 * itself on a validation failure makes the person retype everything to fix one
 * field, which is how a photographer setting up at a venue on a phone gives up.
 *
 * There is no link field and no code field. The event's public address is the
 * six-character code the database issues on insert, shown on the next screen
 * with its QR. Letting a photographer choose either would hand out a guessable
 * gate to an unlisted gallery and put a second identifier in play that has to
 * be kept unique for no benefit.
 *
 * There is also no date field and no location field — asking for them here
 * is friction a photographer setting up in a hurry does not need. `createEvent`
 * defaults the date to today in Bangkok time; both can be filled in afterward
 * from the event's settings page, where `EventSettingsForm` still has them.
 */
export function EventForm({ labels }: { labels: Dictionary["studio"] }) {
  const [state, action] = useActionState<StudioState, FormData>(
    createEvent,
    undefined,
  );

  const message =
    state?.error === "invalid"
      ? labels.formErrorInvalid
      : state?.error === "pin_required"
        ? labels.formErrorPinRequired
      : state?.error === "cover_too_large"
        ? labels.formErrorCoverTooLarge
        : state?.error === "cover_bad_format"
          ? labels.formErrorCoverBadFormat
          : state?.error === "unavailable"
            ? labels.formErrorUnavailable
            : null;

  const prior = state?.values ?? {};
  const [isPrivate, setPrivate] = useState(prior.isPrivate === "on");

  return (
    <form action={action} className="mt-10 space-y-6">
      {message && (
        <p
          role="alert"
          className="rounded-field bg-danger px-4 py-3 text-label text-paper"
        >
          {message}
        </p>
      )}

      <Field id="nameTh" label={labels.formNameTh}>
        <input
          id="nameTh"
          name="nameTh"
          required
          minLength={2}
          maxLength={160}
          defaultValue={prior.nameTh}
          className={field}
        />
      </Field>

      <Field id="nameEn" label={labels.formNameEn}>
        <input
          id="nameEn"
          name="nameEn"
          maxLength={160}
          defaultValue={prior.nameEn}
          className={field}
        />
      </Field>

      <CoverField labels={labels} currentPath={null} />

      <Field id="descriptionTh" label={labels.formDescription}>
        <textarea
          id="descriptionTh"
          name="descriptionTh"
          rows={4}
          maxLength={2000}
          defaultValue={prior.descriptionTh}
          className="w-full rounded-field bg-paper px-4 py-3 text-body leading-relaxed text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 focus:ring-2 focus:ring-green-600"
        />
      </Field>

      {/* One switch, not two. Hiding an event from the index and gating it
          behind a PIN always travelled together — an unlisted gallery with no
          PIN is one guessed URL away from public. */}
      <div className="rounded-card bg-cloud p-4">
        <label className="flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            name="isPrivate"
            checked={isPrivate}
            onChange={(event) => setPrivate(event.target.checked)}
            className="mt-0.5 size-5 shrink-0 rounded-[6px] accent-green-600"
          />
          <span>
            <span className="block text-label font-medium text-ink">
              {labels.formPrivate}
            </span>
            <span className="mt-0.5 block text-caption text-slate">
              {labels.formPrivateHint}
            </span>
          </span>
        </label>

        <PinField labels={labels} enabled={isPrivate} />
      </div>

      <Submit label={labels.formCreate} />
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-label font-medium text-ink">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-caption text-slate">{hint}</p>}
    </div>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" pending={pending} className="w-full sm:w-auto">
      {label}
    </Button>
  );
}
