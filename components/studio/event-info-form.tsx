"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { CheckIcon } from "@/components/ui/icon";
import { CoverField } from "@/components/studio/cover-field";
import { PinField } from "@/components/studio/pin-field";
import { updateEventInfo, type EventInfoState } from "@/lib/actions/studio";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { StudioEventSettings } from "@/lib/queries/studio";

const field =
  "h-[46px] w-full rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 placeholder:text-slate focus:ring-2 focus:ring-green-600";

/**
 * Who this event is, and who gets to see it: name, description, cover,
 * privacy and the PIN — split from `EventSettingsForm` into its own form
 * and save. Privacy moved in alongside name/description/cover rather than
 * staying with the download toggle and watermark: a photographer reaches
 * for "is this event private" at the same moment they set it up or rename
 * it, not when they're tuning a watermark, and sharing one submit button
 * meant an unrelated field could block a save that had nothing to do with it.
 *
 * A full reload rather than re-syncing local state from the `event` prop —
 * see the same note on `EventSettingsForm`, which this mirrors: there is no
 * guarantee the prop reflects the just-saved row by the time this component
 * re-renders, and a reload sidesteps that entirely.
 */
export function EventInfoForm({
  event,
  labels,
}: {
  event: StudioEventSettings;
  labels: Dictionary["studio"];
}) {
  const [state, action] = useActionState<EventInfoState, FormData>(
    updateEventInfo,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) window.location.reload();
  }, [state]);

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
  const [pinValue, setPinValue] = useState("");

  // Mirrors the server check in `updateEventInfo`: a private event needs a
  // PIN, either a freshly typed one or the one already saved on the event.
  // Shown live rather than only after a rejected submit — the round trip
  // was otherwise the first place a photographer found out.
  const needsPin = isPrivate && !event.entryPin && pinValue.length < 6;

  return (
    <form action={action} className="rounded-card bg-cloud p-5 sm:p-6">
      <input type="hidden" name="id" value={event.id} />

      <h2 className="text-h3 font-semibold text-ink">{labels.settingsInfoTitle}</h2>
      <p className="mt-1 text-label text-slate">{labels.settingsInfoLede}</p>

      <div className="mt-5 space-y-5">
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

        <CoverField labels={labels} currentPath={event.coverPath} />

        <div className="grid gap-5 sm:grid-cols-2">
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
        </div>

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

        {/* Who can see it is a separate decision from who this event is,
            even though it lives in the same form now — the divider is the
            only seam that distinction needs. */}
        <div className="space-y-5 border-t border-edge pt-5">
          <h3 className="text-label font-semibold text-ink">
            {labels.settingsAccessTitle}
          </h3>

          <CheckboxRow
            name="isPrivate"
            checked={isPrivate}
            onChange={setPrivate}
            label={labels.formPrivate}
            hint={labels.formPrivateHint}
          />

          {needsPin && (
            <p className="rounded-field bg-lime-100 px-4 py-3 text-label text-green-900">
              {labels.formErrorPinRequired}
            </p>
          )}

          <PinField
            labels={labels}
            enabled={isPrivate}
            initialValue={event.entryPin ?? undefined}
            onChange={setPinValue}
          />
        </div>

        <Submit label={labels.formSave} />
      </div>
    </form>
  );
}

/**
 * The checkbox-with-label-and-hint row this form's `isPrivate` field uses —
 * mirrors the one in `EventSettingsForm`, kept as its own local copy rather
 * than shared, the same way `Field` and `Submit` already are per form here.
 */
function CheckboxRow({
  name,
  label,
  hint,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-start gap-3">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-5 shrink-0 rounded-[6px] accent-green-600"
      />
      <span>
        <span className="block text-label font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-caption text-slate">{hint}</span>}
      </span>
    </label>
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
    <Button type="submit" size="md" pending={pending} className="w-full sm:w-auto">
      <CheckIcon size={18} />
      {label}
    </Button>
  );
}
