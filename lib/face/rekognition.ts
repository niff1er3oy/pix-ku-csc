import "server-only";

import {
  CreateCollectionCommand,
  DeleteCollectionCommand,
  DeleteFacesCommand,
  DetectFacesCommand,
  IndexFacesCommand,
  RekognitionClient,
  ResourceAlreadyExistsException,
  ResourceNotFoundException,
  SearchFacesByImageCommand,
} from "@aws-sdk/client-rekognition";

import {
  FaceError,
  type BoundingBox,
  type DetectedFace,
  type FaceMatch,
  type FaceProvider,
  type IndexedFace,
} from "./types";

let client: RekognitionClient | null = null;

function getClient(): RekognitionClient {
  client ??= new RekognitionClient({
    region: process.env.AWS_REGION ?? "ap-southeast-1",
  });
  return client;
}

function box(b: unknown): BoundingBox | null {
  const v = b as Partial<BoundingBox> | undefined;
  if (!v || v.Width == null || v.Height == null || v.Left == null || v.Top == null) {
    return null;
  }
  return { Width: v.Width, Height: v.Height, Left: v.Left, Top: v.Top };
}

export const rekognitionProvider: FaceProvider = {
  async ensureCollection(collectionId) {
    try {
      await getClient().send(
        new CreateCollectionCommand({ CollectionId: collectionId }),
      );
    } catch (error) {
      // Creating a collection is idempotent from our side — every upload path
      // calls this and only the first one should actually do anything.
      if (error instanceof ResourceAlreadyExistsException) return;
      throw error;
    }
  },

  async deleteCollection(collectionId) {
    try {
      await getClient().send(
        new DeleteCollectionCommand({ CollectionId: collectionId }),
      );
    } catch (error) {
      if (error instanceof ResourceNotFoundException) return;
      throw error;
    }
  },

  async indexFaces(collectionId, image, externalImageId) {
    const result = await getClient().send(
      new IndexFacesCommand({
        CollectionId: collectionId,
        Image: { Bytes: image },
        ExternalImageId: externalImageId,
        // Crowd shots at a university event routinely hold dozens of faces.
        MaxFaces: 100,
        // AUTO drops faces too small or blurry to match reliably, which keeps
        // the collection — and the bill — free of junk that never matches.
        QualityFilter: "AUTO",
        DetectionAttributes: [],
      }),
    );

    return (result.FaceRecords ?? []).flatMap<IndexedFace>((record) => {
      const faceId = record.Face?.FaceId;
      if (!faceId) return [];
      return [
        {
          faceId,
          boundingBox: box(record.Face?.BoundingBox),
          confidence: record.Face?.Confidence ?? null,
        },
      ];
    });
  },

  async searchByImage(collectionId, image, threshold, maxFaces = 500) {
    try {
      const result = await getClient().send(
        new SearchFacesByImageCommand({
          CollectionId: collectionId,
          Image: { Bytes: image },
          FaceMatchThreshold: threshold,
          MaxFaces: Math.min(maxFaces, 4096),
        }),
      );

      return (result.FaceMatches ?? []).flatMap<FaceMatch>((match) => {
        const faceId = match.Face?.FaceId;
        if (!faceId) return [];
        return [
          {
            faceId,
            externalImageId: match.Face?.ExternalImageId ?? null,
            similarity: match.Similarity ?? 0,
          },
        ];
      });
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        throw new FaceError("collection_missing");
      }
      // Rekognition reports "no face in the search image" as a generic
      // InvalidParameterException, so we have to sniff the message.
      if (
        error instanceof Error &&
        error.name === "InvalidParameterException" &&
        /no faces|not contain/i.test(error.message)
      ) {
        throw new FaceError("no_face");
      }
      throw error;
    }
  },

  async detectFaces(image) {
    const result = await getClient().send(
      new DetectFacesCommand({
        Image: { Bytes: image },
        // We want Quality, which DEFAULT includes.
        Attributes: ["DEFAULT"],
      }),
    );

    return (result.FaceDetails ?? []).map<DetectedFace>((face) => ({
      boundingBox: box(face.BoundingBox),
      confidence: face.Confidence ?? null,
      brightness: face.Quality?.Brightness ?? null,
      sharpness: face.Quality?.Sharpness ?? null,
    }));
  },

  async deleteFaces(collectionId, faceIds) {
    if (faceIds.length === 0) return;
    // DeleteFaces caps at 4096 ids per call.
    for (let i = 0; i < faceIds.length; i += 4000) {
      await getClient().send(
        new DeleteFacesCommand({
          CollectionId: collectionId,
          FaceIds: faceIds.slice(i, i + 4000),
        }),
      );
    }
  },
};
