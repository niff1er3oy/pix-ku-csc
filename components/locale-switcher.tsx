"use client";

import { useTransition } from "react";

import { setLocale } from "@/lib/actions/locale";
import type { Locale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({
  locale,
  label,
  icon,
  className,
}: {
  locale: Locale;
  /** Already the *other* language's own name, e.g. "English" when on Thai. */
  label: string;
  /** Set by callers that render this as a row in a list (the mobile nav
   *  menu) rather than its own standalone pill — absent for the header's
   *  own default rendering. */
  icon?: React.ReactNode;
  /**
   * The full shape/size/color for this instance — `SiteHeader`'s own pill
   * and the mobile nav menu's full-width row want different radius, text
   * token, and hover treatment, not variations on a shared default. This
   * component only owns what every instance needs regardless of shape
   * (tap target, busy state, the icon gap); everything visual is the
   * caller's, so there is never a rounded-pill/rounded-field or
   * text-sm/text-label pair landing in the same `cn()` call fighting over
   * which one wins — `twMerge` only recognizes Tailwind's own built-in
   * scale names as conflicting within a group, not this project's
   * `--radius-*`/`--text-*` tokens, so two different named tokens for the
   * same property can both survive a merge instead of the second
   * replacing the first.
   */
  className: string;
}) {
  const [pending, startTransition] = useTransition();
  const next: Locale = locale === "th" ? "en" : "th";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setLocale(next))}
      className={cn(
        "inline-flex min-h-11 items-center disabled:opacity-50",
        icon && "gap-2.5",
        className,
      )}
      lang={next}
    >
      {icon}
      {label}
    </button>
  );
}
