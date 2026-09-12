import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PortfolioGrid } from "@/components/profile/portfolio-grid";
import { Avatar } from "@/components/ui/avatar";
import { CameraIcon, FaceScanIcon, PhotoIcon, UsersIcon } from "@/components/ui/icon";
import { CountUp } from "@/components/ui/count-up";
import { getDictionary, getLocale, t } from "@/lib/i18n";
import {
  getAffiliationFaceCount,
  getAffiliationMembers,
  getAffiliationPortfolio,
  getPublicAffiliation,
} from "@/lib/queries/affiliations";
import { safely } from "@/lib/queries/public";
import { cn, enterDelay, formatDate, formatNumber } from "@/lib/utils";

const TABS = ["portfolio", "members"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const affiliation = await getPublicAffiliation(id).catch(() => null);
  return { title: affiliation?.name ?? "" };
}

/**
 * An affiliation's own public page — the same structure `/profile/[id]`
 * gives a photographer (identity header, stat tiles, a tab bar switching one
 * content area), just for the group rather than one person: its picture and
 * name, aggregate stats across every member's published work, that work
 * itself, and its full roster behind the other tab. Reachable with no
 * session at all, the same as the `/affiliations` index it's linked from —
 * there is no owner-only exception here the way an admin gets on a
 * photographer's own profile, because there is no private side of an
 * affiliation to gate; everything this page reads is already scoped to
 * public, approved events.
 */
export default async function AffiliationProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);

  const affiliation = await getPublicAffiliation(id);
  if (!affiliation) notFound();

  const activeTab: Tab = tab === "members" ? "members" : "portfolio";

  const [members, portfolio, faceCount] = await Promise.all([
    safely(() => getAffiliationMembers(id), []),
    safely(() => getAffiliationPortfolio(id, 24), []),
    safely(() => getAffiliationFaceCount(id), 0),
  ]);

  const totalPhotos = portfolio.reduce((sum, event) => sum + event.photoCount, 0);

  const stats = [
    { label: dict.profile.statEvents, value: portfolio.length, Icon: CameraIcon },
    { label: dict.profile.statPhotos, value: totalPhotos, Icon: PhotoIcon },
    { label: dict.profile.statFaces, value: faceCount, Icon: FaceScanIcon },
    { label: dict.affiliationStudio.membersTitle, value: members.length, Icon: UsersIcon },
  ];

  return (
    <section className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="enter flex items-center gap-4">
        <Avatar
          src={affiliation.imagePath ? `/api/media/${affiliation.imagePath}` : null}
          size={64}
        />
        <div className="min-w-0">
          <h1 className="truncate text-h1 font-bold">{affiliation.name}</h1>
          <p className="text-label text-slate">{dict.affiliationStudio.title}</p>
        </div>
      </div>

      <p className="mt-3 text-caption text-slate">
        {t(dict.affiliationsPage.createdLabel, {
          date: formatDate(affiliation.createdAt, locale, {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        })}
      </p>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat, i) => (
          <li
            key={stat.label}
            className={`enter rounded-card bg-paper p-4 shadow-[var(--shadow-card)] ${enterDelay(i)}`}
          >
            <span className="grid size-9 place-items-center rounded-pill bg-green-50 text-green-700">
              <stat.Icon size={18} />
            </span>
            <p className="tnum mt-3 font-display text-h2 font-bold text-ink">
              <CountUp
                value={stat.value}
                formatted={formatNumber(stat.value, locale)}
                delayMs={i * 100}
              />
            </p>
            <p className="mt-1 text-caption text-slate">{stat.label}</p>
          </li>
        ))}
      </ul>

      <nav
        className="enter [--d:80ms] mt-10 flex flex-wrap gap-1.5"
        aria-label={dict.profile.portfolioTitle}
      >
        {TABS.map((key) => {
          const active = key === activeTab;
          return (
            <Link
              key={key}
              href={key === "portfolio" ? `/affiliations/${id}` : `/affiliations/${id}?tab=members`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center whitespace-nowrap rounded-pill px-4 text-sm font-medium transition-colors duration-200",
                active
                  ? "bg-green-600 text-paper"
                  : "text-slate hover:bg-cloud hover:text-green-700",
              )}
            >
              {key === "portfolio" ? dict.profile.portfolioTitle : dict.affiliationStudio.membersTitle}
            </Link>
          );
        })}
      </nav>

      <h2 className="sr-only">
        {activeTab === "portfolio" ? dict.profile.portfolioTitle : dict.affiliationStudio.membersTitle}
      </h2>

      {activeTab === "portfolio" &&
        (portfolio.length === 0 ? (
          <p className="enter mt-5 text-label text-slate">{dict.profile.portfolioEmpty}</p>
        ) : (
          <PortfolioGrid events={portfolio} dict={dict} locale={locale} />
        ))}

      {activeTab === "members" &&
        (members.length === 0 ? (
          <p className="enter mt-5 text-label text-slate">{dict.affiliationsPage.membersEmpty}</p>
        ) : (
          <ul className="enter mt-5 flex flex-wrap gap-3">
            {members.map((member) => (
              <li key={member.photographerId}>
                <Link
                  href={`/profile/${member.userId}`}
                  className="flex items-center gap-2 rounded-pill bg-cloud py-1.5 pl-1.5 pr-3 text-label text-ink transition-colors duration-200 hover:bg-green-50 hover:text-green-700"
                >
                  <Avatar src={member.image} size={28} />
                  <span className="truncate">{member.displayName}</span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
