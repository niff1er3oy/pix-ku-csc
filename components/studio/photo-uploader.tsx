"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  AlertIcon,
  CheckIcon,
  CloseIcon,
  PhotoIcon,
  UploadIcon,
} from "@/components/ui/icon";
import type {
  UploadFailure,
  UploadResult,
} from "@/app/api/studio/events/[id]/photos/route";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * How many uploads are in flight at once.
 *
 * The server side of each request is cheap now — it writes the original file
 * and returns; `processPhoto` builds derivatives and indexes faces afterward,
 * in the background (see `app/api/studio/events/[id]/photos/route.ts`) — so
 * this is really only about the upload itself. Not one: a single stream
 * leaves the connection idle between requests, and 400 photos would take all
 * afternoon. Not twenty either: a phone on venue wifi has one uplink to share
 * between them, and every request still holds a full file buffer in memory
 * for the length of its own upload. Three keeps the pipe busy without either
 * end thrashing.
 */
const CONCURRENCY = 3;

type Staged = {
  /** Stable across re-renders, so removing one does not re-key the rest. */
  key: string;
  file: File;
  previewUrl: string;
  selected: boolean;
  status: "staged" | "uploading" | "done" | "duplicate" | "failed";
  reason?: UploadFailure;
};

/**
 * Pick files, check the list, then upload — behind one button.
 *
 * A collapsed trigger rather than a dropzone sitting permanently on the page:
 * adding more photos is the least frequent thing a photographer does here on
 * any given visit — most visits are to check on indexing, glance at
 * searches, or manage photos already there — so it earns a button beside the
 * photo grid's own heading, not a quarter of the page's height above it.
 *
 * **Nothing is sent until the photographer confirms**, and that is the point of
 * the staging list. Picking a folder on a phone is a blunt instrument — it
 * takes the whole roll, including the frames with somebody's eyes shut and the
 * accidental shot of the floor. Uploading on selection means the only way to
 * undo a mistake is to delete from the event afterwards, by which point the
 * file is on the server and in the database. Staging makes the fix free.
 *
 * Files can be dropped one at a time or in bulk with the checkboxes, which is
 * the difference between removing four frames and removing forty — and all
 * staged state lives in this component, not the popup, so closing the popup
 * mid-upload does not lose progress: the queue keeps running, and reopening
 * shows exactly where it got to.
 */
