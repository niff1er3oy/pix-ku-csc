import "server-only";

import { mockProvider } from "./mock";
import { rekognitionProvider } from "./rekognition";
import { FaceError, type FaceProvider } from "./types";

export const faceProvider: FaceProvider =
  process.env.FACE_PROVIDER === "mock" ? mockProvider : rekognitionProvider;

export const FACE_MATCH_THRESHOLD = Number(
  process.env.FACE_MATCH_THRESHOLD ?? 90,
);

/** Each event gets its own collection — see `assertSingleFace` for why. */
export function collectionIdForEvent(eventId: string): string {
  const prefix = process.env.REKOGNITION_COLLECTION_PREFIX ?? "findkudae";
  return `${prefix}-event-${eventId}`;
}

/**
 * Per-event collections are a privacy decision as much as a technical one.
 * Because a face only ever exists inside the collection of the event it was
 * shot at, a search physically cannot reach across events — the promise on the
 * landing page is enforced by the data layout, not by a filter someone could
 * forget to apply.
 */
export async function assertSingleFace(image: Buffer): Promise<{
  brightness: number | null;
  sharpness: number | null;
}> {
  const faces = await faceProvider.detectFaces(image);
  if (faces.length === 0) throw new FaceError("no_face");
  if (faces.length > 1) throw new FaceError("many_faces");
  return {
    brightness: faces[0].brightness,
    sharpness: faces[0].sharpness,
  };
}

export { FaceError };
export type * from "./types";
