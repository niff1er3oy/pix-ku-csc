"use client";

import { useEffect, useState } from "react";

import { CheckIcon, CopyIcon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * Copies the event link next to it — the fastest way to get it into a LINE
 * or Facebook group post, which PRODUCT.md names as a real distribution
 * path alongside the printed QR.
 *
 * `navigator.clipboard` can throw (permissions denied, an insecure context,
 * an older browser) — caught and swallowed rather than shown as an error,
 * since the link is already selectable text right next to this button. A
 * copy button that occasionally fails silently and leaves the fallback
 * intact is better than one that interrupts with an error over something
 * this recoverable.
 */
export function CopyLinkButton({
  value,
  label,
  copiedLabel,
}: {
  value: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value).then(
          () => setCopied(true),
          () => {},
        );
      }}
      className={cn(
        "inline-flex h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-4 text-sm font-medium transition-colors duration-200",
        copied
          ? "bg-green-50 text-green-700"
          : "bg-paper text-slate ring-1 ring-inset ring-edge hover:bg-green-50 hover:text-green-700",
      )}
    >
      {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
      {copied ? copiedLabel : label}
    </button>
  );
}
