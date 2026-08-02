import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { getDictionary } from "@/lib/i18n";

const footerLink =
  "text-slate transition-colors duration-200 hover:text-green-700";

export async function SiteFooter() {
  const dict = await getDictionary();

  return (
    <footer className="mt-auto">
      {/* PDPA, reduced to a single line. Face data is sensitive under the
          PDPA, so the promise stays visible on every page — the full
          explanation lives on the policy page and in the consent gate that
          runs before any search. */}
      <div className="bg-green-50">
        <p className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-5 py-3.5 text-sm text-green-900 sm:px-8">
          {dict.footer.pdpaLine}
          <Link
            href="/privacy"
            className="font-medium text-green-700 underline underline-offset-4 hover:text-green-800"
          >
            {dict.footer.pdpaLink}
          </Link>
        </p>
      </div>

      <div className="bg-cloud">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-[1fr_auto] sm:px-8">
          <div>
            <Logo size="sm" />
            <p className="mt-4 max-w-sm text-sm text-slate">
              {dict.brand.tagline}
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm sm:justify-end">
            <Link href="/events" className={footerLink}>
              {dict.nav.events}
            </Link>
            <Link href="/photographer/apply" className={footerLink}>
              {dict.nav.forPhotographers}
            </Link>
            <Link href="/privacy" className={footerLink}>
              {dict.legal.privacyTitle}
            </Link>
            <Link href="/terms" className={footerLink}>
              {dict.legal.termsTitle}
            </Link>
          </nav>
        </div>

        <div className="border-t border-edge">
          <p className="mx-auto max-w-6xl px-5 py-4 text-caption text-slate sm:px-8">
            Find KU Dae · มหาวิทยาลัยเกษตรศาสตร์
          </p>
        </div>
      </div>
    </footer>
  );
}
