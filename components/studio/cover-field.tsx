"use client";

import { useEffect, useRef, useState } from "react";

import { CloseIcon, PhotoIcon } from "@/components/ui/icon";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * The event cover, with a preview of what was picked.
 *
 * The preview matters more than it looks: a file input reports "cover.jpg"
 * and nothing else, and a photographer with forty near-identical frames on a
 * phone has no way to tell from that whether they grabbed the right one.
 * Showing it is the difference between choosing and guessing.
 *
 * `currentPath`, when given, is what the settings form shows before anyone
 * touches the field — the cover already on the event, not an empty box. A
 * newly chosen file replaces that preview; clearing it falls back to the
 * current cover rather than to nothing, since clearing the file input does
 * not mean "delete the cover," only "never mind that new one."
 *
 * `URL.createObjectURL` is revoked on replacement and on unmount — an object
 * URL pins the whole file in memory until it is, and these are photographs.
 */
export function CoverField({
  labels,
  currentPath = null,
}: {
  labels: Dictionary["studio"];
  currentPath?: string | null;
}) {
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

  const shown = preview ?? (currentPath ? `/api/media/${currentPath}` : null);

  return (
    <div>
      <label htmlFor="cover" className="block text-label font-medium text-ink">
        {labels.formCover}
      </label>

      <div className="mt-1.5 flex flex-wrap items-start gap-4">
        <div className="grid h-24 w-32 shrink-0 place-items-center overflow-hidden rounded-field bg-cloud ring-1 ring-inset ring-edge">
          {shown ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={shown} alt="" className="h-full w-full object-cover" />
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
