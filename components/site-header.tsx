import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { buttonClass } from "@/components/ui/button";
import { getPhotographer, getSessionUser } from "@/lib/dal";
import { getDictionary, getLocale } from "@/lib/i18n";

const navLink =
  "rounded-pill px-3 py-2 text-slate transition-colors duration-200 hover:bg-cloud hover:text-green-700";

export async function SiteHeader() {
  const [locale, dict, user] = await Promise.all([
    getLocale(),
    getDictionary(),
    getSessionUser(),
  ]);

  const photographer = user ? await getPhotographer(user.id) : null;
  const showStudio = photographer?.status === "approved";

  return (
    <header className="header-bar sticky top-0 z-40 bg-paper/92 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:px-8">
        <Link href="/" className="shrink-0" aria-label={dict.brand.name}>
          <Logo size="md" />
        </Link>

        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link href="/events" className={`hidden sm:block ${navLink}`}>
            {dict.nav.events}
          </Link>

          {/* Hidden below `sm` alongside Events: a signed-in admin who is also
              an approved photographer would otherwise push four links plus the
              language toggle and profile chip past 360px, which is a real
              phone width at Thai campus events. */}
          {showStudio && (
            <Link href="/studio" className={`hidden sm:block ${navLink}`}>
              {dict.nav.studio}
            </Link>
          )}

          {user?.role === "admin" && (
            <Link href="/admin" className={`hidden sm:block ${navLink}`}>
              {dict.nav.admin}
            </Link>
          )}

          <LocaleSwitcher locale={locale} label={dict.nav.switchLanguage} />

          {user ? (
            <Link
              href="/me"
              className="ml-1 flex items-center gap-2 rounded-pill py-1 pl-1 pr-3 text-slate transition-colors duration-200 hover:bg-cloud hover:text-green-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user.image ?? "/avatar-fallback.svg"}
                alt=""
                width={30}
                height={30}
                className="size-[30px] rounded-pill object-cover ring-2 ring-green-100"
              />
              <span className="hidden sm:inline">{dict.nav.profile}</span>
            </Link>
          ) : (
            <Link
              href="/signin"
              className={buttonClass({
                variant: "secondary",
                size: "sm",
                className: "ml-1",
              })}
            >
              {dict.nav.signIn}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