export function PhotoUploader({
  eventId,
  labels,
  closeLabel,
}: {
  eventId: string;
  labels: Dictionary["studio"];
  closeLabel: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Staged[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Object URLs pin their whole file in memory until revoked, and these are
  // photographs — a hundred staged frames is a hundred files held open.
  useEffect(
    () => () => {
      for (const item of items) URL.revokeObjectURL(item.previewUrl);
    },
    // Intentionally on unmount only; per-item revocation happens on removal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Scrolling the page behind the popup makes it look stuck rather than on
  // top of it, and Escape is the fastest way out of a modal on a keyboard.
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

  const pending = items.filter((i) => i.status === "staged");
  const selected = items.filter((i) => i.selected && i.status === "staged");
  const failed = items.filter((i) => i.status === "failed");
  const finished = items.filter(
    (i) => i.status === "done" || i.status === "duplicate",
  );

  const patch = (key: string, next: Partial<Staged>) =>
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...next } : item)),
    );

  const add = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Snapshotted now, not read inside the `setItems` updater below. The
    // updater runs after this whole handler returns — including the
    // `event.target.value = ""` two lines below wherever `add` is called
    // from — and clearing an <input type="file"> empties the very
    // `FileList` object already captured here, not just future reads of
    // `.files`. Reading `files` lazily inside the updater meant a second
    // pick, made after the input had already been reset once, silently
    // evaporated: React (in development) even caught this directly, since
    // Strict Mode's double-invoke of the updater showed the file count
    // disagreeing between the two calls.
    const incoming = Array.from(files);

    setItems((current) => {
      // Picking the same folder twice is common — the photographer is not sure
      // whether the first pick registered. Matching on name+size+mtime keeps
      // the list honest without hashing megabytes in the browser.
      const seen = new Set(
        current.map((i) => `${i.file.name}:${i.file.size}:${i.file.lastModified}`),
      );

      const fresh = incoming
        .filter(
          (file) => !seen.has(`${file.name}:${file.size}:${file.lastModified}`),
        )
        .map((file, index) => ({
          key: `${file.name}:${file.size}:${file.lastModified}:${index}`,
          file,
          previewUrl: URL.createObjectURL(file),
          selected: false,
          status: "staged" as const,
        }));

      return [...current, ...fresh];
    });
  };

  const remove = (keys: string[]) => {
    const drop = new Set(keys);
    setItems((current) => {
      for (const item of current) {
        if (drop.has(item.key)) URL.revokeObjectURL(item.previewUrl);
      }
      return current.filter((item) => !drop.has(item.key));
    });
  };

  const uploadOne = async (item: Staged) => {
    patch(item.key, { status: "uploading" });

    const body = new FormData();
    body.append("file", item.file);

    try {
      const response = await fetch(`/api/studio/events/${eventId}/photos`, {
        method: "POST",
        body,
      });
      const result = (await response.json()) as UploadResult;

      patch(
        item.key,
        result.ok
          ? { status: result.duplicate ? "duplicate" : "done" }
          : { status: "failed", reason: result.reason },
      );
    } catch {
      // A dropped connection mid-upload. Retryable, and named as such rather
      // than swallowed into a generic failure.
      patch(item.key, { status: "failed", reason: "server" });
    }
  };

  /**
   * Runs a queue with a fixed number of workers pulling from one cursor.
   *
   * Not chunks of three: with chunks, one slow frame on a bad connection
   * stalls the two that finished beside it until it lands. A shared cursor
   * keeps every slot busy.
   */
  const run = async (queue: Staged[]) => {
    if (queue.length === 0) return;
    setBusy(true);

    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) await uploadOne(queue[cursor++]);
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker),
    );

    setBusy(false);
    // The photo count, the grid and the indexing figures all live on the
    // server; refreshing is what makes them agree with what just happened.
    router.refresh();
  };

  const reason = (r?: UploadFailure) =>
    r === "too_large"
      ? labels.uploadErrorTooLarge
      : r === "bad_format"
        ? labels.uploadErrorBadFormat
        : r === "unreadable"
          ? labels.uploadErrorUnreadable
          : labels.uploadErrorServer;

  const allSelected = pending.length > 0 && selected.length === pending.length;
  const allDone = items.length > 0 && pending.length === 0 && failed.length === 0;

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <UploadIcon size={16} />
        {labels.uploadTitle}
      </Button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-popup-title"
            className="modal-backdrop fixed inset-0 z-50 overflow-y-auto bg-ink/90 p-4 sm:p-8"
            onClick={() => setOpen(false)}
          >
            <div className="mx-auto flex min-h-full max-w-2xl items-center py-4">
              <div
                className="modal-content w-full rounded-card bg-paper p-5 shadow-[var(--shadow-lift)] sm:p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3
                      id="upload-popup-title"
                      className="text-h3 font-semibold text-ink"
                    >
                      {labels.uploadTitle}
                    </h3>
                    <p className="mt-1 text-caption text-slate">
                      {labels.uploadHint}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={closeLabel}
                    className="grid size-11 shrink-0 place-items-center rounded-pill text-slate transition-colors duration-200 hover:bg-cloud"
                  >
                    <CloseIcon size={20} />
                  </button>
                </div>

                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    add(event.dataTransfer.files);
                  }}
                  className={cn(
                    "mt-5 rounded-card border border-dashed px-6 py-10 text-center transition-colors duration-200",
                    dragging ? "border-green-600 bg-green-50" : "border-edge bg-cloud",
                  )}
                >
                  <PhotoIcon size={32} className="mx-auto text-slate" />
                  <p className="mt-3 text-body font-medium text-ink">
                    {labels.uploadDrop}
                  </p>

                  <input
                    ref={input}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      add(event.target.files);
                      // Cleared so picking the same folder twice fires `change` again.
                      event.target.value = "";
                    }}
                    className="sr-only"
                  />

                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="mt-5"
                    onClick={() => input.current?.click()}
                  >
                    {labels.uploadCta}
                  </Button>
                </div>

                {items.length > 0 && (
                  <div className="mt-5 rounded-card ring-1 ring-edge">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge p-4">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        {pending.length > 0 && (
                          <label className="flex min-h-11 items-center gap-2 text-label text-ink">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={(event) =>
                                setItems((current) =>
                                  current.map((item) =>
                                    item.status === "staged"
                                      ? { ...item, selected: event.target.checked }
                                      : item,
                                  ),
                                )
                              }
                              className="size-5 rounded-[6px] accent-green-600"
                            />
                            {labels.uploadSelectAll}
                          </label>
                        )}

                        <p className="tnum text-label text-slate">
                          {t(labels.uploadStaged, {
                            count: String(pending.length),
                          })}
                          {finished.length > 0 &&
                            ` · ${t(labels.uploadDone, {
                              done: String(finished.length),
                              total: String(finished.length + failed.length),
                            })}`}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {selected.length > 0 && !busy && (
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => remove(selected.map((i) => i.key))}
                          >
                            <CloseIcon size={16} />
                            {t(labels.uploadRemoveSelected, {
                              count: String(selected.length),
                            })}
                          </Button>
                        )}

                        {pending.length > 0 && !busy && (
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => remove(pending.map((i) => i.key))}
                          >
                            <CloseIcon size={16} />
                            {labels.uploadRemoveAll}
                          </Button>
                        )}
                      </div>
                    </div>

                    <ul className="max-h-72 divide-y divide-edge overflow-y-auto">
                      {items.map((item) => (
                        <li key={item.key} className="flex items-center gap-3 p-3">
                          {item.status === "staged" ? (
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(event) =>
                                patch(item.key, { selected: event.target.checked })
                              }
                              aria-label={item.file.name}
                              className="size-5 shrink-0 rounded-[6px] accent-green-600"
                            />
                          ) : (
                            <span className="grid size-5 shrink-0 place-items-center">
                              {item.status === "failed" ? (
                                <AlertIcon size={16} className="text-danger" />
                              ) : item.status === "uploading" ? (
                                <span className="size-2 rounded-pill bg-lime-500" />
                              ) : (
                                <CheckIcon size={16} className="text-green-700" />
                              )}
                            </span>
                          )}

                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.previewUrl}
                            alt=""
                            className={cn(
                              "size-12 shrink-0 rounded-field object-cover ring-1 ring-edge",
                              item.status === "done" || item.status === "duplicate"
                                ? "opacity-50"
                                : "",
                            )}
                          />

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-label text-ink">
                              {item.file.name}
                            </p>
                            <p className="tnum text-caption text-slate">
                              {formatSize(item.file.size)}
                              {item.status === "duplicate" &&
                                ` · ${labels.uploadDuplicate}`}
                              {item.status === "failed" && (
                                <span className="text-danger">
                                  {" "}
                                  · {reason(item.reason)}
                                </span>
                              )}
                            </p>
                          </div>

                          {item.status === "staged" && !busy && (
                            <button
                              type="button"
                              onClick={() => remove([item.key])}
                              aria-label={`${labels.uploadRemoveOne} ${item.file.name}`}
                              className="grid size-11 shrink-0 place-items-center rounded-pill text-danger transition-colors duration-200 hover:bg-danger/10"
                            >
                              <CloseIcon size={18} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {allDone && (
                  <p className="mt-5 text-label font-medium text-green-700">
                    {labels.uploadComplete}
                  </p>
                )}

                {(pending.length > 0 || failed.length > 0) && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {pending.length > 0 && (
                      <Button
                        type="button"
                        size="md"
                        pending={busy}
                        onClick={() => void run(pending)}
                      >
                        {t(labels.uploadConfirm, { count: String(pending.length) })}
                      </Button>
                    )}

                    {failed.length > 0 && !busy && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={() =>
                          void run(
                            failed.map((item) => ({ ...item, status: "staged" as const })),
                          )
                        }
                      >
                        {labels.uploadRetry}
                      </Button>
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

/** Bytes as a person would say them. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
