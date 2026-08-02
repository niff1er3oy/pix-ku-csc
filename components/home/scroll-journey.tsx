import { FaceScanDemo } from "@/components/home/face-scan-demo";
import { GridBackground } from "@/components/ui/grid-background";
import { demoSrcSet, type DemoPhoto } from "@/lib/demo-photos";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * The three beats of using the product, told down the page.
 *
 * All three visuals loop on a clock. Scroll-driving them was the first
 * attempt, and it failed the audience twice over: a visitor only saw the
 * animation if they happened to park their scroll at exactly the right point,
 * and it did nothing at all on a browser without `animation-timeline` support
 * (Chrome 115, Safari 26 or Firefox 144 and up). A loop always plays.
 *
 * Each scene keeps ONE timeline for all its layers, so a sweep can never drift
 * out of step with the boxes it is supposed to be revealing.
 *
 * The captions still arrive on scroll via `.reveal` — those are content, and
 * content should meet the reader where they are.
 *
 * Scrolling is never hijacked. The page moves at the speed the visitor moves
 * it; only what is painted responds.
 */
export function ScrollJourney({
  photos,
  dict,
}: {
  photos: DemoPhoto[];
  dict: Dictionary;
}) {
  if (photos.length === 0) return null;

  const [stepOne, stepTwo, stepThree] = dict.home.journey;

  return (
    /* `#how` is where the brand screen's scroll cue lands; `scroll-mt` keeps
       the heading clear of the sticky header.

       Full-bleed black. The three beats are the one place on this site where
       photographs are the subject rather than the decoration, and dropping the
       page out to black is what stops the white chrome from competing with
       them. It also gives the greens somewhere to be bright: lime-300 sits at
       16.6:1 here against 3.6:1 on paper. */
    <section
      id="how"
      className="relative scroll-mt-20 bg-obsidian text-paper"
    >
      {/* The same drifting grid the rest of the site runs on, so the black
          reads as part of this product rather than an empty void. */}
      <GridBackground variant="green" size={72} speed="fast" />

      <div className="relative mx-auto w-full max-w-7xl px-5 py-28 sm:px-8 sm:py-40">
        <header className="max-w-2xl">
          <h2 className="text-h1">{dict.home.journeyTitle}</h2>
          <p className="mt-5 text-body-lg text-green-100">
            {dict.home.journeyLede}
          </p>
        </header>

        <div className="mt-20 space-y-32 sm:mt-28 sm:space-y-44">
          <Scene
            index={1}
            step={stepOne}
            visual={<SelfieVisual alt={dict.home.selfieAlt} />}
          />

          <Scene
            index={2}
            step={stepTwo}
            reverse
            visual={
              <div>
                <FaceScanDemo photos={photos} dict={dict} />
                <p className="mt-4">
                  <span className="inline-flex items-center gap-2 rounded-pill bg-green-900 px-4 py-2 text-label font-semibold text-lime-300">
                    <span className="animate-pulse-dot size-2 rounded-pill bg-lime-300" />
                    {dict.home.journeyScanning}
                  </span>
                </p>
              </div>
            }
          />

          <Scene
            index={3}
            step={stepThree}
            visual={
              <MatchVisual photos={photos} label={dict.home.journeyFound} />
            }
          />
        </div>
      </div>
    </section>
  );
}

/** One captioned beat: number and copy on one side, the visual on the other. */
function Scene({
  index,
  step,
  visual,
  reverse = false,
}: {
  index: number;
  step: { title: string; body: string };
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    /* `min-w-0` on both columns: a grid item defaults to `min-width: auto`,
       which refuses to shrink below its contents' intrinsic width — an image
       or a long unbroken string then pushes the track wider than the page. */
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
      <div className={cn("reveal min-w-0", reverse && "lg:order-2")}>
        <span className="inline-flex size-14 items-center justify-center rounded-pill bg-lime-500 font-display text-2xl font-bold text-green-950">
          {index}
        </span>
        <h3 className="mt-7 text-h1">{step.title}</h3>
        <p className="mt-4 max-w-lg text-body-lg text-green-100">{step.body}</p>
      </div>

      <div className={cn("journey-visual min-w-0", reverse && "lg:order-1")}>
        {visual}
      </div>
    </div>
  );
}

/**
 * Step one: a face being read.
 *
 * Drawn, not photographed. A real portrait would mean putting an identifiable
 * student's close-up on the front page purely as an illustration, and this is
 * a product about handling face data carefully — the marketing should not be
 * the one place that treats it casually.
 *
 * Only the brand greens: a literal skin tone would introduce a third colour
 * the palette does not have, so the portrait is stylised rather than
 * naturalistic, which also stops it reading as any particular person.
 */
