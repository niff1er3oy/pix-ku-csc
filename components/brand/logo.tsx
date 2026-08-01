import { cn } from "@/lib/utils";

/**
 * The Find KU Dae wordmark.
 *
 * Built to echo the university mark's own composition rather than reinterpret
 * it: teal letterforms sitting on the lime bar, exactly as "KU" sits on it in
 * the official logo. "KU" carries the teal so the tie to the institution is
 * unmistakable at a glance.
 */
export function Logo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const scale = {
    sm: { text: "text-[0.9375rem]", bar: "h-[3px]", gap: "pb-1" },
    md: { text: "text-xl", bar: "h-[4px]", gap: "pb-1.5" },
    lg: { text: "text-3xl sm:text-4xl", bar: "h-[6px]", gap: "pb-2" },
    // Brand-screen scale. A real size rather than a transform, so the
    // letterforms stay crisp and the bar keeps its true thickness.
    xl: {
      text: "text-[3rem] sm:text-[5rem] lg:text-[6.5rem]",
      bar: "h-[8px] sm:h-[12px]",
      gap: "pb-3 sm:pb-4",
    },
  }[size];

  return (
    <span
      className={cn("inline-flex flex-col items-start select-none", className)}
    >
      <span
        className={cn(
          "font-display font-bold leading-none tracking-tight",
          scale.text,
          scale.gap,
        )}
      >
        <span className="text-ink">Find </span>
        <span className="text-green-600">KU</span>
        <span className="text-ink"> Dae</span>
      </span>
      <span
        aria-hidden
        className={cn("w-full bg-lime-500", scale.bar)}
      />
    </span>
  );
}
