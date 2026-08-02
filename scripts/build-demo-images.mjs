/**
 * Derives responsive WebP from the three source demo photographs.
 *
 *   node scripts/build-demo-images.mjs
 *
 * The originals are 2048x1365 JPEGs totalling 1.76 MB, and the landing page
 * never renders them wider than ~544px on a laptop or ~320px on a phone. That
 * is roughly 17x the weight of the HTML document, shipped to a product whose
 * stated operating context is "a phone at an event on a poor signal".
 *
 * Outputs `<name>-{640,960,1280}.webp` beside the sources. Re-run after
 * replacing any scan-*.jpg. Safe to run repeatedly.
 */

import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const DIR = path.join(process.cwd(), "public", "demo");
const WIDTHS = [640, 960, 1280];

const files = (await readdir(DIR)).filter((f) => /^scan-\d+\.jpg$/.test(f));
if (files.length === 0) throw new Error(`No scan-*.jpg found in ${DIR}`);

let sourceBytes = 0;
let outputBytes = 0;

for (const file of files.sort()) {
  const source = path.join(DIR, file);
  sourceBytes += (await stat(source)).size;
  const base = file.replace(/\.jpg$/, "");

  for (const width of WIDTHS) {
    const out = path.join(DIR, `${base}-${width}.webp`);
    await sharp(source)
      .resize({ width, withoutEnlargement: true })
      // 78 is the point where these crowd shots stop losing anything visible;
      // the face boxes sit on top as DOM, so the photo never has to carry fine
      // detail the overlay depends on.
      .webp({ quality: 78, effort: 5 })
      .toFile(out);
    outputBytes += (await stat(out)).size;
    console.log(`  ${path.basename(out)}  ${kb((await stat(out)).size)}`);
  }
}

console.log(
  `\nsources ${kb(sourceBytes)} → ${WIDTHS.length} widths totalling ${kb(outputBytes)}` +
    `\nlargest single width a browser will pick: ${kb(outputBytes / WIDTHS.length)} average`,
);

function kb(bytes) {
  return `${Math.round(bytes / 1024)} KB`;
}
