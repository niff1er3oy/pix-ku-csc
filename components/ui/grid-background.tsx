import { GridPhase } from "@/components/ui/grid-phase";
import { cn } from "@/lib/utils";

type Variant = "light" | "green" | "page";
type Speed = "slow" | "normal" | "fast";

const SPEED_SECONDS: Record<Speed, number> = {
  slow: 34,
  normal: 20,
  fast: 11,
};

/**
 * The one grid every aligned surface draws: the cell and the pace of the
 * page-wide backdrop in the root layout. A section that wants its lines to
 * carry on from the page's has to use exactly these, which is why they live
 * here and not at either call site.
 */
export const PAGE_GRID = { size: 56, speed: "fast" } as const;

/**
 * A slowly drifting green grid.
 *
 * Two ways to use it.
 *
 * **Local** (the default): a patch of grid inside one positioned box — an
 * empty state, a waiting screen — so a blank area still belongs to the brand
 * instead of reading as a grey box. The parent must be positioned.
 *
 * **`aligned`**: a surface of the page's own grid. The layer is fixed to the
 * window, with the same cell, pace and origin as the backdrop in the root
 * layout, so its lines are literally the same lines — they run straight
 * through from the white page into a green band, a black one and out again
 * without a step. Only the colour of the line changes with the surface.
 * Because it is fixed it would paint over the whole window, so the section
 * that owns it has to clip it to itself with `clip-path` (`overflow` does not
 * clip a fixed child): `[clip-path:inset(0)]`, or with `round …` on a box with
 * rounded corners.
 *
 * Purely decorative either way: `aria-hidden`, and it never takes a pointer.
 *
 * @example
 * <div className="relative overflow-hidden rounded-card">
 *   <GridBackground />
 *   <div className="relative">…content…</div>
 * </div>
 *
 * @example
 * <section className="bg-obsidian [clip-path:inset(0)]">
 *   <GridBackground aligned variant="green" />
 *   <div className="relative">…content…</div>
 * </section>
 */
export function GridBackground({
  variant = "light",
  speed = "slow",
  size = 44,
  fade = true,
  aligned = false,
  className,
}: {
  /**
   * `light` for a white or cloud panel, `green` for any dark surface — the
   * green band, the black one, a deep-green panel — and `page` for the
   * whole-document backdrop, which is much fainter because real body copy
   * sits on top of it rather than a short empty-state line.
   */
  variant?: Variant;
  speed?: Speed;
  /** Grid cell size in px. */
  size?: number;
  /** Fades the grid out at the edges so it never ends on a hard line. */
  fade?: boolean;
  /** Draw a surface of the page's own grid. Overrides size, speed and fade. */
  aligned?: boolean;
  className?: string;
}) {
  if (aligned) {
    size = PAGE_GRID.size;
    speed = PAGE_GRID.speed;
    fade = false;
  }

  const line =
    variant === "green"
      ? // Lighter than the surface, on anything dark. 16% is the strength at
        // which it reads on black about as loudly as the page grid reads on
        // white — the two are meant to look like one grid in two lights.
        "color-mix(in oklab, var(--color-green-100) 16%, transparent)"
      : variant === "page"
        ? // Body copy reads on top of this one, so it stays a hint of texture
          // rather than a pattern. 7% keeps every text contrast ratio in
          // DESIGN.md §8 intact.
          "color-mix(in oklab, var(--color-green-600) 7%, transparent)"
        : "color-mix(in oklab, var(--color-green-600) 12%, transparent)";

  const mask =
    "radial-gradient(115% 100% at 50% 0%, #000 32%, transparent 100%)";

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none inset-0 overflow-hidden",
        aligned ? "fixed" : "absolute",
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
          } as React.CSSProperties
        }
      />
      {aligned && <GridPhase />}
    </div>
  );
}
