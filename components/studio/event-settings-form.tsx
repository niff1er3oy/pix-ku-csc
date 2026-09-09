"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { CheckIcon, CloseIcon, PhotoIcon, UploadIcon } from "@/components/ui/icon";
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
 * Everything about an event that isn't "add photos" or "who this event is
 * and who can see it," in one form behind one save button: the download
 * toggle and the watermark. Name, description, cover, privacy, and the PIN
 * live in `EventInfoForm` instead — see the note there for why the split.
 *
 * The watermark only ever does anything to a download, so it lives inside
 * the same cloud-panel section as the download toggle rather than a section
 * of its own — and its controls are hidden, not removed, once the toggle is
 * off, so there is nothing left to configure for something that cannot
 * currently happen. Hidden with CSS rather than unmounted: an unmounted
 * `<select>`/`<input type="range">` stops posting with the form entirely,
 * which would make an unrelated save (just flipping the download toggle)
 * fail the server's watermark validation instead of quietly leaving those
 * fields as they were.
 *
 * The watermark fields are controlled instead, and are deliberately *not*
 * re-synced from `event` after a successful save: doing that once caused a
 * real regression (uncheck a box, save, watch it flip back on) because
 * `event` — a prop from the parent Server Component — is not guaranteed to
 * reflect the just-saved row by the time this re-renders. Every controlled
 * field already shows exactly what was submitted, which is exactly what
 * the server just saved. There is nothing to re-sync.
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
        : state.error === "logo_too_large"
          ? labels.watermarkErrorLogoTooLarge
          : state.error === "logo_bad_format"
            ? labels.watermarkErrorLogoBadFormat
            : state.error === "watermark_empty"
              ? labels.watermarkErrorEmpty
              : labels.formErrorUnavailable
      : null;

  const [allowDownload, setAllowDownload] = useState(event.allowOriginalDownload);

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

      <Section title={labels.settingsDownloadTitle}>
        <CheckboxRow
          name="allowOriginalDownload"
          checked={allowDownload}
          onChange={setAllowDownload}
          label={labels.formAllowDownload}
          hint={labels.formAllowDownloadHint}
        />

        {/* Hidden, not removed, once downloads are off — see the note at the
            top of this file for why unmounting these would be the wrong
            call. */}
        <div className={cn("space-y-5", !allowDownload && "hidden")}>
          <div className="border-t border-edge pt-5">
            <h3 className="text-label font-semibold text-ink">
              {labels.watermarkTitle}
            </h3>
            <p className="mt-1 text-caption text-slate">{labels.watermarkLede}</p>
          </div>

          <CheckboxRow
            name="watermarkEnabled"
            checked={watermarkEnabled}
            onChange={setWatermarkEnabled}
            label={labels.watermarkEnabled}
          />

          {/* Hidden, not removed, once the watermark itself is off — same
              reasoning as the download toggle above: these still have to
              post with the form, or turning the watermark off would also
              silently reset its text, logo, and position on the next save. */}
          <div className={cn("space-y-5", !watermarkEnabled && "hidden")}>
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
                  {/* Hidden and driven from a real Button instead — see the
                      same note on `CoverField`, which this now matches: the
                      native picker's own chrome varies by browser and OS and
                      carries no icon of its own. */}
                  <input
                    ref={logoInput}
                    id="watermarkLogo"
                    name="watermarkLogo"
                    type="file"
                    accept="image/png"
                    onChange={(event) => chooseLogo(event.target.files?.[0] ?? null)}
                    className="sr-only"
                  />

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => logoInput.current?.click()}
                  >
                    <UploadIcon size={16} />
                    {labels.formCoverChoose}
                  </Button>

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

            {/* Position/opacity/scale and the preview both describe how the
                mark *looks*, as distinct from the text/logo/enabled fields
                above that decide *whether and what* it says — the divider is
                the only separator this needs to read at a glance. */}
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
          </div>
        </div>

        <Submit label={labels.formSave} />
      </Section>
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
 * Both are controlled: `allowOriginalDownload` decides whether the
 * watermark controls beneath it are shown, and `watermarkEnabled` needs its
 * own state read elsewhere on the same render.
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
