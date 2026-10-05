import { GridBackground } from "@/components/ui/grid-background";
import { PauseIcon, PlayIcon } from "@/components/ui/icon";
import { Phrases } from "@/components/ui/phrases";
import { demoSrc, demoSrcSet, type DemoPhoto } from "@/lib/demo-photos";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * The stage runs one 15 second loop in three five-second acts. These are the
 * moments on that clock (in seconds) that markup has to know about; the rest
 * of the timeline lives in the `stage-*` keyframes in globals.css, and the two
 * have to be changed together.
 */
const ACT_SECONDS = 5;
/** The line starts down the selfie, and how long any sweep takes to cross. */
const SELFIE_SWEEP_AT = 0.45;
const SWEEP_SECONDS = 2.1;
/** The line starts down the event photograph. */
const PHOTO_SWEEP_AT = 5.25;
/** The match lands a beat after that sweep leaves the frame. */
const MATCH_AT = 7.5;
/** "Found" lands once the results have settled into place. */
const FOUND_AT = 10.8;

/** A sweep line is 12.5% of its frame tall and travels from just above the
 *  top edge to just below the bottom one, so its centre reaches `y`% of the
 *  frame this far into the crossing. */
const sweepReaches = (y: number) => ((y + 6.25) / 112.5) * SWEEP_SECONDS;

/**
 * How it works, on one screen.
 *
 * This used to be three scenes stacked down three screens. The owner asked for
 * one, so the three visuals became three acts of a single stage: a face is
 * read, every face in an event photograph is boxed, and the photographs you
 * are in are laid out as your results.
 *
 * Each act has the frame to itself. Nothing is docked over a corner of
 * anything else, nothing is fanned out behind, and every photograph is shown
 * whole and in its own colours — the same rules the first screen's
 * photographs follow, for the same reason: the owner read the overlapping,
 * greyed-out version as clutter.
 *
 * It is a loop on a clock rather than a scroll-driven sequence, for the reason
 * the old version settled on: a visitor should not have to park their scroll
 * at the right pixel to see it, and a timed loop plays in every browser.
 *
 * The three captions are the content. They are all on screen at once and never
 * move; the stage is the illustration beside them, which is why it is a single
 * `role="img"` and why a paused or motionless stage loses nothing a reader
 * needs. At rest — animations off, reduced motion, or a browser that fails to
 * run them — the stylesheet leaves the stage on its last frame: your results.
 */
