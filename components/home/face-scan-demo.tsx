import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { DemoPhoto } from "@/lib/demo-photos";

/** Each photo owns a 5s slot of the shared 15s loop (see globals.css). */
const SLOT_SECONDS = 5;
/** Where the sweep starts and how long it takes to cross, within a slot. */
const SWEEP_START = 0.45;
const SWEEP_DURATION = 1.9;

/**
 * The first viewport's argument, made rather than stated: event photographs
 * with a scan line crossing them and detection boxes snapping onto every face
 * it passes, then one box resolving to "you". A visitor understands what this
 * site does before reading a word.
 *
 * Pure CSS on one shared timeline — no JavaScript, so it survives a failed
 * hydration, and `prefers-reduced-motion` freezes it on the first photo with
 * every box already found rather than hiding the demonstration.
 *
 * These files live in /public rather than behind /api/media on purpose: they
 * are marketing assets, not event photographs, so the authorization rule in
 * DESIGN.md §7 does not apply to them.
 */
export function FaceScanDemo({
  photos,
  dict,
}: {
  photos: DemoPhoto[];
  dict: Dictionary;
}) {
  if (photos.length === 0) return null;

  return (
    <figure>
      <div className="relative aspect-[3/2] overflow-hidden rounded-card bg-green-100 shadow-[var(--shadow-lift)]">
        {photos.map((photo, index) => (
          <div
            key={photo.src}
            className="scan-card absolute inset-0"
            style={{ animationDelay: `${index * SLOT_SECONDS}s` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.src}
              alt={index === 0 ? dict.home.demoAlt : ""}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
              className="h-full w-full object-cover"
            />

            {/* Sweep */}
            <div
              aria-hidden
              className="scan-line absolute inset-x-0 h-[14%]"
              style={{
                animationDelay: `${index * SLOT_SECONDS}s`,
                background:
                  "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--color-lime-300) 45%, transparent), transparent)",
              }}
            />

            {photo.faces.map((face, faceIndex) => {
              // A box appears exactly as the line reaches its own height, so
              // the sweep looks like it is doing the finding.
              const delay =
                index * SLOT_SECONDS +
                SWEEP_START +
                (face.y / 100) * SWEEP_DURATION;

              return (
                <div
                  key={faceIndex}
                  aria-hidden
                  className="scan-box absolute rounded-[4px] ring-2 ring-paper/90"
                  style={{
                    left: `${face.x}%`,
                    top: `${face.y}%`,
                    width: `${face.w}%`,
                    height: `${face.h}%`,
                    animationDelay: `${delay}s`,
                  }}
                />
              );
            })}

            {/* The match lands a beat after the sweep completes. */}
            {photo.faces
              .filter((face) => face.you)
              .map((face, faceIndex) => (
                <div
                  key={`you-${faceIndex}`}
                  aria-hidden
                  className="scan-match absolute rounded-[4px] ring-[3px] ring-lime-300"
                  style={{
                    left: `${face.x - 0.6}%`,
                    top: `${face.y - 0.9}%`,
                    width: `${face.w + 1.2}%`,
                    height: `${face.h + 1.8}%`,
                    animationDelay: `${index * SLOT_SECONDS}s`,
                    boxShadow: "0 0 0 9999px rgb(1 33 31 / 0.34)",
                  }}
                >
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-pill bg-lime-300 px-2 py-0.5 text-[0.625rem] font-semibold text-green-950">
                    {dict.home.demoMatch}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>

      {/* Required by DESIGN.md §10: demonstration material is labelled as
          demonstration material, never presented as real system output. */}
      <figcaption className="mt-3 text-caption text-slate">
        {dict.home.demoCaption}
      </figcaption>
    </figure>
  );
}
