"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { CoverField } from "@/components/studio/cover-field";
import { PinField } from "@/components/studio/pin-field";
import { updateEvent, type EventSettingsState } from "@/lib/actions/studio";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { StudioEventSettings } from "@/lib/queries/studio";

const field =
  "h-[46px] w-full rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 placeholder:text-slate focus:ring-2 focus:ring-green-600";

/**
 * Edits an existing event's basic info, cover and privacy — the same fields
 * `EventForm` collects on creation, pre-filled from the row instead of blank.
 *
 * On a validation failure the action echoes back what was actually typed
 * (`state.values`), same as on creation; on success it returns `{ ok: true }`
 * with nothing to echo, so the fields fall back to the event's own values —
 * which by then are the values just saved.
 */
export function EventSettingsForm({
  event,
  labels,
}: {
  event: StudioEventSettings;
  labels: Dictionary["studio"];
}) {
  const [state, action] = useActionState<EventSettingsState, FormData>(
    updateEvent,
    undefined,
  );

  const message =
    state?.ok === false
      ? state.error === "invalid"
        ? labels.formErrorInvalid
        : state.error === "pin_required"
          ? labels.formErrorPinRequired
          : state.error === "cover_too_large"
            ? labels.formErrorCoverTooLarge
            : state.error === "cover_bad_format"
              ? labels.formErrorCoverBadFormat
              : labels.formErrorUnavailable
      : null;

  const prior = state?.ok === false ? state.values : undefined;
  const [isPrivate, setPrivate] = useState(
    prior ? prior.isPrivate === "on" : event.isPrivate,
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={event.id} />

      {state?.ok === true && (
        <p className="rounded-field bg-green-50 px-4 py-3 text-label text-green-700">
          {labels.settingsSaved}
        </p>
      )}
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
          defaultValue={prior?.nameTh ?? event.nameTh}
          className={field}
        />
      </Field>

      <Field id="nameEn" label={labels.formNameEn}>
        <input
          id="nameEn"
          name="nameEn"
          maxLength={160}
          defaultValue={prior?.nameEn ?? event.nameEn ?? ""}
          className={field}
        />
      </Field>

      <CoverField labels={labels} currentPath={event.coverPath} />

      <Field id="eventDate" label={labels.formEventDate}>
        <input
          id="eventDate"
          name="eventDate"
          type="date"
          required
          defaultValue={prior?.eventDate ?? event.eventDate}
          className={field}
        />
      </Field>

      <Field id="location" label={labels.formLocation}>
        <input
          id="location"
          name="location"
          maxLength={160}
          defaultValue={prior?.location ?? event.location ?? ""}
          className={field}
        />
      </Field>

      <Field id="descriptionTh" label={labels.formDescription}>
        <textarea
          id="descriptionTh"
          name="descriptionTh"
          rows={4}
          maxLength={2000}
          defaultValue={prior?.descriptionTh ?? event.descriptionTh ?? ""}
          className="w-full rounded-field bg-paper px-4 py-3 text-body leading-relaxed text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 focus:ring-2 focus:ring-green-600"
        />
      </Field>

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

        {isPrivate && event.hasPin && (
          <p className="mt-3 border-t border-edge pt-3 text-caption text-slate">
            {labels.formPinKeepHint}
          </p>
        )}

        <PinField labels={labels} enabled={isPrivate} />
      </div>

      <label className="flex min-h-11 items-start gap-3 rounded-card bg-cloud p-4">
        <input
          type="checkbox"
          name="allowOriginalDownload"
          defaultChecked={event.allowOriginalDownload}
          className="mt-0.5 size-5 shrink-0 rounded-[6px] accent-green-600"
        />
        <span>
          <span className="block text-label font-medium text-ink">
            {labels.formAllowDownload}
          </span>
          <span className="mt-0.5 block text-caption text-slate">
            {labels.formAllowDownloadHint}
          </span>
        </span>
      </label>

      <Submit label={labels.formSave} />
    </form>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-label font-medium text-ink">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
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
