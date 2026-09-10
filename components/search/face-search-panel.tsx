"use client";

import { animate, createTimeline, stagger, utils } from "animejs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { SearchMatch, SearchResponse } from "@/app/api/events/[id]/search/route";
import { DownloadAllButton } from "@/components/photos/download-all-button";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { SelectAllToggle } from "@/components/photos/select-all-toggle";
import { SelectCheckbox } from "@/components/photos/select-checkbox";
import { Button } from "@/components/ui/button";
import {
  BookmarkIcon,
  CloseIcon,
  DownloadIcon,
  FaceScanIcon,
  SearchIcon,
} from "@/components/ui/icon";
import { savePhotos, unsavePhotos } from "@/lib/actions/saved-photos";
import { usePhotoSelection } from "@/lib/hooks/use-photo-selection";
// Straight from the dictionary module, never from `@/lib/i18n` — that entry
// point reads cookies via `next/headers` and cannot be bundled for the client.
import { t, type Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

type Status = "idle" | "searching" | "done" | "error";

/**
 * Face search, behind a popup rather than its own route — the product still
 * promises thirty seconds from scanning a QR to holding photos, and a
 * navigation step between "here are the photos" and "find mine" buys
 * nothing. The trigger is just a button, sized to sit beside the event
 * name in the page's own header; the popup holds the actual flow — consent,
 * the selfie, the wait, the results — the same split `PhotoUploader` uses
 * for adding photos in the studio.
 */
export function FaceSearchPanel({
  eventId,
  eventSlug,
  dict,
  signedIn,
  savedFaceImagePath,
  watermarked,
  allowDownload,
}: {
  eventId: string;
  eventSlug: string;
  dict: Dictionary;
  signedIn: boolean;
  /** Null when signed out, or signed in with no face saved yet — the saved-
   *  face button still shows either way (the server call is what actually
   *  tells that story), this only decides what illustrates the scan while
   *  it runs. */
  savedFaceImagePath: string | null;
  watermarked: boolean;
  allowDownload: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  // Which results are checked — reset on every fresh search via
  // `setSelectedIds` below.
  const { selectedIds, setSelectedIds, toggleSelect, allSelected, toggleSelectAll } =
    usePhotoSelection(matches.map((m) => m.photoId));
  // Which matches are already saved to `/me` — seeded from the search
  // response (a visitor can have saved a photo from a previous search of
  // this same event) and kept in sync as the bookmark toggle and the bulk
  // "save selected" button act on it.
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
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

  // Scrolling the page behind the popup makes it look stuck rather than on
  // top of it, and Escape is the fastest way out of a modal on a keyboard —
  // see the same note on `PhotoUploader`.
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pick(next: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
    // The checkbox itself disappears once there is no photo left to consent
    // about — clearing a checked box back to hidden, not just unchecked,
    // would leave a stale "yes" sitting behind the scenes for a photo that
    // no longer exists.
    setConsent(false);
    setError(null);
    setStatus("idle");
  }

  async function run(useSavedFace: boolean) {
    // The saved face was already consented to when it was first saved to
    // the profile (see `/me`) — this checkbox is specifically about
    // processing a freshly uploaded selfie, so only that path needs it.
    if (!useSavedFace && !consent) {
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
      setSelectedIds(new Set());
      setSavedIds(new Set(data.matches.filter((m) => m.isSaved).map((m) => m.photoId)));
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

  // What the bulk save button acts on: a selection, if there is one,
  // otherwise every match. Which direction it acts in flips to "unsave"
  // only once every one of those targets is already saved — a mix of saved
  // and unsaved targets, like an empty selection with nothing saved yet,
  // always reads as "save".
  const bulkTargetIds =
    selectedIds.size > 0 ? [...selectedIds] : matches.map((m) => m.photoId);
  const bulkShouldUnsave =
    bulkTargetIds.length > 0 && bulkTargetIds.every((id) => savedIds.has(id));

  // Same fallback as the save button: a selection, if there is one,
  // otherwise every match — "download selected" with nothing checked would
  // otherwise just be a dead button sitting beside a live one.
  const downloadTargets =
    selectedIds.size > 0 ? matches.filter((m) => selectedIds.has(m.photoId)) : matches;

  async function toggleBulkSave() {
    if (bulkTargetIds.length === 0) return;
    const ids = bulkTargetIds;
    const shouldUnsave = bulkShouldUnsave;
    const previous = savedIds;
    setSavedIds((current) => {
      const next = new Set(current);
      if (shouldUnsave) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
    try {
      if (shouldUnsave) await unsavePhotos(ids);
      else await savePhotos(ids);
    } catch {
      setSavedIds(previous);
      setError(dict.search.errorGeneric);
    }
  }

  // The bookmark on each result — optimistic, and reverts to exactly the
  // prior set on failure rather than just flipping the one id back, in case
  // another toggle or `toggleBulkSave` landed in between.
  async function toggleSave(photoId: string) {
    const wasSaved = savedIds.has(photoId);
    const previous = savedIds;
    setSavedIds((current) => {
      const next = new Set(current);
      if (wasSaved) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
    try {
      if (wasSaved) await unsavePhotos([photoId]);
      else await savePhotos([photoId]);
    } catch {
      setSavedIds(previous);
      setError(dict.search.errorGeneric);
    }
  }

  return (
    <>
      <Button size="lg" className="shrink-0" onClick={() => setOpen(true)}>
        <SearchIcon size={20} />
        {dict.event.findMe}
      </Button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="find-me-heading"
            className="modal-backdrop fixed inset-0 z-50 overflow-y-auto bg-ink/90 p-4 sm:p-8"
            onClick={() => setOpen(false)}
          >
            <div className="mx-auto flex min-h-full max-w-4xl items-center py-4">
              <div
                className="modal-content w-full rounded-card bg-paper p-5 shadow-[var(--shadow-lift)] sm:p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 id="find-me-heading" className="text-h2">
                    {dict.search.title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={dict.common.close}
                    className="grid size-11 shrink-0 place-items-center rounded-pill text-slate transition-colors duration-200 hover:bg-cloud"
                  >
                    <CloseIcon size={20} />
                  </button>
                </div>

                <div className="mx-auto mt-5 max-w-2xl">
                  {/* --- Saved face, for people who already have one — first,
                      since it needs no consent step and no upload: one click
                      and it is already running. --------------------------- */}
                  {signedIn && (
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-card bg-green-50 p-5">
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
                  <div className={cn("rounded-card bg-cloud p-5", signedIn && "mt-4")}>
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
                          className="text-label font-medium text-danger underline underline-offset-4"
                        >
                          {dict.search.uploadCancel}
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

                    <ul className="mt-5 grid gap-1.5 text-caption text-slate sm:grid-cols-2">
                      {dict.search.tips.map((tip) => (
                        <li key={tip}>· {tip}</li>
                      ))}
                    </ul>
                  </div>

                  {/* --- Consent gate. PDPA requires this before any processing —
                      only shown once there is an actual uploaded photo to
                      consent about, so it reads as gating what happens next
                      rather than a disclaimer nobody has anything to weigh
                      yet. `pick` resets `consent` on clear/retake, so this
                      and the checked state disappear together. */}
                  {preview && (
                    <>
                      <label className="mt-4 flex cursor-pointer gap-3 rounded-card bg-cloud p-5">
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

                      <button
                        type="button"
                        onClick={() => run(false)}
                        disabled={status === "searching" || !file}
                        className="mt-4 h-14 w-full rounded-pill bg-green-600 px-8 font-display text-base font-semibold text-paper shadow-[var(--shadow-pop)] transition-[background-color,transform] duration-200 hover:bg-green-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                      >
                        {status === "searching" ? dict.search.scanning : dict.search.submit}
                      </button>
                    </>
                  )}

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

                  {/* The saved-face path has no freshly picked selfie, but it
                      does have the same saved photo the search itself is
                      about to use — shown here instead of a generic icon, so
                      what's scanning is what's actually running. Falls back
                      to `FaceScanIcon` only for the edge case of a signed-in
                      visitor with no face saved yet clicking anyway; same
                      `scanRef`/`useEffect` above either way, since this and
                      the upload-preview block are never mounted at once. */}
                  {status === "searching" && !preview && (
                    <div
                      ref={scanRef}
                      aria-live="polite"
                      className="mt-4 flex items-center gap-5 rounded-card bg-cloud p-4"
                    >
                      <div className="relative grid size-32 shrink-0 place-items-center overflow-hidden rounded-media bg-paper ring-1 ring-inset ring-edge">
                        {savedFaceImagePath ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/media/${savedFaceImagePath}`}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <FaceScanIcon size={48} className="text-slate" />
                        )}
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

                        {/* "Select all" beside the buttons it feeds, the same
                            pairing `DeletePhotosForm` uses in the studio —
                            the two only make sense together, right before
                            acting on whatever ends up checked. */}
                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          <SelectAllToggle
                            checked={allSelected}
                            onChange={toggleSelectAll}
                            selectLabel={dict.results.selectAll}
                            deselectLabel={dict.results.deselectAll}
                          />

                          {allowDownload && (
                            <DownloadAllButton
                              variant="primary"
                              hrefs={downloadTargets.map(
                                (match) => `/api/media/${match.originalPath}?download=1`,
                              )}
                              label={
                                selectedIds.size > 0
                                  ? dict.results.downloadSelected
                                  : t(dict.results.downloadAll, { count: matches.length })
                              }
                            />
                          )}

                          {signedIn && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={toggleBulkSave}
                              aria-pressed={bulkShouldUnsave}
                              className={
                                bulkShouldUnsave
                                  ? "bg-transparent hover:bg-cloud"
                                  : "bg-lime-500 text-green-950 ring-0 hover:bg-lime-600"
                              }
                            >
                              <BookmarkIcon
                                size={16}
                                // No colour override in the unsave state — the
                                // stroke is `currentColor`, so it inherits the
                                // button's own text colour rather than picking
                                // its own, and the two always match.
                                className={bulkShouldUnsave ? "fill-none" : "fill-green-950"}
                              />
                              {selectedIds.size > 0
                                ? bulkShouldUnsave
                                  ? dict.results.unsaveSelected
                                  : dict.results.saveSelected
                                : bulkShouldUnsave
                                  ? dict.results.unsaveAll
                                  : dict.results.saveAll}
                            </Button>
                          )}
                        </div>

                        <div ref={resultsRef}>
                          <PhotoGallery
                            className="mt-4"
                            variant="card"
                            items={matches.map((match) => ({
                              id: match.photoId,
                              thumbSrc: `/api/media/${match.thumbPath}`,
                              previewSrc: `/api/media/${match.previewPath}`,
                              downloadHref: allowDownload
                                ? `/api/media/${match.originalPath}?download=1`
                                : undefined,
                              className: "bg-green-50",
                              saveAction: signedIn && (
                                // Same real-`<Button>` pairing `deleteAction` uses
                                // beside the download link (`photo-lightbox.tsx`),
                                // just in the house's yellow — this file's colour
                                // for anything about saving — rather than a fixed
                                // variant, since neither `Button` variant is
                                // yellow. This toolbar sits directly on the
                                // lightbox's dark backdrop (no white card behind
                                // it), so the "already saved" state borrows the
                                // same translucent treatment as the close/nav
                                // buttons rather than `secondary`'s paper
                                // background — which read as a confusing green
                                // tint on hover, not the plain cancel it is.
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => toggleSave(match.photoId)}
                                  aria-pressed={savedIds.has(match.photoId)}
                                  className={
                                    savedIds.has(match.photoId)
                                      ? "bg-paper/10 text-paper ring-0 hover:bg-paper/20"
                                      : "bg-lime-500 text-green-950 ring-0 hover:bg-lime-600"
                                  }
                                >
                                  <BookmarkIcon
                                    size={16}
                                    className={savedIds.has(match.photoId) ? "fill-none" : "fill-green-950"}
                                  />
                                  {savedIds.has(match.photoId)
                                    ? dict.common.cancel
                                    : dict.common.save}
                                </Button>
                              ),
                              // Hidden until something is picked — an empty
                              // result grid full of checkboxes nobody has
                              // used yet is more clutter than affordance.
                              // Holding a photo (`onLongPress` below) is what
                              // starts a selection from nothing; once one
                              // exists, every checkbox reappears for the
                              // ordinary tap-to-add-more flow.
                              select: selectedIds.size > 0 && (
                                <SelectCheckbox
                                  checked={selectedIds.has(match.photoId)}
                                  onChange={() => toggleSelect(match.photoId)}
                                  ariaLabel={t(dict.results.match, {
                                    percent: Math.round(match.similarity),
                                  })}
                                />
                              ),
                              onLongPress: () => toggleSelect(match.photoId),
                              footer: (
                                <div className="flex items-center justify-between gap-2 p-3">
                                  <span className="tnum text-caption font-medium text-green-700">
                                    {t(dict.results.match, {
                                      percent: Math.round(match.similarity),
                                    })}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {signedIn && (
                                      <button
                                        type="button"
                                        onClick={() => toggleSave(match.photoId)}
                                        aria-pressed={savedIds.has(match.photoId)}
                                        aria-label={
                                          savedIds.has(match.photoId)
                                            ? dict.results.saved
                                            : dict.results.save
                                        }
                                        className="grid size-7 shrink-0 place-items-center rounded-pill"
                                      >
                                        <BookmarkIcon
                                          size={18}
                                          className={cn(
                                            "transition-colors duration-200",
                                            savedIds.has(match.photoId)
                                              ? "fill-lime-500 text-lime-700 hover:fill-lime-600 hover:text-lime-800"
                                              : "fill-none text-slate hover:text-green-700",
                                          )}
                                        />
                                      </button>
                                    )}
                                    {allowDownload && (
                                      <a
                                        href={`/api/media/${match.originalPath}?download=1`}
                                        aria-label={dict.results.downloadOne}
                                        className="grid size-7 shrink-0 place-items-center rounded-pill text-slate transition-colors duration-200 hover:text-green-700"
                                      >
                                        <DownloadIcon size={18} />
                                      </a>
                                    )}
                                  </div>
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
            </div>
          </div>,
          document.body,
        )}
    </>
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
