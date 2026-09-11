import type { Metadata } from "next";
import Link from "next/link";

import { DeleteAccountSection } from "@/components/profile/delete-account-section";
import { SavedFaceSection } from "@/components/profile/saved-face-section";
import { requireUser } from "@/lib/dal";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getMyFace } from "@/lib/queries/profile";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.profile.settingsTitle };
}

/**
 * `/me`, the destination `SiteHeader`'s avatar chip links to — settings for
 * the account itself (the saved face a search runs against, and deleting
 * the account outright), not the account's public-facing display. That now
 * lives on `/profile/[id]` (this account's own id), which is also where the
 * saved photos themselves — and hiding one event's group from other
 * viewers — are managed, right alongside how everyone else sees them.
 */
export default async function ProfilePage() {
  const user = await requireUser();
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const face = await getMyFace(user.id);

  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <h1 className="text-h1 font-bold">{dict.profile.settingsTitle}</h1>

      <Link
        href={`/profile/${user.id}`}
        className="mt-3 inline-block text-label font-medium text-green-700 underline underline-offset-4"
      >
        {dict.profile.viewProfile}
      </Link>

      <div className="mt-8 space-y-6">
        <SavedFaceSection dict={dict} locale={locale} face={face} />
        <DeleteAccountSection dict={dict} email={user.email} />
      </div>
    </section>
  );
}
