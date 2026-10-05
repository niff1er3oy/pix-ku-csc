import { demoSrcSet, type DemoPhoto } from "@/lib/demo-photos";
import { cn } from "@/lib/utils";

/**
 * Three photographs from an event, under the brand: one either side, yours in
 * the middle.
 *
 * Everything here answers something the owner said about the version before
 * it, which scattered cropped, teal-tinted cards round the wordmark and let
 * them run off the edges of the screen:
 *
 * - **Whole frames.** Each card is the full 3:2 photograph, never a crop —
 *   an event photo is of a scene, and a slice of three torsos is not one.
 * - **Their own colours.** No tint. The one that is yours is told apart by a
 *   lime ring, a lift and a label instead of by being the only one in colour.
 * - **All of every card on the screen, none overlapping,** at every width.
 *   The row sits in a slot that is whatever height the window has left under
 *   the copy, and fits itself to that slot (see `.hero-slot` in globals.css)
 *   — so on a short laptop or a phone with its toolbars showing it gets
 *   smaller instead of sliding under the fold.
 * - **Three cards, because there are three frames.** No picture appears twice.
 *
 * What the server sends is the finished picture, "found" marks and all. Once
 * script is running `HomeMotion` takes those marks off and plays them back
 * in: a sweep crosses the row, and as it passes the middle card the ring
 * closes, the face is boxed and the label lands. On an ordinary connection
 * that hand-over happens while the cards are still fading in, so nobody sees
 * it; on a slow one the picture stands complete until the script arrives.
 * With no script, or with reduced motion, it simply stays as sent — nothing
 * here waits on JavaScript to become visible.
 *
 * Decorative throughout, so `aria-hidden`: the sentence it illustrates is the
 * `h1` above it. The files are marketing material in /public, and the card
 * that imitates a result carries its own "demo" tag (DESIGN.md §10).
 */
export function HeroPhotos({
  photos,
  foundLabel,
  demoLabel,
}: {
  photos: DemoPhoto[];
  foundLabel: string;
  demoLabel: string;
}) {
  if (photos.length === 0) return null;

  // With all three on disk: first, second (yours), third. With fewer, yours
  // is still the middle of whatever there is.
  const found = photos[1] ?? photos[0];
  const left = photos.length > 1 ? photos[0] : null;
  const right = photos[2] ?? null;
  const you = found.faces.find((face) => face.you);

  return (
    <div aria-hidden className="hero-slot">
      <div data-hero-photos className="hero-photos">
        {left && <SideCard photo={left} side="left" />}

        {/* `data-hero-card` is what the scroll motion moves; the entrance and
            the tilt live on the element inside it, so the two never fight
            over one transform. */}
        <div data-hero-card="found" className="hero-card hero-card-found">
          <div
            className="enter"
            style={{ "--d": "520ms" } as React.CSSProperties}
          >
            <div data-hero-found className="relative">
              <div className="overflow-hidden rounded-media bg-green-100 shadow-[var(--shadow-lift)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={found.src}
                  srcSet={demoSrcSet(found.src)}
                  sizes="(min-width: 1024px) 360px, 46vw"
                  alt=""
                  decoding="async"
                  className="aspect-[3/2] w-full object-cover"
                />
              </div>

              {you && (
                <span
                  data-hero-mark="you"
                  className="absolute min-h-3.5 min-w-3.5 rounded-[3px] ring-2 ring-lime-300"
                  style={{
                    left: `${you.x}%`,
                    top: `${you.y}%`,
                    width: `${you.w}%`,
                    height: `${you.h}%`,
                  }}
                />
              )}

              {/* The ring sits outside the photograph's own clipped frame, or
                  the frame would cut it off. */}
              <span
                data-hero-mark="ring"
                className="pointer-events-none absolute inset-0 rounded-media shadow-[0_0_0_4px_var(--color-lime-500)]"
              />

              <span
                data-hero-mark="label"
                className="absolute bottom-1.5 left-1.5 rounded-pill bg-lime-500 px-2.5 py-0.5 text-caption font-semibold text-green-950 sm:bottom-2.5 sm:left-2.5"
              >
                {foundLabel}
              </span>

              {/* The disclosure DESIGN.md §10 asks for, on the one card that
                  imitates a result. Always there, marks or no marks. Dark and
                  quiet so the lime label stays the only loud thing on the
                  photograph — the same treatment the lock badge on an event
                  cover gets — and in the opposite corner, so the two never
                  meet on a narrow phone. */}
              <span className="absolute right-1.5 top-1.5 rounded-pill bg-ink/70 px-2 py-0.5 text-caption text-paper sm:right-2.5 sm:top-2.5">
                {demoLabel}
              </span>
            </div>
          </div>
        </div>

        {right && <SideCard photo={right} side="right" />}

        {/* The line the script sends across the row; not shown until then. It
            travels inside a clipped track because it finishes past the row's
            right edge — on a phone that is past the edge of the screen, and
            an invisible element parked there still made the page 15px wider
            than the window. */}
        <span className="hero-sweep-track">
          <span data-hero-sweep className="hero-sweep" />
        </span>
      </div>
    </div>
  );
}

function SideCard({ photo, side }: { photo: DemoPhoto; side: "left" | "right" }) {
  return (
    <div data-hero-card={side} className="hero-card">
      <div
        className={cn(
          "enter overflow-hidden rounded-media bg-green-100 shadow-[var(--shadow-card)]",
          side === "left" ? "hero-tilt-left" : "hero-tilt-right",
        )}
        style={
          { "--d": side === "left" ? "440ms" : "600ms" } as React.CSSProperties
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.src}
          srcSet={demoSrcSet(photo.src)}
          sizes="(min-width: 1024px) 250px, 25vw"
          alt=""
          decoding="async"
          className="aspect-[3/2] w-full object-cover"
        />
      </div>
    </div>
  );
}
