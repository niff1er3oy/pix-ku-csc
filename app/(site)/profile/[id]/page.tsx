import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SavedPhotosByEvent } from "@/components/profile/saved-photos-by-event";
import { Avatar } from "@/components/ui/avatar";
import { requireUser } from "@/lib/dal";
import { getDictionary, getLocale, t } from "@/lib/i18n";
import { getPublicProfile } from "@/lib/queries/profile";
import { getMySavedPhotosGroupedByEvent } from "@/lib/queries/saved-photos";
import { avatarRingClass, formatDate } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await getPublicProfile(id);
  return { title: profile?.name ?? "" };
}

const ROLE_LABEL = {
  user: "roleUser",
  photographer: "rolePhotographer",
  admin: "roleAdmin",
} as const;

/**
 * Any signed-in visitor's view of another account — reached by tapping a
 * name in the studio's "searches"/"downloads" lists, or a user viewing
 * their own via `/me`'s "view my profile" link. Not gated to a
 * photographer's own members anymore: the whole point of a saved-photos
 * showcase is that it is meant to be seen.
 *
 * `isOwner` is what actually decides how much of this a given viewer gets —
 * everyone sees identity and the events whose group hasn't been hidden;
 * only the account itself also sees its hidden groups and the controls to
 * manage them, via the same `SavedPhotosByEvent` component `/me` used to
 * render (now this page's own, not `/me`'s).
 */
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireUser();
  const { id } = await params;
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  const profile = await getPublicProfile(id);
  if (!profile) notFound();

  const isOwner = viewer.id === profile.id;
  const allGroups = await getMySavedPhotosGroupedByEvent(profile.id);
  // A visitor who isn't the account itself never even receives a hidden
  // group's data — read-only is enforced by what's sent, not just by which
  // controls `SavedPhotosByEvent` renders.
  const groups = isOwner ? allGroups : allGroups.filter((g) => !g.hidden);

  const name = profile.name ?? dict.studio.searchesAnonymous;

  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="flex items-center gap-4">
        <Avatar src={profile.image} size={64} className={avatarRingClass(profile.role)} />

        <div className="min-w-0">
          <h1 className="truncate text-h1 font-bold">{name}</h1>
          <p className="text-label text-slate">{dict.profile[ROLE_LABEL[profile.role]]}</p>
        </div>
      </div>

      <p className="mt-3 text-caption text-slate">
        {t(dict.profile.memberSince, {
          date: formatDate(profile.createdAt, locale, {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        })}
      </p>

      {isOwner && (
        <Link
          href="/me"
          className="mt-4 inline-block text-label font-medium text-green-700 underline underline-offset-4"
        >
          {dict.profile.settingsTitle}
        </Link>
      )}

      <div className="mt-8 rounded-card bg-cloud p-5 sm:p-6">
        <h2 className="text-h3 font-semibold text-ink">{dict.profile.savedPhotosTitle}</h2>
        <SavedPhotosByEvent dict={dict} locale={locale} groups={groups} isOwner={isOwner} />
      </div>
    </section>
  );
}
