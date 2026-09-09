import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UsersIcon } from "@/components/ui/icon";
import { requireApprovedPhotographer } from "@/lib/dal";
import { getDictionary, getLocale, t } from "@/lib/i18n";
import { getMemberProfile } from "@/lib/queries/studio";
import { avatarRingClass, cn, formatDate, formatNumber } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { photographer } = await requireApprovedPhotographer();
  const { id } = await params;
  const member = await getMemberProfile(photographer.id, id);
  return { title: member?.name ?? member?.email ?? "" };
}

/**
 * A photographer's own view of one member — reached by tapping a name in the
 * "searches" or "downloads" lists on an event page. Scoped by
 * `getMemberProfile`, not by this route: a photographer only ever lands here
 * for someone who has actually searched or downloaded from one of their own
 * events, and 404s the same way whether the id is wrong or just not theirs
 * to see.
 *
 * Deliberately thin. This is not `/me` — a member's saved face is their own
 * and is never shown to anyone else, so there is nothing biometric here,
 * only who they are and how much they have used this photographer's events.
 */
export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { photographer } = await requireApprovedPhotographer();
  const { id } = await params;
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  const member = await getMemberProfile(photographer.id, id);
  if (!member) notFound();

  const name = member.name ?? member.email;
  const initial = name?.trim().charAt(0).toUpperCase();

  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="flex items-center gap-4">
        <span
          className={cn(
            "grid size-16 shrink-0 place-items-center overflow-hidden rounded-pill bg-green-50 text-green-700",
            avatarRingClass(member.role),
          )}
        >
          {member.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={member.image} alt="" className="h-full w-full object-cover" />
          ) : initial ? (
            <span className="font-display text-h3 font-semibold" aria-hidden>
              {initial}
            </span>
          ) : (
            <UsersIcon size={28} />
          )}
        </span>

        <div className="min-w-0">
          <h1 className="truncate text-h1 font-bold">
            {name ?? dict.studio.searchesAnonymous}
          </h1>
          {member.email && member.name && (
            <p className="truncate text-label text-slate">{member.email}</p>
          )}
        </div>
      </div>

      <p className="mt-3 text-caption text-slate">
        {t(dict.memberProfile.memberSince, {
          date: formatDate(member.createdAt, locale, {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        })}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-card bg-cloud p-5">
          <p className="text-label text-slate">{dict.memberProfile.searchesLabel}</p>
          <p className="tnum mt-1 font-display text-h2 font-bold text-ink">
            {formatNumber(member.searchCount, locale)}
          </p>
        </div>
        <div className="rounded-card bg-cloud p-5">
          <p className="text-label text-slate">{dict.memberProfile.downloadsLabel}</p>
          <p className="tnum mt-1 font-display text-h2 font-bold text-ink">
            {formatNumber(member.downloadCount, locale)}
          </p>
        </div>
      </div>
    </section>
  );
}