function SelfieVisual({ alt }: { alt: string }) {
  const corners = ["tl", "tr", "bl", "br"] as const;

  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-card bg-green-900">
      <svg
        viewBox="0 0 400 500"
        role="img"
        aria-label={alt}
        className="h-full w-full"
      >
        {/* Shoulders */}
        <path
          d="M84 500C84 411 136 372 200 372s116 39 116 128Z"
          fill="var(--color-green-600)"
        />
        {/* Neck */}
        <path
          d="M176 316h48v70h-48Z"
          fill="var(--color-green-300)"
        />
        {/* Hair, behind the face */}
        <ellipse
          cx="200"
          cy="222"
          rx="99"
          ry="116"
          fill="var(--color-green-950)"
        />
        {/* Face */}
        <ellipse
          cx="200"
          cy="246"
          rx="83"
          ry="99"
          fill="var(--color-green-200)"
        />
        {/* Ears */}
        <ellipse cx="118" cy="252" rx="13" ry="20" fill="var(--color-green-300)" />
        <ellipse cx="282" cy="252" rx="13" ry="20" fill="var(--color-green-300)" />
        {/* Fringe */}
        <path
          d="M119 232c0-74 44-102 81-102s81 28 81 102c-19-46-46-58-81-55-35-3-62 9-81 55Z"
          fill="var(--color-green-950)"
        />
        {/* Brows */}
        <path
          d="M154 232h30M216 232h30"
          stroke="var(--color-green-950)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Eyes */}
        <ellipse cx="169" cy="256" rx="9" ry="12" fill="var(--color-green-950)" />
        <ellipse cx="231" cy="256" rx="9" ry="12" fill="var(--color-green-950)" />
        {/* Smile — the brand is friendly, so the drawn person is too. */}
        <path
          d="M176 296c8 13 40 13 48 0"
          stroke="var(--color-green-950)"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      <div
        aria-hidden
        className="scan-face-line absolute inset-x-0 top-0 h-[10%]"
        style={{
          background:
            "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--color-lime-300) 70%, transparent), transparent)",
        }}
      />

      {/* Capture guides snap in first, each a beat behind the last. */}
      {corners.map((corner, index) => (
        <span
          key={corner}
          aria-hidden
          className={cn(
            "scan-face-guide absolute size-10 border-lime-300",
            corner === "tl" && "left-[8%] top-[7%] border-l-[3px] border-t-[3px]",
            corner === "tr" && "right-[8%] top-[7%] border-r-[3px] border-t-[3px]",
            corner === "bl" &&
              "bottom-[7%] left-[8%] border-b-[3px] border-l-[3px]",
            corner === "br" &&
              "bottom-[7%] right-[8%] border-b-[3px] border-r-[3px]",
          )}
          style={
            { "--d": `${index * 90}ms` } as React.CSSProperties
          }
        />
      ))}

      {/* Then the face is found, once the line has finished crossing it.
          Boxed to the drawn face ellipse: cx 200 cy 246 rx 83 ry 99 of a
          400x500 viewBox. */}
      <span
        aria-hidden
        className="scan-face-lock absolute rounded-[6px] ring-[3px] ring-lime-300"
        style={{ left: "29%", top: "29%", width: "42%", height: "40%" }}
      />
    </div>
  );
}

/** Fanned angles for the discarded pile, back to front. */
const PILE = [-13, -6, 7, 14];

/**
 * Step three: one photograph lifted clear of the whole event.
 *
 * The pile behind is every other frame from the day — greyed and tilted away.
 * The single card in front is the one you are actually in, and it is shown
 * uncropped at the photograph's native 3:2, which is what lets the face box
 * come back: the stored coordinates are percentages of the original frame, so
 * they only land correctly when nothing has been cropped away.
 */
function MatchVisual({
  photos,
  label,
}: {
  photos: DemoPhoto[];
  label: string;
}) {
  const top = photos[0];
  const you = top.faces.find((face) => face.you) ?? top.faces[0];

  return (
    <div className="relative aspect-[4/3] w-full">
      {PILE.map((angle, index) => (
        <div
          key={index}
          aria-hidden
          className="match-pile absolute left-1/2 top-1/2 w-[76%] overflow-hidden rounded-media shadow-[var(--shadow-card)] grayscale"
          style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[(index + 1) % photos.length].src}
            srcSet={demoSrcSet(photos[(index + 1) % photos.length].src)}
            sizes="(min-width: 1024px) 420px, 76vw"
            alt=""
            loading="lazy"
            decoding="async"
            className="aspect-[3/2] w-full object-cover"
          />
        </div>
      ))}

      {/* The one that is yours. */}
      <figure className="match-lift absolute left-1/2 top-1/2 w-[76%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-media bg-green-100 ring-[3px] ring-lime-300">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={top.src}
          srcSet={demoSrcSet(top.src)}
          sizes="(min-width: 1024px) 420px, 76vw"
          alt=""
          loading="lazy"
          decoding="async"
          className="aspect-[3/2] w-full object-cover"
        />

        <span
          aria-hidden
          className="match-box absolute min-h-[24px] min-w-[24px] rounded-[3px] ring-[3px] ring-lime-300"
          style={{
            left: `${you.x}%`,
            top: `${you.y}%`,
            width: `${you.w}%`,
            height: `${you.h}%`,
          }}
        />

        <figcaption
          className="match-chip absolute bottom-3 left-3 rounded-pill bg-lime-300 px-3 py-1 text-caption font-semibold text-green-950">
          {label}
        </figcaption>
      </figure>
    </div>
  );
}
