import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PortfolioGrid } from "@/components/profile/portfolio-grid";
import { SavedPhotosByEvent } from "@/components/profile/saved-photos-by-event";
import { Avatar } from "@/components/ui/avatar";
import {
  BookmarkIcon,
  CalendarIcon,
  CameraIcon,
  DownloadIcon,
  FaceScanIcon,
  PhotoIcon,
} from "@/components/ui/icon";
import { CountUp } from "@/components/ui/count-up";
import { getPhotographer, requireUser } from "@/lib/dal";
import { getDictionary, getLocale, t } from "@/lib/i18n";
import {
  getDownloadCount,
  getEventParticipationCount,
  getPhotographerProfileInfo,
  getPublicProfile,
} from "@/lib/queries/profile";
import { getPhotographerFaceCount, getPhotographerPortfolio } from "@/lib/queries/public";
import { getMySavedPhotosGroupedByEvent } from "@/lib/queries/saved-photos";
import { avatarRingClass, cn, enterDelay, formatDate, formatNumber } from "@/lib/utils";

const TABS = ["portfolio", "saved"] as const;
type Tab = (typeof TABS)[number];

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const viewer = await requireUser();
  const { id } = await params;
  const { tab } = await searchParams;
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  const profile = await getPublicProfile(id);
  if (!profile) notFound();

  const isOwner = viewer.id === profile.id;
  // Whether this account has an approved photographer profile — not the
  // same question as `profile.role === "photographer"`. `role` is one enum
  // value, so an approved photographer who is later promoted to admin has
  // it overwritten to `"admin"` even though the `photographer` row (and
  // every event it owns) is untouched — this page would otherwise hide a
  // real portfolio just because the account also happens to be an admin.
  const photographer = await getPhotographer(profile.id);
  const isPhotographer = photographer?.status === "approved";
  // An admin gets the photographer page shape too, whether or not they also
  // hold an approved photographer profile — a deliberate call, not a side
  // effect: the portfolio/stats tiles below just read zero for one who
  // never shot anything, the same honest-empty-state the rest of this page
  // already relies on.
  const showPhotographerLayout = isPhotographer || profile.role === "admin";
  // `canManageEvent` already gives an admin blanket authority over every
  // event that exists, private ones included — this just lets that same
  // authority reach the portfolio grid, instead of an admin needing the
  // event's own link to see work its owner marked private.
  const viewerIsAdmin = viewer.role === "admin";
  // A plain user has nothing to switch between — the saved-photos section is
  // the only one that ever applies to them, same as before there was a
  // second tab to pick from. There is no version of a portfolio for an
  // account that cannot create an event at all, so unlike the rest of this
  // page there is no empty state to fall back to here — the tab itself does
  // not exist for them. A photographer (or an admin) defaults to the
  // portfolio, the more public-facing of the two.
  const activeTab: Tab =
    !showPhotographerLayout ? "saved" : tab === "saved" ? "saved" : "portfolio";

  const [allGroups, photographerInfo, portfolio, faceCount, downloadCount, eventsJoined] =
    await Promise.all([
      getMySavedPhotosGroupedByEvent(profile.id, isOwner),
      isPhotographer ? getPhotographerProfileInfo(profile.id) : null,
      showPhotographerLayout ? getPhotographerPortfolio(profile.id, 24, viewerIsAdmin) : [],
      showPhotographerLayout ? getPhotographerFaceCount(profile.id, viewerIsAdmin) : 0,
      getDownloadCount(profile.id),
      getEventParticipationCount(profile.id),
    ]);
  // A visitor who isn't the account itself never even receives a hidden
  // group's data — read-only is enforced by what's sent, not just by which
  // controls `SavedPhotosByEvent` renders.
  const groups = isOwner ? allGroups : allGroups.filter((g) => !g.hidden);
  const savedPhotoCount = groups.reduce((sum, g) => sum + g.photos.length, 0);
  const totalPhotos = portfolio.reduce((sum, event) => sum + event.photoCount, 0);

  // The first three exist only for a photographer or an admin — a plain
  // user cannot create an event at all, so "0 events shot" would not be an
  // honest empty state, it would be a stat that can never once read
  // anything else. `statEventsJoined`/`statDownloads`/`savedPhotosTitle`
  // stay for everyone: participating and saving are things any account can
  // actually do.
  const stats = [
    ...(showPhotographerLayout
      ? [
          { label: dict.profile.statEvents, value: portfolio.length, Icon: CameraIcon },
          { label: dict.profile.statPhotos, value: totalPhotos, Icon: PhotoIcon },
          { label: dict.profile.statFaces, value: faceCount, Icon: FaceScanIcon },
        ]
      : []),
    { label: dict.profile.statEventsJoined, value: eventsJoined, Icon: CalendarIcon },
    { label: dict.profile.statDownloads, value: downloadCount, Icon: DownloadIcon },
    { label: dict.profile.savedPhotosTitle, value: savedPhotoCount, Icon: BookmarkIcon },
  ];

  const name = profile.name ?? dict.studio.searchesAnonymous;

  return (
    <section className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="enter flex items-center gap-4">
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

      {/* A photographer's bio and affiliation — the two fields on their
          application that actually mean something to someone reading their
          page, unlike `contactEmail`/`contactPhone`, which exist for an
          admin verifying them, not as a public "get in touch" surface.
          Affiliation always shows once there is a real photographer profile
          to read it off — "อิสระ" (independent) says something true about
          an account that never filled it in, where leaving the line out
          entirely would just read as a page still loading. */}
      {photographerInfo?.bio && (
        <p className="mt-4 max-w-prose text-body text-ink">{photographerInfo.bio}</p>
      )}
      {isPhotographer && (
        <p className="mt-2 flex items-center gap-1.5 text-label text-slate">
          <span className="font-medium text-ink">{dict.photographer.affiliation}:</span>
          {photographerInfo?.affiliation ? (
            // Links out to the directory of every affiliation rather than a
            // filtered view of just this one — `/affiliations` has no
            // per-group route yet, only the one list.
            <Link
              href="/affiliations"
              className="underline-offset-4 hover:text-green-700 hover:underline"
            >
              {photographerInfo.affiliation}
            </Link>
          ) : (
            dict.photographer.affiliationIndependent
          )}
        </p>
      )}

      {/* One card per number — a badged icon reads as this stat's own small
          credential rather than a caption tacked under a figure, and the
          soft card shadow (not just a ring) gives each one real depth
          instead of a flat outline. */}
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

      {/* A plain user has only one section, so there is nothing to switch
          between and no tab bar to show — see the note on `activeTab`. A
          photographer (or an admin) picks which of the two long sections is
          on screen instead of scrolling past whichever one they did not
          come for. */}
      {showPhotographerLayout && (
        <nav className="enter [--d:80ms] mt-10 flex flex-wrap gap-1.5" aria-label={dict.profile.portfolioTitle}>
          {TABS.map((key) => {
            const active = key === activeTab;
            return (
              <Link
                key={key}
                href={key === "portfolio" ? `/profile/${id}` : `/profile/${id}?tab=saved`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center whitespace-nowrap rounded-pill px-4 text-sm font-medium transition-colors duration-200",
                  active
                    ? "bg-green-600 text-paper"
                    : "text-slate hover:bg-cloud hover:text-green-700",
                )}
              >
                {key === "portfolio" ? dict.profile.portfolioTitle : dict.profile.savedPhotosTitle}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Visible only without a tab bar to already say which section this is
          — a plain user has no portfolio tab to switch away from, so this is
          the only label their saved photos ever get. */}
      <h2 className={cn("text-h3 font-semibold text-ink", showPhotographerLayout ? "sr-only" : "mt-8")}>
        {activeTab === "portfolio" ? dict.profile.portfolioTitle : dict.profile.savedPhotosTitle}
      </h2>

      {/* A private event stays out of this grid for anyone but an admin —
          `getPhotographerPortfolio`'s own `includePrivate` decides that at
          the query, the same rule the public events list and `/e/[code]`'s
          own access gate enforce for everyone else, so there is no separate
          check to forget here. `EventCard` badges whichever ones an admin
          does see, so a mixed grid never reads as if they were all public. */}
      {activeTab === "portfolio" &&
        (portfolio.length === 0 ? (
          <p className="enter mt-5 text-label text-slate">{dict.profile.portfolioEmpty}</p>
        ) : (
          <PortfolioGrid events={portfolio} dict={dict} locale={locale} />
        ))}

      {/* No card wrapper here — `SavedPhotosByEvent` now cards each event
          group on its own, and a card around a list of cards is the nested
          card `impeccable`'s craft floor refuses for good reason. */}
      {activeTab === "saved" && (
        <SavedPhotosByEvent dict={dict} locale={locale} groups={groups} isOwner={isOwner} />
      )}
    </section>
  );
}
