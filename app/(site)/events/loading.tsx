import { EventCardSkeleton } from "@/components/events/event-card";
import { LoadingRegion, Skeleton } from "@/components/ui/loading";
import { getDictionary } from "@/lib/i18n";

/**
 * Matches the events index exactly — same heading block, same three-column
 * grid, same cards — so nothing shifts when the real ones land. Worth a real
 * skeleton because this route always waits on a database query and its shape
 * is known before that query returns.
 */
export default async function Loading() {
  const dict = await getDictionary();

  return (
    <LoadingRegion
      label={dict.common.loading}
      className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24"
    >
      <div className="max-w-xl">
        <Skeleton className="h-10 w-52 sm:h-12" />
        <Skeleton className="mt-5 h-5 w-full max-w-md" />
      </div>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </ul>
    </LoadingRegion>
  );
}
