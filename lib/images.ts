import "server-only";

import sharp, { type Metadata } from "sharp";

import type { WatermarkPosition } from "@/db/schema";

/** Rekognition rejects image bytes over 5 MB. Leave headroom for overhead. */
const REKOGNITION_MAX_BYTES = 4_500_000;
const DETECTION_MAX_EDGE = 2560;
const PREVIEW_MAX_EDGE = 2000;
const THUMB_MAX_EDGE = 640;

export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_SELFIE_BYTES = 10 * 1024 * 1024;
export const MAX_COVER_BYTES = 10 * 1024 * 1024;
export const MAX_WATERMARK_LOGO_BYTES = 3 * 1024 * 1024;

/** A cover is shown at card size and as a page header; 1600px covers both. */
const COVER_MAX_EDGE = 1600;
/** A watermark logo is composited at a fraction of the photo's width — see
 *  `applyWatermark` — so it never needs to be photo-sized itself. */
const WATERMARK_LOGO_MAX_EDGE = 800;

/**
 * The event cover, as one WebP.
 *
 * Deliberately not `buildDerivatives`. That produces three outputs including a
 * Rekognition detection copy, and a cover is never searched — no face is ever
 * indexed from it, and running one through face detection would be processing
 * biometric data nobody consented to. One decode, one file.
 */
