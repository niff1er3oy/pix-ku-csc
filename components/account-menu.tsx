import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { SettingsIcon, SignOutIcon, UserIcon } from "@/components/ui/icon";
import { signOutAction } from "@/lib/actions/auth";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * The avatar chip's own disclosure, `<details>` for the same reason
 * `NotificationBell` is: signing out is one form submit, no client
 * component required to get there.
 *
 * The chip used to be a bare `Link` straight to `/profile/[id]` — now the
 * first click opens this instead, since nothing else in the header reaches
 * `signOutAction` or `/me`. The profile and settings links inside make up
 * the one click this adds back.
 */
export function AccountMenu({
  dict,
  userId,
  image,
}: {
  dict: Dictionary;
  userId: string;
  image: string | null;
}) {
  return (
    <details className="relative">
      <summary
        aria-label={dict.nav.profile}
        className="ml-1 flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-pill py-1 pl-1 pr-3 text-slate transition-colors duration-200 hover:bg-cloud hover:text-green-700"
      >
        <Avatar src={image} size={30} />
        <span className="hidden sm:inline">{dict.nav.profile}</span>
      </summary>

      <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-card bg-paper p-1.5 shadow-lift ring-1 ring-edge">
        <Link
          href={`/profile/${userId}`}
          className="flex min-h-11 items-center gap-2.5 rounded-field px-3 text-label text-ink transition-colors duration-200 hover:bg-cloud"
        >
          <UserIcon size={18} className="text-slate" />
          {dict.nav.profile}
        </Link>

        <Link
          href="/me"
          className="flex min-h-11 items-center gap-2.5 rounded-field px-3 text-label text-ink transition-colors duration-200 hover:bg-cloud"
        >
          <SettingsIcon size={18} className="text-slate" />
          {dict.nav.settings}
        </Link>

        <div className="my-1 border-t border-edge" />

        <form action={signOutAction}>
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-2.5 rounded-field px-3 text-left text-label text-danger transition-colors duration-200 hover:bg-danger/10"
          >
            <SignOutIcon size={18} />
            {dict.nav.signOut}
          </button>
        </form>
      </div>
    </details>
  );
}
