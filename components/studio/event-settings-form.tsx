"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { CloseIcon, PhotoIcon } from "@/components/ui/icon";
import { CoverField } from "@/components/studio/cover-field";
import { PinField } from "@/components/studio/pin-field";
import { updateEvent, type EventSettingsState } from "@/lib/actions/studio";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { StudioEventSettings } from "@/lib/queries/studio";
import { cn } from "@/lib/utils";

const field =
  "h-[46px] w-full rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 placeholder:text-slate focus:ring-2 focus:ring-green-600";

const POSITIONS = [
  "bottom_right",
  "bottom_left",
  "top_right",
  "top_left",
  "center",
  "tiled",
] as const;

type Position = (typeof POSITIONS)[number];

/** Flex alignment for each anchored position — `tiled` is handled separately
 *  since it has no single corner to align to. */
const ANCHOR_CLASSES: Record<Exclude<Position, "tiled">, string> = {
  bottom_right: "items-end justify-end",
  bottom_left: "items-end justify-start",
  top_right: "items-start justify-end",
  top_left: "items-start justify-start",
  center: "items-center justify-center",
};

/**
 * Everything about an event that isn't "add photos," in one form behind one
 * save button: basic info, cover, privacy and the PIN, the download toggle,
 * and the watermark. This used to be two forms with two buttons on the same
 * page — a photographer does not think of "rename the event" and "adjust
 * the watermark" as two different saves, and the second button just meant
 * it got missed.
 *
 * Grouped into cloud-panel sections — the same block the pause/resume
 * control on the page above already uses — so four unrelated concerns
 * (who this event is, who can see it, who can download it, what gets
 * burned into a download) read as four distinct decisions instead of one
 * long column of fields with no seams.
 *
 * On a validation failure the action echoes back what was actually typed
 * (`state.values`) for the basic-info fields; on success it returns
 * `{ ok: true }` with nothing to echo, so those fields fall back to the
 * event's own values — which by then are the values just saved.
 *
 * The watermark and privacy fields are controlled instead, and are
 * deliberately *not* re-synced from `event` after a successful save: doing
 * that once caused a real regression (uncheck a box, save, watch it flip
 * back on) because `event` — a prop from the parent Server Component — is
 * not guaranteed to reflect the just-saved row by the time this re-renders.
 * Every controlled field already shows exactly what was submitted, which is
 * exactly what the server just saved. There is nothing to re-sync.
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

  // A full reload rather than re-syncing local state from the `event` prop
  // — the last attempt at that shipped a real regression (see the note
  // above), because there is no guarantee the prop reflects the just-saved
  // row by the time this component re-renders. A reload sidesteps the
  // question entirely: everything on screen, including every field this
  // component tracks in its own state, comes from one fresh request made
  // *after* the save has already committed, so it cannot show anything
  // other than what is actually in the database.
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
              : state.error === "logo_too_large"
                ? labels.watermarkErrorLogoTooLarge
                : state.error === "logo_bad_format"
                  ? labels.watermarkErrorLogoBadFormat
                  : state.error === "watermark_empty"
                    ? labels.watermarkErrorEmpty
                    : labels.formErrorUnavailable
      : null;

  const prior = state?.ok === false ? state.values : undefined;
  const [isPrivate, setPrivate] = useState(
    prior ? prior.isPrivate === "on" : event.isPrivate,
  );

  const logoInput = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [opacity, setOpacity] = useState(event.watermarkOpacity);
  const [scale, setScale] = useState(event.watermarkScale);
  const [watermarkEnabled, setWatermarkEnabled] = useState(event.watermarkEnabled);
  const [watermarkText, setWatermarkText] = useState(event.watermarkText ?? "");
  const [position, setPosition] = useState<Position>(event.watermarkPosition);

  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  const chooseLogo = (file: File | null) => {
    setLogoPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
    setLogoName(file?.name ?? null);
    setRemoveLogo(false);
  };

  const clearLogo = () => {
    if (logoInput.current) logoInput.current.value = "";
    chooseLogo(null);
    // Only the existing, server-side logo needs the explicit removal flag —
    // clearing a file that was never uploaded has nothing to remove.
    setRemoveLogo(Boolean(event.watermarkLogoPath));
  };

  const shownLogo = removeLogo
    ? null
    : (logoPreview ?? (event.watermarkLogoPath ? `/api/media/${event.watermarkLogoPath}` : null));

  // Mirrors the server check in `updateEvent`: "on" with neither a text nor
  // a logo composites nothing, and that is otherwise invisible until
  // somebody downloads a photo and wonders where the mark went.
  const showEmptyWarning = watermarkEnabled && !watermarkText.trim() && !shownLogo;

  const hasMark = Boolean(watermarkText.trim() || shownLogo);

  /**
   * `cqw` units (from the box's own `[container-type:inline-size]` below)
   * are 1% of *that box's* width regardless of flex nesting, which is
   * exactly what "scale" means on the server: a percentage of the photo's
   * width. This is an approximation, not a pixel match for `applyWatermark`
   * — real text metrics differ from a browser's — but it is close enough to
   * catch "the logo is enormous" before saving rather than after.
   */
  const mark = hasMark && (
    <div className="flex flex-col items-center gap-[1cqw]" style={{ opacity: opacity / 100 }}>
      {shownLogo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shownLogo}
          alt=""
          style={{ width: `${scale}cqw` }}
          className="max-w-full drop-shadow-md"
        />
      )}
      {watermarkText.trim() && (
        <span
          className="whitespace-nowrap font-display font-semibold text-white drop-shadow-md"
          style={{ fontSize: `clamp(6px, ${scale * 0.5}cqw, 48px)` }}
        >
          {watermarkText}
        </span>
      )}
    </div>
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={event.id} />
      {/* Present only when checked — an empty-string hidden field would still
          post a value, and the server's zod union expects "on" or nothing at
          all, the same shape a real checkbox produces. */}
      {removeLogo && <input type="hidden" name="removeLogo" value="on" />}

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

      <Section title={labels.settingsInfoTitle} lede={labels.settingsInfoLede}>
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

        <CoverField labels={labels} currentPath={event.coverPath} />

        <div className="grid gap-5 sm:grid-cols-2">
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
      </Section>

      <Section title={labels.settingsAccessTitle} lede={labels.settingsAccessLede}>
        <CheckboxRow
          name="isPrivate"
          checked={isPrivate}
          onChange={setPrivate}
          label={labels.formPrivate}
          hint={labels.formPrivateHint}
        />

        {isPrivate && event.hasPin && (
          <p className="text-caption text-slate">{labels.formPinKeepHint}</p>
        )}

        <PinField labels={labels} enabled={isPrivate} />
      </Section>

      <Section title={labels.settingsDownloadTitle}>
        <CheckboxRow
          name="allowOriginalDownload"
          defaultChecked={event.allowOriginalDownload}
          label={labels.formAllowDownload}
          hint={labels.formAllowDownloadHint}
        />
      </Section>

      <Section title={labels.watermarkTitle} lede={labels.watermarkLede}>
        <CheckboxRow
          name="watermarkEnabled"
          checked={watermarkEnabled}
          onChange={setWatermarkEnabled}
          label={labels.watermarkEnabled}
        />

        {showEmptyWarning && (
          <p className="rounded-field bg-lime-100 px-4 py-3 text-label text-green-900">
            {labels.watermarkErrorEmpty}
          </p>
        )}

        <Field id="watermarkText" label={labels.watermarkText}>
          <input
            id="watermarkText"
            name="watermarkText"
            maxLength={120}
            value={watermarkText}
            onChange={(event) => setWatermarkText(event.target.value)}
            className={field}
          />
        </Field>

        <div>
          <label
            htmlFor="watermarkLogo"
            className="block text-label font-medium text-ink"
          >
            {labels.watermarkLogo}
          </label>
          <div className="mt-1.5 flex flex-wrap items-start gap-4">
            <div className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-field bg-paper ring-1 ring-inset ring-edge">
              {shownLogo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={shownLogo}
                  alt=""
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                <span className="text-caption text-slate">—</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <input
                ref={logoInput}
                id="watermarkLogo"
                name="watermarkLogo"
                type="file"
                accept="image/png"
                onChange={(event) => chooseLogo(event.target.files?.[0] ?? null)}
                className="block w-full text-label text-slate file:mr-3 file:h-11 file:cursor-pointer file:rounded-pill file:border-0 file:bg-green-600 file:px-5 file:font-display file:text-sm file:font-semibold file:text-paper hover:file:bg-green-700"
              />

              {shownLogo ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-0 truncate text-caption text-slate">
                    {logoName ?? labels.watermarkLogoCurrent}
                  </span>
                  <button
                    type="button"
                    onClick={clearLogo}
                    className="inline-flex min-h-11 items-center gap-1 rounded-pill px-2 text-caption font-medium text-danger transition-colors duration-200 hover:bg-cloud"
                  >
                    <CloseIcon size={14} />
                    {labels.watermarkRemoveLogo}
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-caption text-slate">
                  {labels.watermarkLogoHint}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Position/opacity/scale and the preview both describe how the mark
            *looks*, as distinct from the text/logo/enabled fields above that
            decide *whether and what* it says — the divider is the only
            separator this section needs for that to read at a glance. */}
        <div className="grid gap-5 border-t border-edge pt-5 sm:grid-cols-3">
          <div>
            <label
              htmlFor="watermarkPosition"
              className="block text-label font-medium text-ink"
            >
              {labels.watermarkPosition}
            </label>
            <select
              id="watermarkPosition"
              name="watermarkPosition"
              value={position}
              onChange={(event) => setPosition(event.target.value as Position)}
              className={`mt-1.5 ${field}`}
            >
              {POSITIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {labels.watermarkPositions[pos]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="watermarkOpacity"
              className="flex items-baseline justify-between text-label font-medium text-ink"
            >
              {labels.watermarkOpacity}
              <span className="tnum text-caption font-normal text-slate">
                {opacity}%
              </span>
            </label>
            <input
              id="watermarkOpacity"
              name="watermarkOpacity"
              type="range"
              min={5}
              max={100}
              value={opacity}
              onChange={(event) => setOpacity(Number(event.target.value))}
              className="mt-3 h-[46px] w-full accent-green-600"
            />
          </div>

          <div>
            <label
              htmlFor="watermarkScale"
              className="flex items-baseline justify-between text-label font-medium text-ink"
            >
              {labels.watermarkScale}
              <span className="tnum text-caption font-normal text-slate">
                {scale}%
              </span>
            </label>
            <input
              id="watermarkScale"
              name="watermarkScale"
              type="range"
              min={4}
              max={60}
              value={scale}
              onChange={(event) => setScale(Number(event.target.value))}
              className="mt-3 h-[46px] w-full accent-green-600"
            />
          </div>
        </div>

        <div>
          <p className="text-label font-medium text-ink">{labels.watermarkPreview}</p>
          <div className="relative mt-1.5 aspect-[4/3] w-full max-w-sm overflow-hidden rounded-field bg-paper ring-1 ring-inset ring-edge [container-type:inline-size]">
            {event.coverPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/media/${event.coverPath}`}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center">
                <PhotoIcon size={32} className="text-slate" />
              </div>
            )}

            {mark && position !== "tiled" && (
              <div
                className={cn(
                  "pointer-events-none absolute inset-[3%] flex",
                  ANCHOR_CLASSES[position],
                )}
              >
                {mark}
              </div>
            )}

            {mark && position === "tiled" && (
              <div className="pointer-events-none absolute inset-0 flex flex-wrap content-around items-center justify-around gap-2 p-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i}>{mark}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Section>

      <Submit label={labels.formSave} />
    </form>
  );
}

/**
 * A cloud panel with a heading and an optional one-line lede — the same
 * shape `pauseTitle`'s block on the page above already uses, so the whole
 * settings page reads as one sequence of bounded decisions rather than a
 * page-length section followed by three smaller boxed afterthoughts.
 */
function Section({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-card bg-cloud p-5 sm:p-6">
      <h2 className="text-h3 font-semibold text-ink">{title}</h2>
      {lede && <p className="mt-1 text-label text-slate">{lede}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

/**
 * The checkbox-with-label-and-hint row every section uses at least once.
 * Controlled when `onChange` is given (`isPrivate`, `watermarkEnabled` need
 * their state read elsewhere on the same render); left uncontrolled
 * otherwise, since `allowOriginalDownload` has nothing else depending on it.
 */
function CheckboxRow({
  name,
  label,
  hint,
  checked,
  defaultChecked,
  onChange,
}: {
  name: string;
  label: string;
  hint?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-start gap-3">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange ? (event) => onChange(event.target.checked) : undefined}
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
      {label}
    </Button>
  );
}
