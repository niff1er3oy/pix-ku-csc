import { cn } from "@/lib/utils";

type Variant = "light" | "green" | "page";
type Speed = "slow" | "normal" | "fast";

const SPEED_SECONDS: Record<Speed, number> = {
  slow: 34,
  normal: 20,
  fast: 11,
};

/**
 * A slowly drifting green grid.
 *
 * Used behind empty states and waiting screens so a blank area still belongs
 * to the brand instead of reading as a grey box. Purely decorative, so it is
 * `aria-hidden` and never takes pointer events. The parent must be positioned.
 *
 * @example
 * <div className="relative overflow-hidden rounded-card">
 *   <GridBackground />
 *   <div className="relative">…content…</div>
 * </div>
 */
export function GridBackground({
  variant = "light",
  speed = "slow",
  size = 44,
  scan = false,
  fade = true,
  className,
}: {
  /**
   * `light` for a white panel, `green` for the deep green band, `page` for the
   * whole-document backdrop — the last one is much fainter because real body
   * copy sits on top of it rather than a short empty-state line.
   */
  variant?: Variant;
  speed?: Speed;
  /** Grid cell size in px. */
  size?: number;
  /** Adds a beam raking down the grid. Waiting states only. */
  scan?: boolean;
  /** Fades the grid out at the edges so it never ends on a hard line. */
  fade?: boolean;
  className?: string;
}) {
  const line =
    variant === "green"
      ? "color-mix(in oklab, var(--color-green-100) 22%, transparent)"
      : variant === "page"
        ? // Body copy reads on top of this one, so it stays a hint of texture
          // rather than a pattern. 7% keeps every text contrast ratio in
          // DESIGN.md §8 intact.
          "color-mix(in oklab, var(--color-green-600) 7%, transparent)"
        : "color-mix(in oklab, var(--color-green-600) 12%, transparent)";

  const beam =
    variant === "green"
      ? "color-mix(in oklab, var(--color-lime-300) 20%, transparent)"
      : "color-mix(in oklab, var(--color-green-500) 10%, transparent)";

  const mask =
    "radial-gradient(115% 100% at 50% 0%, #000 32%, transparent 100%)";

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
      style={
        {
          "--grid-size": `${size}px`,
          // Without this the grid ends on a hard cropped line, which reads as
          // a rendering bug rather than a texture.
          maskImage: fade ? mask : undefined,
          WebkitMaskImage: fade ? mask : undefined,
        } as React.CSSProperties
      }
    >
      {/* Oversized by one cell in each direction so the looping translate
          never exposes an untiled edge. */}
      <div
        className="grid-drift absolute"
        style={
          {
            top: "calc(var(--grid-size) * -1)",
            left: "calc(var(--grid-size) * -1)",
            right: "calc(var(--grid-size) * -1)",
            bottom: "calc(var(--grid-size) * -1)",
            backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
            backgroundSize: "var(--grid-size) var(--grid-size)",
            animation: `grid-drift ${SPEED_SECONDS[speed]}s linear infinite`,
            willChange: "transform",
          } as React.CSSProperties
        }
      />

      {scan && (
        <div
          className="grid-scan absolute inset-x-0"
          style={{
            height: "38%",
            background: `linear-gradient(to bottom, transparent, ${beam}, transparent)`,
            animation: "grid-scan 4.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            willChange: "transform, opacity",
          }}
        />
      )}
    </div>
  );
}
