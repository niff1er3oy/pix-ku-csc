"use client";

import { Button } from "@/components/ui/button";
import { DownloadIcon } from "@/components/ui/icon";

/**
 * Downloads whatever list of hrefs it's handed — every photo on the current
 * page, or just the ones a caller has checked; this has no notion of "all"
 * versus "selected" itself, only the array it was given.
 *
 * No zip, no new route: each href is the same per-photo
 * `/api/media/...?download=1` link its own thumbnail already uses, fired
 * with a delay between each — the identical technique `DeletePhotosForm`'s
 * own "download selected" uses in the studio, and for the same reason: a
 * route that is already correctly authorized and watermark-aware beats
 * standing up a second way to read a photo off disk. The stagger exists
 * because Chrome silently blocks a burst of automatic downloads fired in
 * the same tick — spaced out, each one lands as an ordinary user-triggered
 * download instead.
 */
export function DownloadAllButton({
  hrefs,
  label,
  disabled = false,
  variant = "secondary",
}: {
  hrefs: string[];
  label: string;
  disabled?: boolean;
  variant?: "secondary" | "primary";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      disabled={disabled || hrefs.length === 0}
      onClick={() => {
        hrefs.forEach((href, index) => {
          window.setTimeout(() => {
            const link = document.createElement("a");
            link.href = href;
            link.download = "";
            document.body.appendChild(link);
            link.click();
            link.remove();
          }, index * 400);
        });
      }}
    >
      <DownloadIcon size={16} />
      {label}
    </Button>
  );
}