export async function buildCoverImage(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize({
      width: COVER_MAX_EDGE,
      height: COVER_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();
}

/**
 * A photographer's uploaded watermark logo, re-encoded rather than stored
 * as-is. `applyWatermark` composites this straight onto every download, so
 * a file sharp cannot decode has to be caught here — at settings-save time,
 * in front of the photographer — rather than the first time a visitor's
 * download silently comes back unmarked.
 */
export async function buildWatermarkLogo(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "none" })
    .resize({
      width: WATERMARK_LOGO_MAX_EDGE,
      height: WATERMARK_LOGO_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
}

export type Derivatives = {
  width: number;
  height: number;
  capturedAt: Date | null;
  preview: Buffer;
  thumb: Buffer;
  /** Downscaled copy sent to Rekognition, guaranteed under the 5 MB limit. */
  detection: Buffer;
};

/**
 * One decode, three outputs. The detection copy is why this app needs no S3:
 * Rekognition only ever sees a resized JPEG, so a 60 MB raw-ish JPEG straight
 * off a DSLR still fits in an inline API call while the untouched original
 * stays on disk for download.
 */
export async function buildDerivatives(input: Buffer): Promise<Derivatives> {
  const image = sharp(input, { failOn: "none" }).rotate(); // honour EXIF orientation
  const meta = await image.metadata();

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new ImageError("unreadable");
  }

  const [preview, thumb, detection] = await Promise.all([
    sharp(input, { failOn: "none" })
      .rotate()
      .resize({
        width: PREVIEW_MAX_EDGE,
        height: PREVIEW_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer(),
    sharp(input, { failOn: "none" })
      .rotate()
      .resize({
        width: THUMB_MAX_EDGE,
        height: THUMB_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 74 })
      .toBuffer(),
    buildDetectionCopy(input),
  ]);

  return {
    width,
    height,
    capturedAt: parseExifDate(meta),
    preview,
    thumb,
    detection,
  };
}

/** Steps quality down until the JPEG fits Rekognition's inline byte limit. */
export async function buildDetectionCopy(input: Buffer): Promise<Buffer> {
  let edge = DETECTION_MAX_EDGE;

  for (const quality of [90, 80, 70, 60]) {
    const out = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({
        width: edge,
        height: edge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (out.byteLength <= REKOGNITION_MAX_BYTES) return out;
    // Still too big at this quality — shrink the frame before trying again.
    edge = Math.round(edge * 0.8);
  }

  throw new ImageError("too_large");
}

export type WatermarkOptions = {
  text?: string | null;
  logo?: Buffer | null;
  position: WatermarkPosition;
  /** 0-100 */
  opacity: number;
  /** Watermark width as a percentage of the photo width. */
  scale: number;
};

/**
 * Burns the photographer's watermark into a copy at download time. The stored
 * original is never modified — turning the watermark off in the studio has to
 * take effect on the next download, not require a re-upload.
 */
export async function applyWatermark(
  input: Buffer,
  options: WatermarkOptions,
): Promise<Buffer> {
  const base = sharp(input, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) return input;

  const markWidth = Math.max(
    64,
    Math.round((width * clamp(options.scale, 4, 60)) / 100),
  );
  const alpha = clamp(options.opacity, 5, 100) / 100;

  // A logo and a caption underneath it are a normal watermark shape — a
  // photo studio's mark is often exactly that. The two used to be
  // either/or, with a logo silently winning and the typed text never
  // drawn; each is built independently here and, when both are set,
  // `stackMarks` combines them into the one image the rest of this
  // function treats as "the mark."
  const parts: Buffer[] = [];
  if (options.logo) {
    parts.push(
      await sharp(options.logo)
        .resize({ width: markWidth, withoutEnlargement: false })
        .ensureAlpha()
        .composite([
          {
            // Multiplying the existing alpha channel is what actually dims a
            // PNG; sharp has no direct "opacity" on composite input.
            input: Buffer.from([255, 255, 255, Math.round(alpha * 255)]),
            raw: { width: 1, height: 1, channels: 4 },
            tile: true,
            blend: "dest-in",
          },
        ])
        .png()
        .toBuffer(),
    );
  }
  if (options.text) {
    parts.push(await renderTextMark(options.text, markWidth, alpha));
  }

  const mark =
    parts.length === 0
      ? null
      : parts.length === 1
        ? parts[0]
        : await stackMarks(parts);

  if (!mark) return sharp(input).rotate().toBuffer();

  const markMeta = await sharp(mark).metadata();
  let finalMark = mark;
  let mw = markMeta.width ?? markWidth;
  let mh = markMeta.height ?? Math.round(markWidth / 6);

  // `markWidth` only ever capped the *width* — a logo and a caption stacked
  // one above the other (see `stackMarks`) can still end up taller than a
  // landscape photo even though neither dimension looked oversized on its
  // own. `composite()` refuses a layer bigger than its base in either
  // dimension, so it is capped again here against the actual photo.
  if (mw > width || mh > height) {
    finalMark = await sharp(mark)
      .resize({ width, height, fit: "inside", withoutEnlargement: true })
      .toBuffer();
    const resized = await sharp(finalMark).metadata();
    mw = resized.width ?? mw;
    mh = resized.height ?? mh;
  }

  const pad = Math.round(width * 0.025);

  if (options.position === "tiled") {
    return base
      .composite([{ input: finalMark, tile: true, blend: "over" }])
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
  }

  const { top, left } = anchor(options.position, {
    width,
    height,
    mw,
    mh,
    pad,
  });

  return base
    .composite([{ input: finalMark, top, left, blend: "over" }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

/**
 * Combines a logo and a text mark into one transparent image, logo on top
 * and the caption centered beneath it, so everything downstream — tiling,
 * corner anchoring — still only ever has to place a single rectangle.
 */
async function stackMarks(parts: Buffer[]): Promise<Buffer> {
  const metas = await Promise.all(parts.map((part) => sharp(part).metadata()));
  const width = Math.max(...metas.map((meta) => meta.width ?? 0));
  const gap = Math.round(width * 0.08);
  const height =
    metas.reduce((sum, meta) => sum + (meta.height ?? 0), 0) +
    gap * (parts.length - 1);

  let top = 0;
  const composites = parts.map((input, i) => {
    const partWidth = metas[i].width ?? width;
    const entry = { input, top, left: Math.round((width - partWidth) / 2) };
    top += (metas[i].height ?? 0) + gap;
    return entry;
  });

  return sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

function anchor(
  position: Exclude<WatermarkPosition, "tiled">,
  d: { width: number; height: number; mw: number; mh: number; pad: number },
): { top: number; left: number } {
  const maxTop = Math.max(0, d.height - d.mh);
  const maxLeft = Math.max(0, d.width - d.mw);

  switch (position) {
    case "top_left":
      return { top: d.pad, left: d.pad };
    case "top_right":
      return { top: d.pad, left: Math.min(maxLeft, d.width - d.mw - d.pad) };
    case "bottom_left":
      return { top: Math.min(maxTop, d.height - d.mh - d.pad), left: d.pad };
    case "center":
      return {
        top: Math.round((d.height - d.mh) / 2),
        left: Math.round((d.width - d.mw) / 2),
      };
    case "bottom_right":
    default:
      return {
        top: Math.min(maxTop, d.height - d.mh - d.pad),
        left: Math.min(maxLeft, d.width - d.mw - d.pad),
      };
  }
}

/**
 * Text marks are drawn as SVG. A drop shadow keeps them legible over both a
 * blown-out sky and a dark stage, which a flat white overlay does not.
 */
async function renderTextMark(
  text: string,
  width: number,
  alpha: number,
): Promise<Buffer> {
  const fontSize = Math.round(width / Math.max(6, text.length * 0.62));
  const height = Math.round(fontSize * 1.8);
  const safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="${Math.max(1, fontSize * 0.06)}" flood-color="#000" flood-opacity="0.55"/>
    </filter>
  </defs>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        font-family="Anuphan, 'Noto Sans Thai', 'Segoe UI', sans-serif"
        font-size="${fontSize}" font-weight="600"
        fill="#ffffff" fill-opacity="${alpha}" filter="url(#s)">${safe}</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

function parseExifDate(meta: Metadata): Date | null {
  // sharp exposes EXIF as a raw buffer; pull DateTimeOriginal out of it rather
  // than pulling in a parser for one field.
  if (!meta.exif) return null;
  const match = meta.exif
    .toString("latin1")
    .match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;

  const [, y, mo, d, h, mi, s] = match;
  // EXIF timestamps have no zone. Photos here are shot in Thailand.
  const parsed = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export class ImageError extends Error {
  constructor(public code: "unreadable" | "too_large") {
    super(`Image error: ${code}`);
  }
}
