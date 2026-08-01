import { cn } from "@/lib/utils";

/**
 * The hero's photo collage — the category's own convention, and the right one:
 * a first-time visitor needs to see that this is a pile of event photos before
 * they read a word.
 *
 * Real thumbnails when the site has any, tinted green tiles when it does not.
 * The empty state is never a grey box.
 */
export function HeroMosaic({ thumbs }: { thumbs: string[] }) {
  // A fixed, hand-tuned arrangement rather than a plain grid — a few tall and
  // wide tiles make it read as a shoot, not a spreadsheet.
  const tiles = [
    { span: "col-span-2 row-span-2", i: 0 },
    { span: "col-span-1 row-span-1", i: 1 },
    { span: "col-span-1 row-span-2", i: 2 },
    { span: "col-span-1 row-span-1", i: 3 },
    { span: "col-span-1 row-span-1", i: 4 },
    { span: "col-span-2 row-span-1", i: 5 },
    { span: "col-span-1 row-span-1", i: 6 },
  ];

  return (
    <div className="relative">
      <div className="animate-drift grid aspect-[4/3] grid-cols-4 grid-rows-4 gap-2 sm:gap-3">
        {tiles.map((tile, index) => {
          const thumb = thumbs.length ? thumbs[tile.i % thumbs.length] : null;
          return (
            <div
              key={index}
              className={cn(
                "overflow-hidden rounded-media bg-green-100",
                tile.span,
              )}
            >
              {thumb ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/media/${thumb}`}
                  alt=""
                  loading={index < 2 ? "eager" : "lazy"}
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="h-full w-full"
                  style={{
                    // Varying the tint keeps the empty state from reading as a
                    // loading skeleton.
                    background: `color-mix(in oklab, var(--color-green-600) ${14 + ((index * 11) % 34)}%, var(--color-green-50))`,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
