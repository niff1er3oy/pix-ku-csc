import { CreateAffiliationForm } from "@/components/admin/create-affiliation-form";
import { DeleteAffiliationButton } from "@/components/admin/delete-affiliation-button";
import { CopyLinkButton } from "@/components/studio/copy-link-button";
import { t, type Dictionary } from "@/lib/i18n";
import type { AdminAffiliationRow } from "@/lib/queries/affiliations";
import { enterDelay, formatDate, formatNumber } from "@/lib/utils";

/**
 * The "สังกัด" tab's body — create form plus the list, everything the old
 * standalone `/admin/affiliations` page held once its own heading, back
 * link, and page-level lede are stripped out. Those now live one level up,
 * in `Directory`'s own shared section header, since this is a tab inside the
 * account directory rather than a page of its own.
 */
export function AffiliationsPanel({
  dict,
  locale,
  affiliations,
}: {
  dict: Dictionary;
  locale: "th" | "en";
  affiliations: AdminAffiliationRow[];
}) {
  return (
    <div className="mt-6">
      <p className="max-w-prose text-body text-slate">
        {dict.adminAffiliationsPage.lede}
      </p>

      <CreateAffiliationForm dict={dict} />

      {affiliations.length === 0 ? (
        <p className="mt-10 rounded-card bg-cloud px-6 py-12 text-center text-body text-slate">
          {dict.adminAffiliationsPage.empty}
        </p>
      ) : (
        <ul className="mt-10 space-y-3">
          {affiliations.map((affiliation, i) => (
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
    </div>
  );
}
