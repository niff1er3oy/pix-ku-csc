"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { CloseIcon, PhotoIcon } from "@/components/ui/icon";
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

      <CoverField labels={labels} />

      <Field id="eventDate" label={labels.formEventDate}>
        <input
          id="eventDate"
          name="eventDate"
          type="date"
          required
          defaultValue={prior.eventDate}
          className={field}
        />
      </Field>

      <Field id="location" label={labels.formLocation}>
        <input
          id="location"
          name="location"
          maxLength={160}
          defaultValue={prior.location}
          className={field}
        />
      </Field>

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

/**
 * The event cover, with a preview of what was picked.
 *
 * The preview matters more than it looks: a file input reports "cover.jpg" and
 * nothing else, and a photographer with forty near-identical frames on a phone
 * has no way to tell from that whether they grabbed the right one. Showing it
 * is the difference between choosing and guessing.
 *
 * `URL.createObjectURL` is revoked on replacement and on unmount — an object
 * URL pins the whole file in memory until it is, and these are photographs.
 */
function CoverField({ labels }: { labels: Dictionary["studio"] }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const choose = (file: File | null) => {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
    setName(file?.name ?? null);
  };

  /**
   * Clearing the preview is not enough — the `<input type="file">` keeps its
   * own selection, and the form would still submit the file the photographer
   * just said they did not want. Emptying `value` is the only way to unset a
   * file input; there is no other API for it.
   */
  const clear = () => {
    if (input.current) input.current.value = "";
    choose(null);
  };

  return (
    <div>
      <label htmlFor="cover" className="block text-label font-medium text-ink">
        {labels.formCover}
      </label>

      <div className="mt-1.5 flex flex-wrap items-start gap-4">
        <div className="grid h-24 w-32 shrink-0 place-items-center overflow-hidden rounded-field bg-cloud ring-1 ring-inset ring-edge">
          {preview ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <PhotoIcon size={28} className="text-slate" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <input
            ref={input}
            id="cover"
            name="cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => choose(event.target.files?.[0] ?? null)}
            className="block w-full text-label text-slate file:mr-3 file:h-11 file:cursor-pointer file:rounded-pill file:border-0 file:bg-green-600 file:px-5 file:font-display file:text-sm file:font-semibold file:text-paper hover:file:bg-green-700"
          />

          {name ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-0 truncate text-caption text-slate">
                {name}
              </span>
              <button
                type="button"
                onClick={clear}
                className="inline-flex min-h-11 items-center gap-1 rounded-pill px-2 text-caption font-medium text-danger transition-colors duration-200 hover:bg-cloud"
              >
                <CloseIcon size={14} />
                {labels.formCoverClear}
              </button>
            </div>
          ) : (
            <p className="mt-2 text-caption text-slate">
              {labels.formCoverHint}
            </p>
          )}
        </div>
      </div>
    </div>
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
