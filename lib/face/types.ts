export type BoundingBox = {
  Width: number;
  Height: number;
  Left: number;
  Top: number;
};

export type IndexedFace = {
  faceId: string;
  boundingBox: BoundingBox | null;
  confidence: number | null;
};

export type FaceMatch = {
  faceId: string;
  /** The photo id we passed as ExternalImageId when indexing. */
  externalImageId: string | null;
  /** 0-100. */
  similarity: number;
};

export type DetectedFace = {
  boundingBox: BoundingBox | null;
  confidence: number | null;
  brightness: number | null;
  sharpness: number | null;
};

/**
 * The one seam between the app and AWS. Swapping FACE_PROVIDER to "mock" gives
 * the whole product a working, deterministic backend with no AWS account and
 * no per-image cost, which is what makes UI work on this app cheap.
 */
export interface FaceProvider {
  ensureCollection(collectionId: string): Promise<void>;
  deleteCollection(collectionId: string): Promise<void>;
  /** `externalImageId` is the photo id, so matches can be joined back. */
  indexFaces(
    collectionId: string,
    image: Buffer,
    externalImageId: string,
  ): Promise<IndexedFace[]>;
  searchByImage(
    collectionId: string,
    image: Buffer,
    threshold: number,
    maxFaces?: number,
  ): Promise<FaceMatch[]>;
  detectFaces(image: Buffer): Promise<DetectedFace[]>;
  deleteFaces(collectionId: string, faceIds: string[]): Promise<void>;
}

export class FaceError extends Error {
  constructor(
    public code:
      | "no_face"
      | "many_faces"
      | "collection_missing"
      | "provider_error",
    message?: string,
  ) {
    super(message ?? `Face error: ${code}`);
  }
}
