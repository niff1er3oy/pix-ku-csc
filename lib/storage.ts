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
  eventWatermark: (eventId: string, filename: string) =>
    path.posix.join("events", eventId, "watermark", filename),
  eventDir: (eventId: string) => path.posix.join("events", eventId),
  userFace: (userId: string, faceId: string) =>
    path.posix.join("faces", userId, `${faceId}.jpg`),
  userFaceDir: (userId: string) => path.posix.join("faces", userId),
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

export function newId(): string {
  return randomUUID();
}

export { STORAGE_ROOT };
