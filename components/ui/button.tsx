import Link from "next/link";
import type { ComponentProps } from "react";

import { Spinner } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

/* This used to be `whitespace-nowrap` on a fixed-height pill, because a label
   that wrapped inside a fixed height spilled two half-clipped lines out of it
   ("เข้าสู่ระบบ" breaking to "เข้าสู่ / ระบบ" in the header pill is what
   prompted it). Fixing the symptom that way created a worse one: a nowrap
   button cannot shrink *or* wrap, so a long Thai label — "ดาวน์โหลดรูปทั้งหมด",
   "อนุมัติช่างภาพที่เลือกไว้" — pushed straight through its container and off
   the screen, measured at 79px past the right edge of a 360px viewport, taking
   the whole page into a horizontal scroll with it.

   The root cause was the fixed height, not the wrapping. `min-h-*` in `sizes`
   below lets a wrapped label make the button taller instead of clipping it, so
   the nowrap crutch can go: a short label still renders exactly as before on
   one line, and a long one now grows downward inside its container rather than
   sideways out of it. `max-w-full` is the backstop — whatever the label, the
   button never exceeds the box it was given. */
const base =
  "inline-flex max-w-full items-center justify-center gap-2 text-center rounded-pill font-display font-semibold " +
  "transition-[background-color,box-shadow,transform,border-color] duration-200 " +
  "ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] active:duration-100 " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "bg-green-600 text-paper shadow-[var(--shadow-pop)] hover:bg-green-700 hover:-translate-y-px",
  secondary:
    "bg-paper text-green-700 ring-1 ring-inset ring-edge hover:bg-green-50 hover:ring-green-300",
  ghost: "text-slate hover:bg-cloud hover:text-green-700",
  danger: "bg-danger text-paper hover:brightness-90",
};

const sizes: Record<Size, string> = {
  // `min-h`, not `h` — see the note on `base`. The number is the same floor it
  // always was (md and up clear 44px, since anything smaller is hard to hit on
  // a phone held one-handed in a crowd), it just stops being a ceiling that
  // clips a label instead of letting it wrap. `py-*` keeps the two lines off
  // the pill's own edge on the rare button that does wrap.
  sm: "min-h-[38px] px-4 py-1.5 text-sm",
  md: "min-h-[46px] px-6 py-2 text-[0.9375rem]",
  lg: "min-h-14 px-8 py-2.5 text-base sm:text-lg",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

/**
 * `pending` is here rather than hand-rolled per form because almost every
 * form in this product has one: the event finder, the photographer
 * application, the face search. Centralising it keeps the spinner, the
 * disabled state and `aria-busy` from drifting apart between them.
 *
 * The label deliberately does not change while pending — DESIGN.md §9 asks
 * for one word per action through a whole flow, and a button that renames
 * itself mid-submit breaks that.
 */
export function Button({
  variant,
  size,
  className,
  pending = false,
  disabled,
  children,
  ...props
}: ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  pending?: boolean;
}) {
  return (
    <button
      className={buttonClass({ variant, size, className })}
      disabled={disabled ?? pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return (
    <Link className={buttonClass({ variant, size, className })} {...props} />
  );
}
