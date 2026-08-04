import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { events } from "@/db/schema";
import { requireApprovedPhotographer } from "@/lib/dal";
import { eventQrSvg } from "@/lib/qr";

/**
 * The event's QR as a downloadable SVG.
 *
 * Behind the same ownership check as the studio page rather than served from
 * /public: the QR encodes the access code, which is the only gate on an
 * unlisted gallery. A file anyone could fetch by guessing an id would hand
 * that out.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/studio/events/[id]/qr">,
) {
  const { photographer } = await requireApprovedPhotographer();
  const { id } = await ctx.params;

  const [event] = await db
    .select({ code: events.accessCode, name: events.nameTh })
    .from(events)
    .where(and(eq(events.id, id), eq(events.ownerId, photographer.id)))
    .limit(1);

  if (!event) return new Response(null, { status: 404 });

  const svg = await eventQrSvg(event.code);
  const download = new URL(request.url).searchParams.get("download") === "1";

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // The filename carries the code, so a photographer with four events in
      // their downloads folder can tell which sign is which.
      ...(download
        ? {
            "Content-Disposition": `attachment; filename="findkudae-${event.code}.svg"`,
          }
        : {}),
      // Never cached by a shared proxy: this is per-event private material.
      "Cache-Control": "private, no-store",
    },
  });
}
