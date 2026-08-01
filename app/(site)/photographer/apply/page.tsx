import type { Metadata } from "next";
import Link from "next/link";

import { PhotographerApplyForm } from "@/components/photographer/apply-form";
import { ButtonLink } from "@/components/ui/button";
import { getPhotographer, getSessionUser } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.photographer.applyTitle };
}

/**
 * One page covering all four states an applicant can be in: signed out,
 * not yet applied, waiting, and rejected. Splitting them across routes would
 * mean a photographer checking back has to remember which URL they were on.
 */
export default async function PhotographerApplyPage() {
  const [dict, user] = await Promise.all([getDictionary(), getSessionUser()]);
  const existing = user ? await getPhotographer(user.id) : null;

  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <h1 className="text-h1 font-bold">{dict.photographer.applyTitle}</h1>
      <p className="mt-4 text-body-lg text-slate">
        {dict.photographer.applyLede}
      </p>

      {!user && (
        <div className="mt-10 rounded-card bg-cloud p-6">
          <p className="text-body text-slate">{dict.auth.signInLede}</p>
          <ButtonLink
            href="/signin?next=/photographer/apply"
            className="mt-5"
            size="lg"
          >
            {dict.auth.signInGoogle}
          </ButtonLink>
        </div>
      )}

      {user && existing?.status === "pending" && (
        <div className="mt-10 rounded-card bg-lime-100 p-6">
          <p className="font-display text-h3 text-green-950">
            {dict.photographer.statusPending}
          </p>
          <p className="mt-2 text-body text-green-900">
            {dict.photographer.statusPendingBody}
          </p>
        </div>
      )}

      {user && existing?.status === "approved" && (
        <div className="mt-10 rounded-card bg-green-50 p-6">
          <p className="font-display text-h3 text-green-950">
            {dict.admin.approved}
          </p>
          <ButtonLink href="/studio" className="mt-5">
            {dict.nav.studio}
          </ButtonLink>
        </div>
      )}

      {user && existing?.status === "rejected" && (
        <div className="mt-10 rounded-card bg-cloud p-6">
          <p className="font-display text-h3">
            {dict.photographer.statusRejected}
          </p>
          {existing.rejectionReason && (
            <p className="mt-2 text-body text-slate">
              <strong className="font-semibold text-ink">
                {dict.photographer.statusRejectedReason}:
              </strong>{" "}
              {existing.rejectionReason}
            </p>
          )}
        </div>
      )}

      {user && !existing && <PhotographerApplyForm dict={dict} />}

      <p className="mt-10 text-label text-slate">
        <Link
          href="/privacy"
          className="font-medium text-green-700 underline underline-offset-4"
        >
          {dict.legal.privacyTitle}
        </Link>
      </p>
    </section>
  );
}
