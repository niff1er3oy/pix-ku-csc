"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { CloseIcon, PhotoIcon } from "@/components/ui/icon";
import { updateWatermark, type WatermarkState } from "@/lib/actions/studio";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { StudioEventSettings } from "@/lib/queries/studio";
import { cn } from "@/lib/utils";

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

const field =
  "h-[46px] w-full rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 focus:ring-2 focus:ring-green-600";

/**
 * The watermark, as its own form and its own action (`updateWatermark`) —
 * separate from `EventSettingsForm` because it has its own file upload and
 * its own failure modes. A bad logo file should not also discard a rename
 * typed into the other form in the same breath.
 *
 * Every field here stays mounted regardless of the "on" checkbox, rather
 * than being hidden while watermarking is off: unmounting them would drop
 * them from the submitted `FormData`, and the server side validates them as
 * required. Turning watermarking off is meant to be reversible without
 * having to re-enter the text, logo and position a second time.
 */
export function WatermarkForm({
  event,
  labels,
}: {
  event: StudioEventSettings;
  labels: Dictionary["studio"];
}) {
  const [state, action] = useActionState<WatermarkState, FormData>(
    updateWatermark,
    undefined,
  );

  const message =
    state?.ok === false
      ? state.error === "logo_too_large"
        ? labels.watermarkErrorLogoTooLarge
        : state.error === "logo_bad_format"
          ? labels.watermarkErrorLogoBadFormat
          : state.error === "empty"
            ? labels.watermarkErrorEmpty
            : labels.formErrorInvalid
      : null;

  const logoInput = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [opacity, setOpacity] = useState(event.watermarkOpacity);
  const [scale, setScale] = useState(event.watermarkScale);
  const [enabled, setEnabled] = useState(event.watermarkEnabled);
  const [text, setText] = useState(event.watermarkText ?? "");
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

  // Mirrors the server check in `updateWatermark`: "on" with neither a text
  // nor a logo composites nothing, and that is otherwise invisible until
  // somebody downloads a photo and wonders where the mark went.
  const showEmptyWarning = enabled && !text.trim() && !shownLogo;

  const hasMark = Boolean(text.trim() || shownLogo);

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
      {text.trim() && (
        <span
          className="whitespace-nowrap font-display font-semibold text-white drop-shadow-md"
          style={{ fontSize: `clamp(6px, ${scale * 0.5}cqw, 48px)` }}
        >
          {text}
        </span>
      )}
    </div>
  );

  return (
    <form action={action} className="mt-6 space-y-5 rounded-card bg-cloud p-5">
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

      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          name="watermarkEnabled"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="size-5 shrink-0 rounded-[6px] accent-green-600"
        />
        <span className="text-label font-medium text-ink">
          {labels.watermarkEnabled}
        </span>
      </label>

      {showEmptyWarning && (
        <p className="rounded-field bg-lime-100 px-4 py-3 text-label text-green-900">
          {labels.watermarkErrorEmpty}
        </p>
      )}

      <div>
        <p className="text-label font-medium text-ink">{labels.watermarkPreview}</p>
        <div
          className="relative mt-1.5 aspect-[4/3] w-full max-w-sm overflow-hidden rounded-field bg-cloud ring-1 ring-inset ring-edge [container-type:inline-size]"
        >
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

      <div>
        <label
          htmlFor="watermarkText"
          className="block text-label font-medium text-ink"
        >
          {labels.watermarkText}
        </label>
        <input
          id="watermarkText"
          name="watermarkText"
          maxLength={120}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className={`mt-1.5 ${field}`}
        />
      </div>

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

      <div className="grid gap-4 sm:grid-cols-3">
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

      <Submit label={labels.watermarkSave} />
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="md" pending={pending}>
      {label}
    </Button>
  );
}
