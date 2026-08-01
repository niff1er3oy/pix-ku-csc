import type { Metadata } from "next";

import { getDictionary } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.privacy.title, description: dict.privacy.lede };
}

/**
 * The PDPA policy. PRODUCT.md records this as a legal obligation rather than
 * an optional page, and the one-line notice above every footer links straight
 * here, so it ships with the first public build.
 *
 * Every claim below describes what the code actually does — per-event
 * Rekognition collections, selfies discarded after an anonymous search, a
 * single deletable reference image, hashed IPs. Do not add a promise here
 * before the behaviour exists.
 */
export default async function PrivacyPage() {
  const dict = await getDictionary();

  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <h1 className="text-h1 font-bold">{dict.privacy.title}</h1>
      <p className="mt-5 text-body-lg text-slate">{dict.privacy.lede}</p>

      <div className="mt-12 space-y-10">
        {dict.privacy.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-h3">{section.heading}</h2>
            <p className="mt-2.5 text-body leading-relaxed text-slate">
              {section.body}
            </p>
          </section>
        ))}
      </div>

      {/* Deliberately a visible gap, not invented contact details. PRODUCT.md
          forbids fabricating facts, and a data-controller contact is exactly
          the kind a visitor might act on. */}
      <section className="mt-14 rounded-card border-2 border-dashed border-edge bg-cloud p-6">
        <h2 className="text-h3">{dict.privacy.contactHeading}</h2>
        <p className="mt-2.5 text-body leading-relaxed text-slate">
          {dict.privacy.contactPlaceholder}
        </p>
      </section>
    </article>
  );
}
