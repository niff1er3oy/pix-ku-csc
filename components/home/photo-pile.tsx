import { PileParallax } from "@/components/home/pile-parallax";
import { demoSrc, demoSrcSet, type DemoPhoto } from "@/lib/demo-photos";
import { cn } from "@/lib/utils";

/**
 * A window onto a demo photograph: its top-left corner in % of the frame, and
 * how far in. The window is `100 / zoom` % of the frame each way, and every
 * card is 3:2 like the photographs, so nothing is ever stretched.
 */
type Crop = { photo: number; x: number; y: number; zoom: number };

type PileCard = {
  crop: Crop;
  /** Phone and tablet: left, top and width in % of the band the pile hangs
   *  in. A card without one only exists on a desktop. */
  phone?: { x: number; y: number; w: number; tilt: number };
  /** Desktop: which side of the wordmark, how far the card's inner edge sits
   *  from the page centre and how wide it is (both in pile units, see `--pu`
   *  in globals.css), and its top edge in % of the screen. The copy between
   *  the two sides is 42 units wide, so a `gap` under 21 runs into it. */
  desk: { side: "left" | "right"; gap: number; y: number; w: number; tilt: number };
  /** Pixels of travel at full pointer deflection. Small cards sit further
   *  back, so they move more. */
  depth: number;
};

/**
 * Five cards, because that is how many different pictures three supplied
 * frames can honestly give. The frame that gets found is not used here at all,
 * and the windows cut from the other two do not overlap — an earlier version
 * had nine cards from the same two frames, and the same child in the mud
 * turned up in three of them. A pile that repeats itself reads as a pile that
 * was faked. More frames from the owner are what would make it deeper; the
 * table below is the only thing that would need to change.
 *
 * Every window is a group scene, never one face. `SelfieFace` in
 * how-it-works.tsx is drawn for the same reason: a product about handling
 * faces carefully should not blow one student's up on its front page.
 *
 * Desktop cards are measured from the page centre outwards. The inner ones
 * always fit; the outer one on each side hangs off the edge of a laptop and
 * comes into view as the window widens, so the pile carries on past the
 * screen instead of ending at it.
 */
const PILE: PileCard[] = [
  {
    // Frame 1, the left-hand team on the rope.
    crop: { photo: 0, x: 2, y: 42, zoom: 2.27 },
    phone: { x: -5, y: -32, w: 46, tilt: -7 },
    desk: { side: "left", gap: 22.5, y: 11, w: 16, tilt: -6 },
    depth: 10,
  },
  {
    // Frame 3, bottom right: the two in the mud.
    crop: { photo: 2, x: 50, y: 44, zoom: 2.27 },
    phone: { x: 17, y: 30, w: 28, tilt: 4 },
    desk: { side: "left", gap: 23, y: 57, w: 15, tilt: 5 },
    depth: 12,
  },
  {
    // Frame 3, top left: the bank, the crowd, the man on the rope.
    crop: { photo: 2, x: 2, y: 6, zoom: 2.27 },
    desk: { side: "left", gap: 37.5, y: 33, w: 14, tilt: 8 },
    depth: 20,
  },
  {
    // Frame 1, the right-hand team.
    crop: { photo: 0, x: 56, y: 38, zoom: 2.27 },
    desk: { side: "right", gap: 24.5, y: 6, w: 13.5, tilt: -6 },
    depth: 14,
  },
  {
    // Frame 3, top right: the flag and the far bank.
    crop: { photo: 2, x: 60, y: 8, zoom: 2.5 },
    phone: { x: 60, y: -40, w: 46, tilt: 6 },
    desk: { side: "right", gap: 33, y: 60, w: 14.5, tilt: -5 },
    depth: 18,
  },
];

/**
 * The one that is yours. Same shape as the rest, so it lies in the pile like
 * any other card until the colour comes up.
 *
 * On a desktop it sits 22 + 16 = 38 units from the centre, which is 486px at
 * the 12.8px floor: on a 1024px window that leaves 18px between its ring and
 * the edge, enough for the 8px the pointer can lean it and its 4° of tilt.
 * On a phone it is 42% of the band — clearly smaller than the wordmark under
 * it, which is what keeps this the brand screen the owner asked to keep and
 * not a photograph with a logo beneath.
 */
const FOUND: PileCard = {
  crop: { photo: 1, x: 14.6, y: 17, zoom: 1.45 },
  phone: { x: 48, y: 18, w: 42, tilt: -3 },
  desk: { side: "right", gap: 22, y: 30, w: 16, tilt: 4 },
  depth: 8,
};

/** The found card joins the entrance in the middle of the deal, not last —
 *  it should look like one of the pile before it turns out to be yours. */
const FOUND_ORDER = 3;

function placement(card: PileCard, order: number): React.CSSProperties {
  const { desk, phone } = card;
  const gap = `calc(var(--pu) * ${desk.gap})`;
  const width = `calc(var(--pu) * ${desk.w})`;

  return {
    "--dx":
      desk.side === "left"
        ? `calc(50% - ${gap} - ${width})`
        : `calc(50% + ${gap})`,
    "--dy": `${desk.y}%`,
    "--dw": width,
    "--dr": `${desk.tilt}deg`,
    // Cards arrive from the side they live on.
    "--dfrom": desk.side === "left" ? "-56px 12px" : "56px 12px",
    ...(phone && {
      "--mx": `${phone.x}%`,
      "--my": `${phone.y}%`,
      "--mw": `${phone.w}%`,
      "--mr": `${phone.tilt}deg`,
    }),
    "--depth": card.depth,
    "--n": order,
  } as React.CSSProperties;
}

