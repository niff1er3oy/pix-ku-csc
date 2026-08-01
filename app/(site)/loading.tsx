import { getDictionary } from "@/lib/i18n";

/**
 * Streaming placeholder. Mirrors the real page's rhythm — two-column hero,
 * green band, event cards — so nothing jumps when the content lands.
 */
export default async function Loading() {
  const dict = await getDictionary();

  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{dict.common.loading}</span>

      <section className="mx-auto w-full max-w-6xl px-5 pb-8 pt-12 sm:px-8 sm:pb-12 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
          <div>
            <div className="animate-shimmer h-11 w-full max-w-md rounded-field sm:h-14" />
            <div className="animate-shimmer mt-3 h-11 w-3/4 max-w-sm rounded-field sm:h-14" />
            <div className="animate-shimmer mt-6 h-5 w-full max-w-lg rounded-field" />
            <div className="animate-shimmer mt-2 h-5 w-2/3 max-w-md rounded-field" />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <div className="animate-shimmer h-14 w-52 rounded-pill" />
              <div className="animate-shimmer h-14 w-44 rounded-pill" />
            </div>
          </div>

          <div className="grid aspect-[4/3] grid-cols-4 grid-rows-4 gap-2 sm:gap-3">
            {[
              "col-span-2 row-span-2",
              "col-span-1 row-span-1",
              "col-span-1 row-span-2",
              "col-span-1 row-span-1",
              "col-span-1 row-span-1",
              "col-span-2 row-span-1",
              "col-span-1 row-span-1",
            ].map((span, i) => (
              <div
                key={i}
                className={`animate-shimmer rounded-media ${span}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 bg-green-600 sm:mt-12">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="h-8 w-56 rounded-field bg-green-700" />
          <div className="mt-3 h-5 w-72 rounded-field bg-green-700/70" />
          <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-3 sm:gap-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-card bg-green-700 p-6 sm:p-7">
                <div className="size-11 rounded-pill bg-green-800" />
                <div className="mt-5 h-6 w-4/5 rounded-field bg-green-800" />
                <div className="mt-4 h-4 w-full rounded-field bg-green-800" />
                <div className="mt-2 h-4 w-2/3 rounded-field bg-green-800" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="animate-shimmer h-8 w-64 rounded-field" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-card shadow-[var(--shadow-card)]"
            >
              <div className="animate-shimmer aspect-[4/3]" />
              <div className="p-5">
                <div className="animate-shimmer h-5 w-4/5 rounded-field" />
                <div className="mt-3 flex gap-2">
                  <div className="animate-shimmer h-7 w-24 rounded-pill" />
                  <div className="animate-shimmer h-7 w-20 rounded-pill" />
                </div>
                <div className="animate-shimmer mt-3 h-4 w-1/2 rounded-field" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
