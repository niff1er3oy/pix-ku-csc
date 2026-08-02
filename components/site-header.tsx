import Link from "next/link";

import { HomeLink } from "@/components/brand/home-link";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { buttonClass } from "@/components/ui/button";
import { getPhotographer, getSessionUser } from "@/lib/dal";
import { getDictionary, getLocale } from "@/lib/i18n";

/* `min-h-11` is 44px — DESIGN.md §9's floor. `py-2` alone came to ~36px,
   which is a real miss on a phone held one-handed in a crowd.
 *
 * The `hidden … sm:inline-flex` pair lives here rather than at the call sites,
 * and that is the whole point. Each link used to be written as
 * `hidden sm:block ${navLink}` while `navLink` began with `inline-flex` — two
 * display utilities in the same Tailwind layer, where the winner is decided by
 * the order they happen to be generated in, not by the order they are written.
 * `inline-flex` won, so every one of these stayed on screen at 360px and the
 * header wrapped onto two lines. Keeping display in exactly one place is what
 * stops that from coming back.
 *
 * `whitespace-nowrap` because Thai breaks at word boundaries — "งานอีเวนต์"
 * split into "งาน / อีเวนต์" inside a pill sized for one line. */
const navLink =
  "hidden min-h-11 items-center whitespace-nowrap rounded-pill px-3 text-slate transition-colors duration-200 hover:bg-cloud hover:text-green-700 sm:inline-flex";

export async function SiteHeader() {
  const [locale, dict, user] = await Promise.all([
    getLocale(),
    getDictionary(),
    getSessionUser(),
  ]);

  const photographer = user ? await getPhotographer(user.id) : null;
  const showStudio = photographer?.status === "approved";

  return (
    /* Fully opaque. This was `bg-paper/92`, left over from a `backdrop-blur`
       that turned out to do nothing behind a 92%-opaque bar and was removed.
       The remaining 8% was not free once the journey band went black: the
       header rendered pure white over the brand screen and about 8% grey over
       the black section, so the same bar changed shade as you scrolled. */
    <header className="header-bar sticky top-0 z-40 bg-paper">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:px-8">
        {/* The mark is 38px tall on its own, and this is a link like any
            other — `min-h-11` brings the tappable area to the 44px floor
            without changing how the mark is drawn. */}
        <HomeLink
          className="inline-flex min-h-11 shrink-0 items-center"
          label={dict.brand.name}
        >
          <Logo size="md" />
        </HomeLink>

        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link href="/events" className={navLink}>
            {dict.nav.events}
          </Link>

          {/* Hidden below `sm` alongside Events: a signed-in admin who is also
              an approved photographer would otherwise push four links plus the
              language toggle and profile chip past 360px, which is a real
              phone width at Thai campus events. */}
          {showStudio && (
            <Link href="/studio" className={navLink}>
              {dict.nav.studio}
            </Link>
          )}

          {user?.role === "admin" && (
            <Link href="/admin" className={navLink}>
              {dict.nav.admin}
            </Link>
          )}

          <LocaleSwitcher locale={locale} label={dict.nav.switchLanguage} />

          {user ? (
            <Link
              href="/me"
              className="ml-1 flex min-h-11 items-center gap-2 rounded-pill py-1 pl-1 pr-3 text-slate transition-colors duration-200 hover:bg-cloud hover:text-green-700"
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
              /* `md`, not `sm`. `sm` is 38px, and this is the control every
                 logged-out visitor is most likely to reach for — the one place
                 the 44px floor in DESIGN.md §9 least deserved to be missed.
                 The comment on `sizes` in button.tsx said as much while this
                 call site went on asking for `sm` anyway. */
              className={buttonClass({
                variant: "secondary",
                size: "md",
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
