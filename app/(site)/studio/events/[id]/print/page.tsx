import { notFound } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { requireApprovedPhotographer } from "@/lib/dal";
import { getDictionary, t } from "@/lib/i18n";
import { eventQrSvg, eventUrl } from "@/lib/qr";
import { getMyEvent } from "@/lib/queries/studio";

/**
 * The sheet a photographer prints and tapes to the booth.
 *
 * Everything a person standing in front of it needs, and nothing else: what
 * this is for, the QR, and the code in case their camera will not focus. The
 * site chrome is gone — `print:hidden` on the header and footer would still
 * leave them on screen, and this page is only ever opened to be printed.
 *
 * Sized for A4 in portrait. The QR is 80mm across because a phone camera at
 * arm's length across a table needs the modules to be a couple of millimetres
 * each, and a code that has to be walked up to is a code that gets skipped.
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
  const url = eventUrl(event.accessCode);

  return (
    <main
      id="main"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 overflow-auto bg-paper px-8 py-12 text-center print:static print:h-auto"
    >
      <Logo size="lg" />

      <div>
        <h1 className="text-h1 font-bold">{dict.studio.printScanTitle}</h1>
        <p className="mt-2 text-body-lg text-slate">{event.nameTh}</p>
      </div>

      {/* 80mm on paper; on screen it just fills the column. */}
      <div
        className="w-[min(80mm,70vw)] [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: qr }}
      />

      <div>
        <p className="tnum font-display text-brand font-bold tracking-[0.15em] text-green-700">
          {event.accessCode}
        </p>
        <p className="mt-4 max-w-md text-body text-slate">
          {t(dict.studio.printScanBody, { url })}
        </p>
      </div>

      {/* Not on the paper — it exists to trigger the print dialogue and would
          be a grey rectangle on the sheet otherwise. */}
      <a
        href="#"
        className="rounded-pill bg-green-600 px-6 py-3 font-display text-label font-semibold text-paper print:hidden"
        // A plain link with no JavaScript cannot open the print dialogue, so
        // this is the one control on the page that needs it. Without JS the
        // browser's own File → Print still works, and the sheet is already
        // laid out for it.
        data-print
      >
        {dict.studio.printButton}
      </a>

      <script
        dangerouslySetInnerHTML={{
          __html: `document.querySelector('[data-print]')?.addEventListener('click',e=>{e.preventDefault();print()})`,
        }}
      />
    </main>
  );
}
