"use client";

import { useTransition } from "react";

import { setLocale } from "@/lib/actions/locale";
import type { Locale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({
  locale,
  label,
  className,
}: {
  locale: Locale;
  /** Already the *other* language's own name, e.g. "English" when on Thai. */
  label: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const next: Locale = locale === "th" ? "en" : "th";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setLocale(next))}
      className={cn(
        "rounded-pill px-3 py-2 text-sm font-medium text-slate transition-colors duration-200 hover:bg-cloud hover:text-green-700 disabled:opacity-50",
        className,
      )}
      lang={next}
    >
      {label}
    </button>
  );
}
