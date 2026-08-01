import "server-only";

import { createHash } from "node:crypto";

import type {
  DetectedFace,
  FaceMatch,
  FaceProvider,
  IndexedFace,
} from "./types";

/**
 * A deterministic stand-in for Rekognition, selected with FACE_PROVIDER=mock.
 *
 * It hashes image bytes into stable pseudo-faces, so the same photo always
 * yields the same face ids and the same selfie always matches the same
 * photos. That makes the search UI, the results page and the indexing states
 * all exercisable end to end without an AWS account or a per-image charge.
 */

const collections = new Map<string, Map<string, { external: string; seed: number }>>();

function seedOf(image: Buffer): number {
  const digest = createHash("sha256").update(image).digest();
  return digest.readUInt32BE(0);
}

/** Same image -> same bucket, so matching is repeatable across restarts. */
function bucketOf(seed: number): number {
  return seed % 8;
}

export const mockProvider: FaceProvider = {
  async ensureCollection(collectionId) {
    if (!collections.has(collectionId)) collections.set(collectionId, new Map());
  },

  async deleteCollection(collectionId) {
    collections.delete(collectionId);
  },

  async indexFaces(collectionId, image, externalImageId) {
    const store = collections.get(collectionId) ?? new Map();
    collections.set(collectionId, store);

    const seed = seedOf(image);
    // 0-3 faces per photo, driven by the bytes so it never flickers.
    const count = seed % 4;
    const faces: IndexedFace[] = [];

    for (let i = 0; i < count; i++) {
      const faceId = createHash("sha1")
        .update(`${externalImageId}:${i}`)
        .digest("hex");
      store.set(faceId, { external: externalImageId, seed: seed + i });
      faces.push({
        faceId,
        boundingBox: {
          Left: 0.1 + (i * 0.22) % 0.6,
          Top: 0.18 + ((seed >> (i + 1)) % 30) / 100,
          Width: 0.16,
          Height: 0.22,
        },
        confidence: 99.4,
      });
    }

    return faces;
  },

  async searchByImage(collectionId, image, threshold) {
    const store = collections.get(collectionId);
    if (!store) return [];

    const target = bucketOf(seedOf(image));
    const matches: FaceMatch[] = [];

    for (const [faceId, entry] of store) {
      if (bucketOf(entry.seed) !== target) continue;
      const similarity = 90 + (entry.seed % 10);
      if (similarity < threshold) continue;
      matches.push({ faceId, externalImageId: entry.external, similarity });
    }

    return matches.sort((a, b) => b.similarity - a.similarity);
  },

  async detectFaces(image) {
    const seed = seedOf(image);
    // One in sixteen selfies reports no face, so the error path is reachable.
    if (seed % 16 === 0) return [];

    const face: DetectedFace = {
      boundingBox: { Left: 0.28, Top: 0.16, Width: 0.44, Height: 0.56 },
      confidence: 99.8,
      brightness: 60 + (seed % 30),
      sharpness: 55 + (seed % 40),
    };

    // And one in eleven reports a crowd, so "use a photo with just you" shows.
    return seed % 11 === 0 ? [face, face] : [face];
  },

  async deleteFaces(collectionId, faceIds) {
    const store = collections.get(collectionId);
    if (!store) return;
    for (const id of faceIds) store.delete(id);
  },
};
