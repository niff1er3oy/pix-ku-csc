import "server-only";

import { access } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

/** Normalised 0-100 box, measured as a percentage of the photo. */
export type DemoFace = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** The single box per photo that resolves to a match. */
  you?: boolean;
};

export type DemoPhoto = {
  src: string;
  faces: DemoFace[];
};

/**
 * Illustration for the landing page, not system output.
 *
 * These boxes were placed by hand against the three supplied photographs to
 * show what the product does; nothing here ran through Rekognition. Keeping
 * them as data rather than baked-in overlays means the caption stays honest
 * and the whole demonstration can be swapped or removed in one place.
 */
const DEMO_PHOTOS: DemoPhoto[] = [
  {
    src: "/demo/scan-1.jpg",
    faces: [
      { x: 15.5, y: 50.5, w: 4.6, h: 7.2 },
      { x: 23.4, y: 49.5, w: 4.6, h: 7.2 },
      { x: 38.2, y: 48.5, w: 4.6, h: 7.2 },
      { x: 46.4, y: 43.5, w: 4.6, h: 7.2, you: true },
      { x: 52.4, y: 46.0, w: 4.6, h: 7.2 },
      { x: 68.8, y: 44.0, w: 5.0, h: 7.6 },
      { x: 81.5, y: 45.0, w: 4.6, h: 7.2 },
    ],
  },
  {
    src: "/demo/scan-2.jpg",
    faces: [
      { x: 0.5, y: 50.0, w: 4.2, h: 7.0 },
      { x: 26.4, y: 44.5, w: 4.6, h: 7.2 },
      { x: 41.0, y: 47.0, w: 4.8, h: 7.4, you: true },
      { x: 47.8, y: 47.5, w: 4.6, h: 7.2 },
      { x: 64.0, y: 46.0, w: 4.8, h: 7.4 },
      { x: 90.2, y: 50.5, w: 4.6, h: 7.2 },
    ],
  },
  {
    src: "/demo/scan-3.jpg",
    faces: [
      { x: 35.8, y: 22.0, w: 4.0, h: 6.2 },
      { x: 17.0, y: 27.5, w: 4.4, h: 6.8 },
      { x: 47.5, y: 29.0, w: 4.4, h: 6.8, you: true },
      { x: 53.8, y: 28.5, w: 4.4, h: 6.8 },
      { x: 73.5, y: 48.5, w: 4.4, h: 6.8 },
      { x: 55.5, y: 63.5, w: 4.4, h: 6.8 },
    ],
  },
];

/** Widths emitted by scripts/build-demo-images.mjs. */
const DEMO_WIDTHS = [640, 960, 1280];

/**
 * Responsive WebP for a demo photograph.
 *
 * The 2048px JPEGs are the archive copy; nothing on the page renders them
 * wider than ~544px. Serving the original was 1.76 MB on a landing page whose
 * audience is on venue wifi — the 640 variants come to 229 KB for all three.
 *
 * Lives here rather than beside each `<img>` so the width list has one home.
 */
export function demoSrcSet(src: string): string {
  const base = src.replace(/\.jpg$/, "");
  return DEMO_WIDTHS.map((w) => `${base}-${w}.webp ${w}w`).join(", ");
}

/**
 * Only returns photos whose files are actually on disk. The three JPEGs are
 * supplied separately, so until they land the hero renders its plain layout
 * rather than a row of broken images.
 */
export const getDemoPhotos = cache(async (): Promise<DemoPhoto[]> => {
  const present = await Promise.all(
    DEMO_PHOTOS.map(async (photo) => {
      try {
        await access(path.join(process.cwd(), "public", photo.src));
        return photo;
      } catch {
        return null;
      }
    }),
  );

  return present.filter((photo): photo is DemoPhoto => photo !== null);
});
