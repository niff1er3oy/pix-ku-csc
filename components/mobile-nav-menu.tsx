import Link from "next/link";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { CalendarIcon, CameraIcon, GlobeIcon, MenuIcon, ShieldIcon, UsersIcon } from "@/components/ui/icon";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locale";

/**
 * The links `SiteHeader`'s own `navLink` hides below `sm` — Events,
 * Affiliations, Studio, Admin — collapsed into one disclosure instead of
 * simply disappearing. `navLink`'s comment explains why they hide (four
 * links plus the language toggle and profile chip wrap onto a second line
 * past 360px); this is what stops "hidden" from meaning "gone."
 *
 * The language toggle moves in here too, for the same reason and the same
 * row budget — `SiteHeader` hides its own standalone `LocaleSwitcher` below
 * `sm` so it never renders twice. A row in this list rather than a second
 * control beside the hamburger: one less icon competing for thumb room next
 * to the notification bell and account chip.
 *
 * `<details>` for the same reason `AccountMenu`/`NotificationBell` already
 * are: a no-JS visitor can still reach every page this opens, and the three
 * header disclosures now open and close the same way.
 */
export function MobileNavMenu({
  dict,
  locale,
  showStudio,
  showAdmin,
}: {
  dict: Dictionary;
  locale: Locale;
  showStudio: boolean;
  showAdmin: boolean;
}) {
  return (
    <details className="relative sm:hidden">
      <summary
        aria-label={dict.nav.menu}
        className="grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-pill text-slate transition-colors duration-200 hover:bg-cloud hover:text-green-700"
      >
        <MenuIcon size={22} />
      </summary>

      <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-card bg-paper p-1.5 shadow-lift ring-1 ring-edge">
        <Link
          href="/events"
          className="flex min-h-11 items-center gap-2.5 rounded-field px-3 text-label text-ink transition-colors duration-200 hover:bg-cloud"
        >
          <CalendarIcon size={18} className="text-slate" />
          {dict.nav.events}
        </Link>

        <Link
          href="/affiliations"
          className="flex min-h-11 items-center gap-2.5 rounded-field px-3 text-label text-ink transition-colors duration-200 hover:bg-cloud"
        >
          <UsersIcon size={18} className="text-slate" />
          {dict.nav.affiliations}
        </Link>

        {showStudio && (
          <Link
            href="/studio"
            className="flex min-h-11 items-center gap-2.5 rounded-field px-3 text-label text-ink transition-colors duration-200 hover:bg-cloud"
          >
            <CameraIcon size={18} className="text-slate" />
            {dict.nav.studio}
          </Link>
        )}

        {showAdmin && (
          <Link
            href="/admin"
            className="flex min-h-11 items-center gap-2.5 rounded-field px-3 text-label text-ink transition-colors duration-200 hover:bg-cloud"
          >
            <ShieldIcon size={18} className="text-slate" />
            {dict.nav.admin}
          </Link>
        )}

        {/* Its own divider, same as `AccountMenu`'s before sign-out — this
            is an action on the page itself, not a destination, and reads as
            one once it is set apart from the links above it. */}
        <div className="my-1 border-t border-edge" />

        <LocaleSwitcher
          locale={locale}
          label={dict.nav.switchLanguage}
          icon={<GlobeIcon size={18} className="text-slate" />}
          className="flex w-full rounded-field px-3 text-left text-label text-ink transition-colors duration-200 hover:bg-cloud"
        />
      </div>
    </details>
  );
}
