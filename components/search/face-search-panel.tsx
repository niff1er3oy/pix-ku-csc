"use client";

import { animate, createTimeline, stagger, utils } from "animejs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { SearchMatch, SearchResponse } from "@/app/api/events/[id]/search/route";
import { PhotoGallery } from "@/components/photos/photo-gallery";
// Straight from the dictionary module, never from `@/lib/i18n` — that entry
// point reads cookies via `next/headers` and cannot be bundled for the client.
import { t, type Dictionary } from "@/lib/i18n/dictionaries";

type Status = "idle" | "searching" | "done" | "error";

/**
 * Face search, inline on the event page rather than behind its own route.
 * The product promises thirty seconds from scanning a QR to holding photos,
 * and a navigation step between "here are the photos" and "find mine" buys
 * nothing.
 */
export function FaceSearchPanel({
  eventId,
  eventSlug,
  dict,
  signedIn,
  watermarked,
  allowDownload,
}: {
  eventId: string;
  eventSlug: string;
  dict: Dictionary;
  signedIn: boolean;
  watermarked: boolean;
  allowDownload: boolean;
}) {
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  /**
   * The waiting state, driven by anime.js rather than CSS.
   *
   * This is the one moment in the product where the timing is genuinely
   * unknown — Rekognition answers when it answers — so the loop has to run
   * until a network response arrives and stop cleanly on any outcome. A CSS
   * keyframe cannot be cancelled mid-cycle without a visible snap.
   */
  useEffect(() => {
    if (status !== "searching") return;
    const root = scanRef.current;
    if (!root || prefersReducedMotion()) return;

    const line = root.querySelector<HTMLElement>("[data-scan-line]");
    const frame = root.querySelector<HTMLElement>("[data-scan-frame]");
    if (!line || !frame) return;

    const timeline = createTimeline({ loop: true })
      .add(line, { y: ["-120%", "820%"], duration: 1200, ease: "inOutQuad" }, 0)
      .add(
        frame,
        { opacity: [0.3, 1], scale: [1.08, 1], duration: 600, ease: "out(3)" },
        0,
      )
      .add(frame, { opacity: 0.3, scale: 1.08, duration: 600, ease: "in(3)" }, 600);

    return () => {
      // `revert()` also restores the inline styles it wrote, so the frame and
      // line go back to their authored state rather than freezing mid-loop.
      timeline.revert();
    };
  }, [status]);

  /**
   * Matches arrive all at once from one response, so they are staggered in on
   * the client — the server has no idea how many there will be, which is the
   * kind of count a CSS nth-child ladder cannot cover.
   */
  useEffect(() => {
    if (status !== "done" || matches.length === 0) return;
    const root = resultsRef.current;
    if (!root || prefersReducedMotion()) return;

    const items = root.querySelectorAll("li");
    // Set the start state in the same tick so nothing paints at full opacity
    // and then snaps back to zero.
    utils.set(items, { opacity: 0, y: 14, scale: 0.97 });

    animate(items, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 420,
      delay: stagger(45),
      ease: "out(3)",
    });
  }, [status, matches.length]);

  function pick(next: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
    setError(null);
    setStatus("idle");
  }

  async function run(useSavedFace: boolean) {
    if (!consent) {
      setError(dict.search.consentRequired);
      return;
    }
    if (!useSavedFace && !file) {
      setError(dict.search.errorGeneric);
      return;
    }

    setStatus("searching");
    setError(null);

    const body = new FormData();
    body.set("consent", "1");
    if (useSavedFace) body.set("useSavedFace", "1");
    else if (file) body.set("selfie", file);

    try {
      const response = await fetch(`/api/events/${eventId}/search`, {
        method: "POST",
        body,
      });
      const data: SearchResponse = await response.json();

      if (!data.ok) {
        setError(messageFor(data.error, dict));
        setStatus("error");
        return;
      }

      setMatches(data.matches);
      setStatus("done");
      // The selfie has done its job; drop the local copy too.
      if (!useSavedFace) pickCleanup();
    } catch {
      setError(dict.search.errorGeneric);
      setStatus("error");
    }
  }

  function pickCleanup() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section
      id="find-me"
      className="border-b border-edge bg-paper"
      aria-labelledby="find-me-heading"
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <h2 id="find-me-heading" className="text-h2">
            {dict.search.title}
          </h2>
          <p className="mt-3 text-body-lg text-slate">{dict.search.lede}</p>

          {/* --- Consent gate. PDPA requires this before any processing. --- */}
          <label className="mt-8 flex cursor-pointer gap-3 rounded-card bg-cloud p-5">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => {
                setConsent(event.target.checked);
                if (event.target.checked) setError(null);
              }}
              className="mt-1 size-5 shrink-0 accent-[var(--color-green-600)]"
            />
            <span className="text-label leading-relaxed text-ink">
              {dict.search.consentLabel}{" "}
              <Link
                href="/privacy"
                className="font-medium text-green-700 underline underline-offset-4"
              >
                {dict.search.consentReadPolicy}
              </Link>
            </span>
          </label>

          {/* --- Saved face, for people who already have one --------------- */}
          {signedIn && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-card bg-green-50 p-5">
              <div>
                <p className="font-display text-h3">
                  {dict.search.savedFaceTitle}
                </p>
                <p className="mt-1 text-label text-slate">
                  {dict.search.savedFaceBody}
                </p>
              </div>
              <button
                type="button"
                onClick={() => run(true)}
                disabled={status === "searching"}
                className="h-[46px] shrink-0 rounded-pill bg-green-600 px-6 font-display text-[0.9375rem] font-semibold text-paper transition-[background-color,transform] duration-200 hover:bg-green-700 active:scale-[0.98] disabled:opacity-60"
              >
                {dict.search.savedFaceCta}
              </button>
            </div>
          )}

          {/* --- Upload ---------------------------------------------------- */}
          <div className="mt-4 rounded-card bg-cloud p-5">
            <p className="font-display text-h3">{dict.search.uploadTitle}</p>
            <p className="mt-1 text-label text-slate">
              {dict.search.uploadBody}
            </p>

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="user"
              onChange={(event) => pick(event.target.files?.[0] ?? null)}
              className="mt-4 block w-full text-label text-slate file:mr-4 file:h-[46px] file:cursor-pointer file:rounded-pill file:border-0 file:bg-green-600 file:px-6 file:font-display file:text-[0.9375rem] file:font-semibold file:text-paper hover:file:bg-green-700"
            />

            {preview && status !== "searching" && (
              <div className="mt-4 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt=""
                  className="size-20 rounded-media object-cover"
                />
                <button
                  type="button"
                  onClick={() => pick(null)}
                  className="text-label font-medium text-green-700 underline underline-offset-4"
                >
                  {dict.search.uploadRetake}
                </button>
              </div>
            )}

            {/* The selfie grows and gets scanned while the match runs. Showing
                the work is what makes a few seconds of waiting feel like the
                product doing something rather than the page hanging. */}
            {preview && status === "searching" && (
              <div
                ref={scanRef}
                className="mt-4 flex items-center gap-5 rounded-card bg-paper p-4"
              >
                <div className="relative size-32 shrink-0 overflow-hidden rounded-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <div
                    data-scan-frame
                    aria-hidden
                    className="absolute inset-[14%] rounded-[6px] ring-2 ring-lime-300"
                  />
                  <div
                    data-scan-line
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-3"
                    style={{
                      background:
                        "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--color-lime-300) 70%, transparent), transparent)",
                    }}
                  />
                </div>
                <div>
                  <p className="font-display text-h3">{dict.search.scanning}</p>
                  <p className="mt-1 text-label text-slate">
                    {dict.search.scanningBody}
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => run(false)}
              disabled={status === "searching" || !file}
              className="mt-5 h-14 w-full rounded-pill bg-green-600 px-8 font-display text-base font-semibold text-paper shadow-[var(--shadow-pop)] transition-[background-color,transform] duration-200 hover:bg-green-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {status === "searching" ? dict.search.scanning : dict.search.submit}
            </button>

            <ul className="mt-5 grid gap-1.5 text-caption text-slate sm:grid-cols-2">
              {dict.search.tips.map((tip) => (
                <li key={tip}>· {tip}</li>
              ))}
            </ul>
          </div>

          {!signedIn && (
            <p className="mt-4 text-label text-slate">
              <strong className="font-semibold text-ink">
                {dict.search.signInPrompt}
              </strong>{" "}
              {dict.search.signInPromptBody}{" "}
              <Link
                href={`/signin?next=/e/${eventSlug}`}
                className="font-medium text-green-700 underline underline-offset-4"
              >
                {dict.nav.signIn}
              </Link>
            </p>
          )}

          {error && (
            <p role="alert" className="mt-4 text-label text-danger">
              {error}
            </p>
          )}

          {/* The saved-face path has no preview to scan, so it still needs a
              plain progress line. `aria-live` covers both routes for anyone
              who is not watching the animation. */}
          {status === "searching" && !preview && (
            <p aria-live="polite" className="mt-4 text-label text-slate">
              {dict.search.scanning} · {dict.search.scanningBody}
            </p>
          )}
        </div>

        {/* --- Results --------------------------------------------------- */}
        {status === "done" && (
          <div className="mt-12" aria-live="polite">
            <h3 className="text-h2">
              {matches.length === 0
                ? dict.results.titleZero
                : t(dict.results.title, { count: matches.length })}
            </h3>

            {matches.length === 0 ? (
              <p className="mt-3 max-w-2xl text-body text-slate">
                {dict.results.zeroBody}
              </p>
            ) : (
              <>
                {watermarked && (
                  <p className="mt-3 text-label text-slate">
                    {dict.results.watermarkNote}
                  </p>
                )}
                <div ref={resultsRef}>
                  <PhotoGallery
                    className="mt-6"
                    variant="card"
                    items={matches.map((match) => ({
                      id: match.photoId,
                      thumbSrc: `/api/media/${match.thumbPath}`,
                      previewSrc: `/api/media/${match.previewPath}`,
                      downloadHref: allowDownload
                        ? `/api/media/${match.originalPath}?download=1`
                        : undefined,
                      footer: (
                        <div className="flex items-center justify-between gap-2 p-3">
                          <span className="tnum text-caption font-medium text-green-700">
                            {t(dict.results.match, {
                              percent: Math.round(match.similarity),
                            })}
                          </span>
                          {allowDownload && (
                            <a
                              href={`/api/media/${match.originalPath}?download=1`}
                              className="text-caption font-semibold text-green-700 underline underline-offset-4"
                            >
                              {dict.results.downloadOne}
                            </a>
                          )}
                        </div>
                      ),
                    }))}
                    labels={{
                      close: dict.common.close,
                      previous: dict.common.back,
                      next: dict.common.next,
                      download: dict.results.downloadOne,
                    }}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * anime.js has no opinion about motion preferences, so every animation in this
 * file checks first. Skipping is always safe here: nothing is animated from a
 * hidden state, so refusing to animate leaves the finished layout on screen.
 */
function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function messageFor(code: string, dict: Dictionary): string {
  switch (code) {
    case "no_face":
      return dict.search.errorNoFace;
    case "many_faces":
      return dict.search.errorManyFaces;
    case "too_large":
      return dict.search.errorTooLarge;
    case "bad_format":
      return dict.search.errorBadFormat;
    case "rate_limited":
      return dict.search.errorRateLimited;
    case "consent_required":
      return dict.search.consentRequired;
    case "no_saved_face":
      return dict.search.errorNoSavedFace;
    default:
      return dict.search.errorGeneric;
  }
}
