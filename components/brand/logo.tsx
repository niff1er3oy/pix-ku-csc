import { cn } from "@/lib/utils";

/**
 * The PIX KU CSC wordmark.
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
      text: "text-brand",
      bar: "h-[8px] sm:h-[12px]",
      gap: "pb-3 sm:pb-4",
    },
  }[size];

  return (
    <span
      className={cn("inline-flex flex-col items-start select-none", className)}
    >
      {/* `whitespace-nowrap`: it is a mark, not a phrase. Inside a column
          narrower than itself it broke to "PIX KU / CSC" with the bar
          stretched under both lines. */}
      <span
        className={cn(
          "whitespace-nowrap font-display font-bold leading-none tracking-tight",
          scale.text,
          scale.gap,
        )}
      >
        <span className="text-ink">PIX </span>
        <span className="text-green-600">KU</span>
        <span className="text-ink"> CSC</span>
      </span>
      <span
        aria-hidden
        className={cn("w-full bg-lime-500", scale.bar)}
      />
    </span>
  );
}
