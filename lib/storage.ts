import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Everything lives on local disk under STORAGE_ROOT, deliberately outside
 * ./public. Originals are only ever reachable through /api/media, which runs
 * the authorization check and burns in the watermark on the way out.
 */
const STORAGE_ROOT = path.resolve(process.env.STORAGE_ROOT ?? "./storage");

/**
 * In production the store must not live inside the deployed application
 * directory. A release swap, a fresh checkout or a rebuilt container replaces
 * that directory, and everything under it goes with the copy being replaced —
 * which here means every photograph anyone uploaded.
 *
 * Warned rather than thrown. Refusing to boot would take a running service
 * down over a configuration that might be a deliberate single-machine setup,
 * and a server that will not start is not obviously better than one that says
 * exactly what is wrong on every start. The default `./storage` is fine in
 * development, so the check only speaks up when NODE_ENV says otherwise.
 */
if (process.env.NODE_ENV === "production") {
  const appDir = process.cwd();
  const inside =
    STORAGE_ROOT === appDir || STORAGE_ROOT.startsWith(appDir + path.sep);

  if (inside) {
    console.warn(
      `[pix-ku-csc] STORAGE_ROOT (${STORAGE_ROOT}) is inside the application ` +
        `directory (${appDir}). Uploaded photographs will be destroyed by the ` +
        `next deployment. Set STORAGE_ROOT to an absolute path outside it.`,
    );
  }
}

/** Rejects `../` traversal from anything that reaches us as a stored path. */
export function resolveStoragePath(relativePath: string): string {
  const resolved = path.resolve(STORAGE_ROOT, relativePath);
  if (resolved !== STORAGE_ROOT && !resolved.startsWith(STORAGE_ROOT + path.sep)) {
    throw new Error(`Path escapes storage root: ${relativePath}`);
  }
  return resolved;
}

export const storagePaths = {
  eventOriginal: (eventId: string, photoId: string, ext: string) =>
    path.posix.join("events", eventId, "originals", `${photoId}${ext}`),
  eventPreview: (eventId: string, photoId: string) =>
    path.posix.join("events", eventId, "preview", `${photoId}.webp`),
  eventThumb: (eventId: string, photoId: string) =>
    path.posix.join("events", eventId, "thumb", `${photoId}.webp`),
  /** One per event, so replacing a cover overwrites rather than accumulates. */
  eventCover: (eventId: string) =>
    path.posix.join("events", eventId, "cover", "cover.webp"),
  eventWatermark: (eventId: string, filename: string) =>
    path.posix.join("events", eventId, "watermark", filename),
  eventDir: (eventId: string) => path.posix.join("events", eventId),
  userFace: (userId: string, faceId: string) =>
    path.posix.join("faces", userId, `${faceId}.jpg`),
  userFaceDir: (userId: string) => path.posix.join("faces", userId),
  /** One per affiliation, so re-uploading overwrites rather than
   *  accumulating — the same fixed-filename shape as `eventCover`. */
  affiliationImage: (affiliationId: string) =>
    path.posix.join("affiliations", affiliationId, "image", "image.webp"),
};

export async function writeStorageFile(
  relativePath: string,
  data: Buffer,
): Promise<void> {
  const target = resolveStoragePath(relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
}

export async function readStorageFile(relativePath: string): Promise<Buffer> {
  return readFile(resolveStoragePath(relativePath));
}

export async function deleteStoragePath(relativePath: string): Promise<void> {
  await rm(resolveStoragePath(relativePath), { recursive: true, force: true });
}

export async function storageFileExists(relativePath: string): Promise<boolean> {
  try {
    await readFile(resolveStoragePath(relativePath));
    return true;
  } catch {
    return false;
  }
}

export function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Salted hash of a client IP. We rate-limit and review abuse by this value and
 * never store the address itself — an IP is personal data under the PDPA and
 * we have no purpose that needs the real one.
 */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.AUTH_SECRET ?? "findkudae";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/**
 * The visitor's address as seen by the nearest hop this app actually trusts —
 * never a value a client can simply type into a request header itself.
 *
 * `CF-Connecting-IP` is authoritative when present: Cloudflare sets it from
 * its own view of the connection and strips whatever a client sent under that
 * name, which is exactly why `.env.example` has us running behind a Cloudflare
 * Tunnel. Otherwise this takes the *last* entry of `X-Forwarded-For`, not the
 * first — a client can prepend anything it likes to that header, but on a
 * deployment with exactly one reverse proxy in front of this app (the
 * supported shape here; see `ecosystem.config.cjs`), the last entry is the
 * address our own proxy appended from the connection it actually saw, which a
 * client has no way to write into.
 *
 * Rate limits built on this (event-pin brute force, face-search abuse) are
 * only as real as this function: reading `x-forwarded-for`'s first entry, as
 * this used to, let an attacker mint a fresh "IP" on every single request.
 */
export function clientIp(headers: { get(name: string): string | null }): string | null {
  const cloudflare = headers.get("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;

  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const hops = forwarded
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
  return hops.length > 0 ? hops[hops.length - 1] : null;
}

export function newId(): string {
  return randomUUID();
}

export { STORAGE_ROOT };
