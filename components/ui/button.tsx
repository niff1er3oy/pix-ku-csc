import Link from "next/link";
import type { ComponentProps } from "react";

import { Spinner } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

/* `whitespace-nowrap`: a button is a fixed-height pill, so a label that wraps
   does not make the button taller — it spills two half-clipped lines out of
   it. Thai wraps at word boundaries a Latin-trained eye does not expect, and
   "เข้าสู่ระบบ" broke to "เข้าสู่ / ระบบ" inside the header pill. */
const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-display font-semibold " +
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
  // md and up clear 44px — anything smaller is hard to hit on a phone held
  // one-handed in a crowd, which is the actual usage scene.
  sm: "h-[38px] px-4 text-sm",
  md: "h-[46px] px-6 text-[0.9375rem]",
  lg: "h-14 px-8 text-base sm:text-lg",
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
