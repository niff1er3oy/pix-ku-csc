import type { Metadata } from "next";

import { SavedFaceSection } from "@/components/profile/saved-face-section";
import { SavedPhotosSection } from "@/components/profile/saved-photos-section";
import { requireUser } from "@/lib/dal";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getMyFace } from "@/lib/queries/profile";
import { getMySavedPhotos } from "@/lib/queries/saved-photos";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.profile.title };
}

/**
 * `/me`, the destination `SiteHeader`'s avatar chip already links to.
 * Saved face and saved photos are here so far — history and consent
 * withdrawal have dictionary strings ready (see `profile.*` in
 * `dictionaries.ts`) but no page yet.
 */
export default async function ProfilePage() {
  const user = await requireUser();
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const [face, savedPhotos] = await Promise.all([
    getMyFace(user.id),
    getMySavedPhotos(user.id),
  ]);

  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <h1 className="text-h1 font-bold">{dict.profile.title}</h1>

      <div className="mt-8 space-y-6">
        <SavedFaceSection dict={dict} locale={locale} face={face} />
        <SavedPhotosSection dict={dict} photos={savedPhotos} locale={locale} />
      </div>
    </section>
  );
}
