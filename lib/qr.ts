import "server-only";

import QRCode from "qrcode";

/**
 * The public address of an event.
 *
 * One identifier: the six-character code is both what a visitor types and what
 * the QR resolves to, so the person who scans and the person who reads the
 * sign land on exactly the same page.
 */
export function eventUrl(code: string): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/+$/, "");
  return `${base}/e/${code}`;
}

/**
 * The event's QR, as an SVG string.
 *
 * SVG rather than a PNG data URI: this gets printed. A poster at a booth is
 * A4 or larger and a raster code at any fixed pixel size either bloats the
 * page or prints soft, whereas the vector is a few hundred bytes and stays
 * crisp at any size a photographer sends to a print shop.
 *
 * Error correction level `M` recovers about 15% of the code. That is the level
 * worth having outdoors: a printed sign at a Thai campus event gets rained on,
 * taped over at a corner and photographed at an angle, and `L` gives up on all
 * three. Going higher would make the modules smaller at the same physical
 * size, which is the opposite of what a phone camera across a table needs.
 */
export async function eventQrSvg(code: string): Promise<string> {
  return QRCode.toString(eventUrl(code), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: {
      // The brand teal on white. Scanners need contrast, not neutrality, and
      // #00706b against white measures far past anything a decoder needs.
      dark: "#00706b",
      light: "#ffffff",
    },
  });
}
