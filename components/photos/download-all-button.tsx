"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DownloadIcon } from "@/components/ui/icon";
import { type Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Downloads whatever list of storage paths it's handed — every photo on the
 * current page, or just the ones a caller has checked; this has no notion of
 * "all" versus "selected" itself, only the array it was given.
 *
 * One path splits into two different downloads, per how many there are:
 *
 *  - **Exactly one** clicks the same per-photo `/api/media/...?download=1`
 *    link its own thumbnail already uses — already correctly authorized and
 *    watermark-aware, so there is no reason to route a single file through
 *    the zip endpoint at all.
 *  - **More than one** posts the whole list to `/api/media/zip`, which
 *    authorizes and watermarks each one server-side the same way and streams
 *    one zip back — not a burst of separate browser downloads. That used to
 *    be simulated client-side with a staggered `<a>` click per file (Chrome
 *    silently blocks a burst of automatic downloads fired in the same tick),
 *    which worked but left a visitor with fifty separate files to gather up
 *    afterward instead of one archive.
 */
export function DownloadAllButton({
  paths,
  label,
  dict,
  disabled = false,
  variant = "secondary",
}: {
  paths: string[];
  label: string;
  dict: Dictionary;
  disabled?: boolean;
  variant?: "secondary" | "primary";
}) {
  const [zipping, setZipping] = useState(false);
  const [error, setError] = useState(false);

  const downloadZip = async () => {
    setZipping(true);
    setError(false);
    try {
      const response = await fetch("/api/media/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      });
      if (!response.ok) throw new Error(`zip request failed: ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "photos.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(true);
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        type="button"
        variant={variant}
        size="sm"
        disabled={disabled || paths.length === 0 || zipping}
        pending={zipping}
        onClick={() => {
          if (paths.length <= 1) {
            for (const path of paths) {
              const link = document.createElement("a");
              link.href = `/api/media/${path}?download=1`;
              link.download = "";
              document.body.appendChild(link);
              link.click();
              link.remove();
            }
            return;
          }
          void downloadZip();
        }}
      >
        <DownloadIcon size={16} />
        {zipping ? dict.results.downloading : label}
      </Button>

      {error && (
        <p role="alert" className="text-caption text-danger">
          {dict.results.downloadZipError}
        </p>
      )}
    </div>
  );
}
