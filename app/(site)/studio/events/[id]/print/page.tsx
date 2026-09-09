import { notFound } from "next/navigation";

import { HomeLink } from "@/components/brand/home-link";
import { Logo } from "@/components/brand/logo";
import { PrintButton } from "@/components/studio/print-button";
import { requireApprovedPhotographer } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n";
import { eventQrSvg } from "@/lib/qr";
import { getMyEvent } from "@/lib/queries/studio";

/**
 * The sheet a photographer prints and tapes to the booth.
 *
 * Everything a person standing in front of it needs, and nothing else: what
 * this is for, the QR, and the code in case their camera will not focus. The
 * site chrome is gone — `print:hidden` on the header and footer would still
 * leave them on screen, and this page is only ever opened to be printed.
 *
 * Sized for A4 in portrait. The QR is 110mm across because a phone camera at
 * arm's length across a table needs the modules to be a couple of millimetres
 * each, and a code that has to be walked up to is a code that gets skipped.
 *
 * On screen the sheet sits as a paper card on a tinted canvas — a print
 * preview, not the print itself — so a photographer can tell at a glance
 * whether it looks right before spending the page. Every `print:` class
 * below exists to undo that framing: no card, no shadow, no canvas, just
 * the content an A4 sheet actually needs, because none of the preview
 * chrome is real once it is on paper.
 */
export default async function PrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { photographer } = await requireApprovedPhotographer();
  const { id } = await params;
  const dict = await getDictionary();

  const event = await getMyEvent(photographer.id, id);
  if (!event) notFound();

  const qr = await eventQrSvg(event.accessCode);

  return (
    <main
      id="main"
      className="fixed inset-0 z-50 overflow-auto bg-cloud print:static print:h-auto print:bg-paper"
    >
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-8 px-6 py-12 text-center print:min-h-0 print:max-w-none print:gap-10 print:px-0 print:py-16">
        <HomeLink
          className="enter inline-flex min-h-11 shrink-0 items-center"
          label={dict.brand.name}
        >
          <Logo size="lg" />
        </HomeLink>

        <div className="enter" style={{ "--d": "60ms" } as React.CSSProperties}>
          <h1 className="text-h1 font-bold">{dict.studio.printScanTitle}</h1>
          <p className="mt-2 text-body-lg text-slate">{event.nameTh}</p>
        </div>

        {/* Screen-only framing — `eventQrSvg` already bakes its own quiet
            zone into the SVG's margin, so this card is purely how the
            preview presents it, not something the scan depends on. */}
        <div
          className="enter rounded-card bg-paper p-6 shadow-[var(--shadow-lift)] ring-1 ring-edge print:rounded-none print:p-0 print:shadow-none print:ring-0"
          style={{ "--d": "120ms" } as React.CSSProperties}
        >
          {/* 110mm on paper; on screen it just fills the column. */}
          <div
            className="w-[min(110mm,80vw)] [&>svg]:h-auto [&>svg]:w-full print:w-[110mm]"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
        </div>

        <div className="enter" style={{ "--d": "180ms" } as React.CSSProperties}>
          <p className="text-label font-medium leading-none text-slate">
            {dict.event.accessCodeLabel}
          </p>
          <p className="tnum mt-0.5 font-display text-brand font-bold tracking-[0.15em] text-green-700">
            {event.accessCode}
          </p>
        </div>

        {/* Not on the paper — it exists to trigger the print dialogue and
            would be a grey rectangle on the sheet otherwise. */}
        <PrintButton
          label={dict.studio.printButton}
          className="enter rounded-pill bg-green-600 px-6 py-3 font-display text-label font-semibold text-paper transition-colors duration-200 hover:bg-green-700 print:hidden"
          style={{ "--d": "240ms" } as React.CSSProperties}
        />
      </div>
    </main>
  );
}
