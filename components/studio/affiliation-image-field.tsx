"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { UploadIcon, UsersIcon } from "@/components/ui/icon";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * The affiliation's own picture, with a preview of what was picked — the
 * same shape `CoverField` uses for an event's cover, just circular and
 * without the "clear" option: an affiliation always has *some* picture once
 * one is set, there is no bare state this needs a way back to short of
 * choosing a different file.
 *
 * `currentPath`, when given, is what the settings popup shows before anyone
 * touches the field — the picture the affiliation already has, not an empty
 * circle. `URL.createObjectURL` is revoked on replacement and on unmount for
 * the same reason `CoverField`'s is: an object URL pins the file in memory
 * until it is.
 */
export function AffiliationImageField({
  dict,
  currentPath,
}: {
  dict: Dictionary;
  currentPath: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const choose = (file: File | null) => {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  const shown = preview ?? (currentPath ? `/api/media/${currentPath}` : null);

  return (
    <div>
      <label htmlFor="affiliation-image" className="block text-label font-medium text-ink">
        {dict.affiliationStudio.imageLabel}
      </label>

      <div className="mt-1.5 flex flex-wrap items-center gap-4">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-pill bg-cloud ring-2 ring-green-100">
          {shown ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <UsersIcon size={24} className="text-slate" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <input
            ref={input}
            id="affiliation-image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => choose(event.target.files?.[0] ?? null)}
            className="sr-only"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => input.current?.click()}
          >
            <UploadIcon size={16} />
            {dict.affiliationStudio.imageChoose}
          </Button>
          <p className="mt-2 text-caption text-slate">{dict.affiliationStudio.imageHint}</p>
        </div>
      </div>
    </div>
  );
}
