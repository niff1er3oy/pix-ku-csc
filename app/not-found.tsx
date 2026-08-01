import { ButtonLink } from "@/components/ui/button";
import { GridBackground } from "@/components/ui/grid-background";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getDictionary } from "@/lib/i18n";

/**
 * Root 404. Lives outside the (site) group so it also catches unmatched
 * top-level paths — without it Next serves its stock English black-on-white
 * page, which is off-system and offers no way back.
 */
export default async function NotFound() {
  const dict = await getDictionary();

  return (
    <>
      <SiteHeader />
      <main
        id="main"
        className="flex flex-1 items-center justify-center px-5 py-20 sm:px-8 sm:py-28"
      >
        <div className="relative w-full max-w-lg overflow-hidden rounded-card bg-cloud px-6 py-16 text-center sm:py-20">
          <GridBackground />
          <div className="relative">
            <h1 className="text-h2">{dict.common.notFoundTitle}</h1>
            <p className="mx-auto mt-3 max-w-sm text-body text-slate">
              {dict.common.notFoundBody}
            </p>
            <ButtonLink href="/" className="mt-8">
              {dict.common.goHome}
            </ButtonLink>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