export function HowItWorks({
  photos,
  dict,
}: {
  photos: DemoPhoto[];
  dict: Dictionary;
}) {
  const hasStage = photos.length > 0;

  return (
    /* `#how` is where the first screen's secondary link lands; `scroll-mt`
       keeps the heading clear of the sticky header.

       Full-bleed black. This is the one place on the site where photographs
       are the subject rather than the decoration, and dropping the page out to
       black stops the white chrome competing with them. It also gives the
       greens somewhere to be bright: lime-300 is 16.6:1 here against 3.6:1 on
       paper.

       `clip-path` is for the grid: it is a fixed layer the size of the window
       (see `GridBackground`), and this is what keeps it inside the band. */
    <section
      id="how"
      className="how relative scroll-mt-16 bg-obsidian text-paper [clip-path:inset(0)]"
    >
      {/* The page's own grid, carried on across the black: same cells, same
          drift, the same lines that were on the white above. */}
      <GridBackground aligned variant="green" />

      {/* The lime bar from under the KU letterforms, at the weight it has in
          the mark. A 1px `edge` line on a white-to-black boundary reads as a
          seam that went wrong. */}
      <div aria-hidden className="relative h-1 w-full bg-lime-500" />

      {/* Tighter than the usual section rhythm on a phone, and no line of lede
          under the heading: the owner asked for this band to fit one screen,
          and on a 780px phone it was the padding, the gaps and that extra
          line that pushed it over. The lede it used to carry promised
          "30 seconds", which nothing on this page can back up. */}
      <div
        className={cn(
          "relative mx-auto grid w-full max-w-6xl gap-x-16 gap-y-5 px-5 py-10 sm:gap-y-8 sm:px-8 sm:py-24",
          hasStage &&
            "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr]",
        )}
      >
        <h2
          data-reveal
          className="text-h1 lg:col-start-1 lg:row-start-1 lg:self-end"
        >
          <Phrases text={dict.home.journeyTitle} />
        </h2>

        {hasStage && (
          /* Not a `<figure>`: its caption would have to be the last child and
             hold nothing but the caption, and the pause control belongs in
             the same row. The stage is an image with a name, and the
             disclosure is tied to it as its description instead. */
          <div
            data-reveal
            className="stage-fit min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center"
          >
            <Stage photos={photos} dict={dict} describedBy="stage-caption" />

            <div className="mt-3 flex items-center gap-4">
              {/* Required by DESIGN.md §10: demonstration material is labelled
                  as demonstration material. `green-300`, not `slate` — slate
                  on black is 2.86:1, and a disclosure nobody can read is not
                  a disclosure. This is 9.9:1. */}
              <p
                id="stage-caption"
                className="min-w-0 flex-1 text-caption text-green-300"
              >
                {dict.home.demoCaption}
              </p>

              {/* A loop that runs for longer than five seconds needs a way to
                  stop it (WCAG 2.2.2). A checkbox rather than a button so it
                  works before hydration and needs no script at all: the
                  stylesheet pauses the stage while it is checked.

                  Icon only — pause and play are among the few glyphs that
                  need no word beside them, and a word here squeezed the
                  disclosure into a three-line column on a phone. The input
                  itself is the 44px target and carries the name. */}
              <label
                title={dict.home.demoPause}
                className="relative grid size-11 shrink-0 cursor-pointer place-items-center rounded-pill text-green-100 ring-1 ring-inset ring-green-800 transition-colors duration-200 hover:bg-green-900 hover:text-paper"
              >
                <input
                  type="checkbox"
                  aria-label={dict.home.demoPause}
                  className="stage-pause peer absolute inset-0 cursor-pointer appearance-none rounded-pill"
                />
                <PauseIcon size={18} className="peer-checked:hidden" />
                <PlayIcon size={18} className="hidden peer-checked:block" />
              </label>
            </div>
          </div>
        )}

        <ol
          data-reveal="group"
          className={cn(
            "grid gap-5 sm:gap-6",
            hasStage
              ? "lg:col-start-1 lg:row-start-2 lg:gap-7 lg:self-start"
              : "sm:grid-cols-3 sm:gap-8",
          )}
        >
          {dict.home.journey.map((step, index) => (
            <li
              key={step.title}
              className={cn("flex gap-4", !hasStage && "sm:flex-col")}
            >
              {/* The lit chip walks 1 → 2 → 3 in step with the stage. With no
                  stage to keep time with, all three simply stay lit. */}
              <span
                className={cn(
                  "tnum grid size-10 shrink-0 place-items-center rounded-pill bg-lime-500 font-display text-h3 font-bold text-green-950",
                  hasStage && "stage-step",
                )}
                style={
                  {
                    animationDelay: `${index * ACT_SECONDS}s`,
                  } as React.CSSProperties
                }
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-h3 text-paper">{step.title}</h3>
                <p className="mt-1.5 text-body text-green-100">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * One frame, three acts. Everything in here is positioned and timed by the
 * `stage-*` classes; the Tailwind on these elements is only what they look
 * like, never where they are — the stylesheet has to be able to put each one
 * in its resting place without fighting a utility for it.
 */
function Stage({
  photos,
  dict,
  describedBy,
}: {
  photos: DemoPhoto[];
  dict: Dictionary;
  /** Id of the demo disclosure printed under the stage. */
  describedBy: string;
}) {
  const [top, ...others] = photos;
  const you = top.faces.find((face) => face.you) ?? top.faces[0];

  const box = (face: { x: number; y: number; w: number; h: number }) => ({
    left: `${face.x}%`,
    top: `${face.y}%`,
    width: `${face.w}%`,
    height: `${face.h}%`,
  });

  return (
    <div
      className="stage"
      role="img"
      aria-label={dict.home.stageAlt}
      aria-describedby={describedBy}
    >
      {/* Act three: the other photographs you turned up in, stacked beside the
          one that was scanned. Whole frames, full colour, each in its ring.
          Shown small, so the 640 file the first screen has already fetched is
          all they need. */}
      {others.slice(0, 2).map((photo, index) => (
        <div
          key={photo.src}
          className={cn(
            "stage-also overflow-hidden bg-green-100",
            index === 0 ? "stage-also-top" : "stage-also-bottom",
          )}
          // The second follows the first in by a beat.
          style={{ animationDelay: `${index * 0.14}s` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={demoSrc(photo.src, 640)}
            alt=""
            loading="lazy"
            decoding="async"
            className="aspect-[3/2] w-full object-cover"
          />
        </div>
      ))}

      {/* The event photograph. Scanned in act two, then the very same frame
          steps back to become the first of your results — shown uncropped at
          its native 3:2, which is what keeps the face boxes honest: they are
          percentages of the whole frame. */}
      <div className="stage-photo overflow-hidden bg-green-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={top.src}
          srcSet={demoSrcSet(top.src)}
          sizes="(min-width: 1024px) 600px, calc(100vw - 40px)"
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />

        <span
          className="stage-sweep"
          style={{ animationDelay: `${PHOTO_SWEEP_AT}s` }}
        />

        {/* A box appears exactly as the line reaches it, so the sweep looks
            like it is doing the finding. */}
        {top.faces.map((face, index) => (
          <span
            key={index}
            className="stage-box absolute min-h-[20px] min-w-[20px] rounded-[4px] ring-2 ring-paper/90"
            style={{
              ...box(face),
              animationDelay: `${
                PHOTO_SWEEP_AT + sweepReaches(face.y + face.h / 2)
              }s`,
            }}
          />
        ))}

        {/* Everyone else dims for a moment so the match reads at a glance… */}
        <span
          className="stage-spot absolute rounded-[4px]"
          style={{
            ...box(you),
            animationDelay: `${MATCH_AT}s`,
            boxShadow: "0 0 0 9999px rgb(1 33 31 / 0.4)",
          }}
        >
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-pill bg-lime-300 px-2 py-0.5 text-caption font-semibold text-green-950">
            {dict.home.demoMatch}
          </span>
        </span>

        {/* …and the lime box stays on your face for the rest of the loop. */}
        <span
          className="stage-you absolute min-h-[24px] min-w-[24px] rounded-[4px] ring-[3px] ring-lime-300"
          style={{
            left: `${you.x - 0.6}%`,
            top: `${you.y - 0.9}%`,
            width: `${you.w + 1.2}%`,
            height: `${you.h + 1.8}%`,
            animationDelay: `${MATCH_AT}s`,
          }}
        />
      </div>

      {/* On the stage rather than inside the photograph, which is at
          two-thirds size by the time this lands — a label that shrank with it
          came out at 11px on a phone. It sits on the large tile's bottom-left
          corner: 16.83% of the stage is spare under the mosaic, plus a
          little. */}
      <span
        className="stage-chip absolute bottom-[20%] left-[2.5%] rounded-pill bg-lime-300 px-3 py-0.5 text-label font-semibold text-green-950"
        style={{ animationDelay: `${FOUND_AT}s` }}
      >
        {dict.home.journeyFound}
      </span>

      {/* Your face, alone on the frame for act one. */}
      <div className="stage-selfie overflow-hidden bg-green-900">
        <SelfieFace />

        <span
          className="stage-sweep"
          style={{ animationDelay: `${SELFIE_SWEEP_AT}s` }}
        />

        {/* Capture guides snap in first, each a beat behind the last. */}
        {(["tl", "tr", "bl", "br"] as const).map((corner, index) => (
          <span
            key={corner}
            className={cn(
              "stage-guide absolute size-[12%] border-lime-300",
              corner === "tl" && "left-[8%] top-[7%] border-l-[3px] border-t-[3px]",
              corner === "tr" && "right-[8%] top-[7%] border-r-[3px] border-t-[3px]",
              corner === "bl" &&
                "bottom-[7%] left-[8%] border-b-[3px] border-l-[3px]",
              corner === "br" &&
                "bottom-[7%] right-[8%] border-b-[3px] border-r-[3px]",
            )}
            style={{ animationDelay: `${0.15 + index * 0.09}s` }}
          />
        ))}

        {/* Then the face is found, once the line has finished crossing it.
            Boxed to the drawn face ellipse: cx 200 cy 246 rx 83 ry 99 of a
            400x500 viewBox. */}
        <span
          className="stage-lock absolute rounded-[6px] ring-[3px] ring-lime-300"
          style={{
            left: "29%",
            top: "29%",
            width: "42%",
            height: "40%",
            animationDelay: `${SELFIE_SWEEP_AT + SWEEP_SECONDS + 0.15}s`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * A face, drawn rather than photographed.
 *
 * A real portrait would mean putting an identifiable student's close-up on the
 * front page purely as an illustration, and this is a product about handling
 * face data carefully — the marketing should not be the one place that treats
 * it casually.
 *
 * Only the brand greens: a literal skin tone would introduce a third colour
 * the palette does not have, so the portrait is stylised rather than
 * naturalistic, which also stops it reading as any particular person.
 */
function SelfieFace() {
  return (
    <svg viewBox="0 0 400 500" aria-hidden className="h-full w-full">
      {/* Shoulders */}
      <path
        d="M84 500C84 411 136 372 200 372s116 39 116 128Z"
        fill="var(--color-green-600)"
      />
      {/* Neck */}
      <path d="M176 316h48v70h-48Z" fill="var(--color-green-300)" />
      {/* Hair, behind the face */}
      <ellipse cx="200" cy="222" rx="99" ry="116" fill="var(--color-green-950)" />
      {/* Face */}
      <ellipse cx="200" cy="246" rx="83" ry="99" fill="var(--color-green-200)" />
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
  );
}