/** Sizes and shifts a full frame so that only `crop`'s window shows through
 *  the card it sits in. */
function windowStyle({ x, y, zoom }: Crop): React.CSSProperties {
  return {
    width: `${zoom * 100}%`,
    height: `${zoom * 100}%`,
    left: `${-x * zoom}%`,
    top: `${-y * zoom}%`,
  };
}

/**
 * The headline, drawn: "find your photo in the whole event's pile".
 *
 * Event photographs lie scattered round the wordmark, printed in the brand's
 * teal the way a one-colour flyer would be. One of them turns out to be yours
 * and comes up in full colour inside a lime ring — the only natural colour on
 * the screen, which is what makes it read as found.
 *
 * Decorative throughout, so the whole thing is `aria-hidden`: the sentence it
 * illustrates is the `h1` beside it. Like the rest of the demo material these
 * are marketing files in /public, and the card that imitates a result carries
 * its own "demo" tag (DESIGN.md §10).
 *
 * Motion is one arrival and then stillness. The cards deal in, the found one
 * resolves, and after that the pile only moves if a pointer does.
 *
 * Loaded eagerly, against the usual habit for images on this site: all of
 * them are on the first screen, and the ink lifts off the found card on a
 * clock — a lazy image that arrived late would leave that clock revealing an
 * empty frame.
 */
export function PhotoPile({
  photos,
  foundLabel,
  demoLabel,
}: {
  photos: DemoPhoto[];
  foundLabel: string;
  demoLabel: string;
}) {
  if (photos.length === 0) return null;

  const pick = (index: number) => photos[index % photos.length];
  const found = pick(FOUND.crop.photo);
  const you = found.faces.find((face) => face.you);

  return (
    /* Below `lg` this is a band across the top of the screen, as tall as the
       `--pile-zone` the brand screen reserves for it and starting below the
       header wherever the header is showing (`--header-gap`, globals.css).
       From `lg` it is the whole screen and the cards take the two sides. */
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-[var(--header-gap)] mx-auto h-[var(--pile-zone)] max-w-xl sm:max-w-2xl lg:inset-0 lg:h-auto lg:max-w-none"
    >
      <PileParallax />

      {PILE.map((card, index) => (
        <div
          key={index}
          className={cn("pile-card", !card.phone && "max-lg:hidden")}
          // Skips the slot the found card deals into.
          style={placement(card, index < FOUND_ORDER ? index : index + 1)}
        >
          <div className="pile-in relative isolate overflow-hidden rounded-media bg-green-700 shadow-[var(--shadow-card)] [aspect-ratio:3/2]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={demoSrc(pick(card.crop.photo).src, 640)}
              alt=""
              decoding="async"
              fetchPriority="low"
              className="pile-ink-img absolute max-w-none"
              style={windowStyle(card.crop)}
            />
          </div>
        </div>
      ))}

      <div className="pile-card z-10" style={placement(FOUND, FOUND_ORDER)}>
        <div className="pile-in">
          <div className="pile-found relative overflow-hidden rounded-media bg-green-100 [aspect-ratio:3/2]">
            {/* A layer the size of the whole frame, so the face box keeps the
                coordinates it was measured in while the window moves in. */}
            <div className="absolute" style={windowStyle(FOUND.crop)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={found.src}
                srcSet={demoSrcSet(found.src)}
                sizes="(min-width: 1024px) 400px, 62vw"
                alt=""
                decoding="async"
                className="h-full w-full object-cover"
              />
              {you && (
                <span
                  className="pile-snap absolute rounded-[3px] ring-2 ring-lime-300 [--at:1500ms]"
                  style={{
                    left: `${you.x}%`,
                    top: `${you.y}%`,
                    width: `${you.w}%`,
                    height: `${you.h}%`,
                  }}
                />
              )}
            </div>

            {/* The same frame in ink, lying on top until the match lands. */}
            <div className="pile-ink absolute inset-0 isolate bg-green-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={demoSrc(found.src, 640)}
                alt=""
                decoding="async"
                className="pile-ink-img absolute max-w-none"
                style={windowStyle(FOUND.crop)}
              />
            </div>

            <span className="pile-rise absolute bottom-2 left-2 rounded-pill bg-lime-500 px-2.5 py-0.5 text-caption font-semibold text-green-950 [--at:1650ms]">
              {foundLabel}
            </span>
            {/* The disclosure DESIGN.md §10 asks for, on the one card that
                imitates a result. Dark and quiet so the lime label stays the
                only loud thing on the photograph — the same treatment the
                lock badge on an event cover gets. */}
            <span className="pile-rise absolute bottom-2 right-2 rounded-pill bg-ink/70 px-2 py-0.5 text-caption text-paper [--at:1750ms]">
              {demoLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
