import { LoadingRegion, Skeleton } from "@/components/ui/loading";
import { getDictionary } from "@/lib/i18n";

/**
 * The QR code's destination, so it is the page most likely to be opened on a
 * slow venue connection — and it carries the heaviest query, since the gallery
 * counts and pages through thousands of photos.
 *
 * Mirrors the real three bands: event header on cloud, the search panel, then
 * the photo grid at the same 4:3 the thumbnails use.
 */
export default async function Loading() {
  const dict = await getDictionary();

  return (
    <LoadingRegion label={dict.common.loading}>
      <header className="border-b border-edge bg-cloud">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
          <Skeleton className="h-10 w-3/4 max-w-lg sm:h-12" />
          <div className="mt-4 flex flex-wrap gap-2">
            <Skeleton className="h-7 w-28 rounded-pill" />
            <Skeleton className="h-7 w-24 rounded-pill" />
            <Skeleton className="h-7 w-20 rounded-pill" />
          </div>
          <Skeleton className="mt-4 h-4 w-40" />
        </div>
      </header>

      <section className="border-b border-edge">
        <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-2xl">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="mt-4 h-5 w-full max-w-md" />
            <Skeleton className="mt-8 h-20 w-full rounded-card" />
            <Skeleton className="mt-4 h-40 w-full rounded-card" />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <Skeleton className="h-9 w-44" />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-media" />
          ))}
        </div>
      </section>
    </LoadingRegion>
  );
}
