import { randomUUID } from "node:crypto";

import { and, eq, gte, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import { db } from "@/db";
import { consents, events, photoFaces, photos, searches, userFaces } from "@/db/schema";
import { getSessionUser } from "@/lib/dal";
import {
  assertSingleFace,
  FACE_MATCH_THRESHOLD,
  FaceError,
  faceProvider,
} from "@/lib/face";
import {
  ACCEPTED_MIME,
  buildDetectionCopy,
  MAX_SELFIE_BYTES,
} from "@/lib/images";
import { hashIp, readStorageFile } from "@/lib/storage";

const ANON_COOKIE = "fkd_anon";
const CONSENT_VERSION = "2026-07-01";
const RATE_LIMIT_PER_MINUTE = 12;

export type SearchMatch = {
  photoId: string;
  thumbPath: string;
  previewPath: string;
  originalPath: string;
  similarity: number;
};

export type SearchResponse =
  | { ok: true; matches: SearchMatch[] }
  | { ok: false; error: string };

/**
 * The core of the product.
 *
 * An anonymous visitor's selfie is never written to disk: it is decoded in
 * memory, downscaled for Rekognition, matched, and dropped when this function
 * returns. That is what makes the promise on the landing page true.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/events/[id]/search">,
) {
  const { id: eventId } = await ctx.params;

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event || event.status !== "approved" || !event.faceCollectionId) {
    return json({ ok: false, error: "not_found" }, 404);
  }

  const form = await request.formData();
  if (form.get("consent") !== "1") {
    return json({ ok: false, error: "consent_required" }, 400);
  }

  const user = await getSessionUser();
  const ipHash = hashIp(
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  );

  if (await isRateLimited(ipHash)) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  // --- Get the bytes to match against -------------------------------------
  let source: Buffer;
  let mode: "saved_face" | "uploaded_selfie";

  if (form.get("useSavedFace") === "1") {
    if (!user) return json({ ok: false, error: "unauthorized" }, 401);

    const [face] = await db
      .select({ imagePath: userFaces.imagePath })
      .from(userFaces)
      .where(eq(userFaces.userId, user.id))
      .limit(1);

    if (!face) return json({ ok: false, error: "no_saved_face" }, 400);

    source = await readStorageFile(face.imagePath);
    mode = "saved_face";
  } else {
    const file = form.get("selfie");
    if (!(file instanceof File)) {
      return json({ ok: false, error: "bad_format" }, 400);
    }
    if (file.size > MAX_SELFIE_BYTES) {
      return json({ ok: false, error: "too_large" }, 400);
    }
    if (!(ACCEPTED_MIME as readonly string[]).includes(file.type)) {
      return json({ ok: false, error: "bad_format" }, 400);
    }

    source = Buffer.from(await file.arrayBuffer());
    mode = "uploaded_selfie";
  }

  await recordConsent(user?.id ?? null, ipHash, request);

  // --- Match ---------------------------------------------------------------
  try {
    const detection = await buildDetectionCopy(source);
    await assertSingleFace(detection);

    const rawMatches = await faceProvider.searchByImage(
      event.faceCollectionId,
      detection,
      FACE_MATCH_THRESHOLD,
    );

    const matches = await resolvePhotos(eventId, rawMatches);

    await db.insert(searches).values({
      eventId,
      userId: user?.id ?? null,
      mode,
      matchCount: matches.length,
      topSimilarity: matches[0]?.similarity ?? null,
      ipHash,
    });

    return json({ ok: true, matches });
  } catch (error) {
    if (error instanceof FaceError) {
      const map = {
        no_face: "no_face",
        many_faces: "many_faces",
        collection_missing: "not_found",
        provider_error: "generic",
      } as const;
      return json({ ok: false, error: map[error.code] }, 400);
    }
    console.error("[find-ku-dae] face search failed:", error);
    return json({ ok: false, error: "generic" }, 500);
  }
  // `source` and `detection` fall out of scope here and are never persisted.
}

/** Joins Rekognition face ids back to the photos they came from. */
async function resolvePhotos(
  eventId: string,
  raw: { faceId: string; similarity: number }[],
): Promise<SearchMatch[]> {
  if (raw.length === 0) return [];

  const best = new Map<string, number>();
  for (const match of raw) {
    best.set(match.faceId, Math.max(best.get(match.faceId) ?? 0, match.similarity));
  }

  const rows = await db
    .select({
      photoId: photos.id,
      thumbPath: photos.thumbPath,
      previewPath: photos.previewPath,
      originalPath: photos.originalPath,
      faceId: photoFaces.faceId,
    })
    .from(photoFaces)
    .innerJoin(photos, eq(photoFaces.photoId, photos.id))
    .where(
      and(
        eq(photoFaces.eventId, eventId),
        inArray(photoFaces.faceId, [...best.keys()]),
      ),
    );

  // One photo can hold several matching faces; keep its strongest score once.
  const byPhoto = new Map<string, SearchMatch>();
  for (const row of rows) {
    const similarity = best.get(row.faceId) ?? 0;
    const existing = byPhoto.get(row.photoId);
    if (!existing || similarity > existing.similarity) {
      byPhoto.set(row.photoId, {
        photoId: row.photoId,
        thumbPath: row.thumbPath,
        previewPath: row.previewPath,
        originalPath: row.originalPath,
        similarity,
      });
    }
  }

  return [...byPhoto.values()].sort((a, b) => b.similarity - a.similarity);
}

/**
 * PDPA requires a record of what was agreed and when. Anonymous visitors get
 * an opaque cookie id so they can still evidence and withdraw their consent
 * without an account.
 */
async function recordConsent(
  userId: string | null,
  ipHash: string | null,
  request: NextRequest,
) {
  const store = await cookies();
  let anonymousId = userId ? null : (store.get(ANON_COOKIE)?.value ?? null);

  if (!userId && !anonymousId) {
    anonymousId = randomUUID();
    store.set(ANON_COOKIE, anonymousId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  await db.insert(consents).values({
    userId,
    anonymousId,
    type: "biometric_search",
    version: CONSENT_VERSION,
    ipHash,
    userAgent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
  });
}

async function isRateLimited(ipHash: string | null): Promise<boolean> {
  if (!ipHash) return false;
  const since = new Date(Date.now() - 60_000);
  const rows = await db
    .select({ id: searches.id })
    .from(searches)
    .where(and(eq(searches.ipHash, ipHash), gte(searches.createdAt, since)))
    .limit(RATE_LIMIT_PER_MINUTE);
  return rows.length >= RATE_LIMIT_PER_MINUTE;
}

function json(body: SearchResponse, status = 200) {
  return Response.json(body, {
    status,
    // Results describe a person's face. They must never sit in a shared cache.
    headers: { "Cache-Control": "private, no-store" },
  });
}
