import type { Metadata } from "next";
import Link from "next/link";

import { DeleteAffiliationButton } from "@/components/admin/delete-affiliation-button";
import { CopyLinkButton } from "@/components/studio/copy-link-button";
import { Button } from "@/components/ui/button";
import { createAffiliation } from "@/lib/actions/affiliations";
import { requireRole } from "@/lib/dal";
import { getDictionary, getLocale, t } from "@/lib/i18n";
import { getAllAffiliations } from "@/lib/queries/affiliations";
import { safely } from "@/lib/queries/public";
import { enterDelay, formatDate, formatNumber } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.adminAffiliationsPage.title };
}

/**
 * Where every affiliation starts. An admin types a name here and gets a
 * code back — after that, the group runs itself: members join with the
 * code, add and remove each other, and manage every event created under it
 * together (see `/studio/affiliation`). This page is only ever the front
 * door, not something an admin keeps returning to run day to day.
 */
export default async function AdminAffiliationsPage() {
  await requireRole("admin");
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const affiliationList = await safely(() => getAllAffiliations(), []);

  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <Link
        href="/admin"
        className="inline-flex min-h-11 items-center text-label font-medium text-green-700 hover:underline"
      >
        ← {dict.admin.title}
      </Link>

      <h1 className="mt-4 text-h1 font-bold">{dict.adminAffiliationsPage.title}</h1>
      <p className="mt-3 max-w-prose text-body text-slate">
        {dict.adminAffiliationsPage.lede}
      </p>

      <form
        action={createAffiliation}
        className="mt-8 flex max-w-md flex-wrap items-end gap-2"
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="name" className="block text-label font-medium text-ink">
            {dict.adminAffiliationsPage.createNameLabel}
          </label>
          <input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={120}
            className="mt-1.5 h-[46px] w-full rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 focus:ring-2 focus:ring-green-600"
          />
        </div>
        <Button type="submit" size="md">
          {dict.adminAffiliationsPage.createSubmit}
        </Button>
      </form>

      {affiliationList.length === 0 ? (
        <p className="mt-10 rounded-card bg-cloud px-6 py-12 text-center text-body text-slate">
          {dict.adminAffiliationsPage.empty}
        </p>
      ) : (
        <ul className="mt-10 space-y-3">
          {affiliationList.map((affiliation, i) => (
            <li
              key={affiliation.id}
              className={`enter flex flex-wrap items-center justify-between gap-3 rounded-card bg-paper p-4 shadow-[var(--shadow-card)] ${enterDelay(i)}`}
            >
              <div className="min-w-0">
                <p className="truncate font-display text-h3 font-semibold text-ink">
                  {affiliation.name}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-slate">
                  <span>
                    {t(dict.adminAffiliationsPage.memberCount, {
                      count: formatNumber(affiliation.memberCount, locale),
                    })}
                  </span>
                  <span>
                    {dict.adminAffiliationsPage.createdAt}{" "}
                    {formatDate(affiliation.createdAt, locale)}
                  </span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="tnum rounded-pill bg-cloud px-3 py-1.5 text-label tracking-[0.2em] text-ink">
                  {affiliation.joinCode}
                </span>
                <CopyLinkButton
                  value={affiliation.joinCode}
                  label={dict.affiliationStudio.copyCode}
                  copiedLabel={dict.affiliationStudio.copyCodeCopied}
                />
                <DeleteAffiliationButton
                  id={affiliation.id}
                  label={dict.adminAffiliationsPage.deleteButton}
                  confirmMessage={dict.adminAffiliationsPage.deleteConfirm}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
