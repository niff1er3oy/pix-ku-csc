import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-display font-semibold " +
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

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button className={buttonClass({ variant, size, className })} {...props} />
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
