import { randomUUID } from "node:crypto";

import { and, eq, gte, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import { db } from "@/db";
import {
  consents,
  events,
  photoFaces,
  photos,
  searches,
  searchMatches,
  userFaces,
} from "@/db/schema";
import { canManageEvent, getPhotographer, getSessionUser } from "@/lib/dal";
import { isPinCookieValid, pinCookieName } from "@/lib/event-pin";
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
import { getSavedPhotoIds } from "@/lib/queries/saved-photos";
import { clientIp, hashIp, readStorageFile } from "@/lib/storage";

const ANON_COOKIE = "fkd_anon";
const CONSENT_VERSION = "2026-07-01";
const RATE_LIMIT_PER_MINUTE = 12;

export type SearchMatch = {
  photoId: string;
  thumbPath: string;
  previewPath: string;
  originalPath: string;
  similarity: number;
  /** Always false for a signed-out visitor — saving requires an account. */
  isSaved: boolean;
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

  const user = await getSessionUser();

  // A private event's PIN is the second factor its access code alone was
  // never meant to be — same check `/e/[code]` makes before it ever renders
  // the search button that posts here, enforced again at this endpoint
  // itself since it is reachable directly with the event's real id.
  if (event.isPrivate && event.entryPin) {
    const photographer = user ? await getPhotographer(user.id) : null;
    const isManager = !!user && canManageEvent(user, event, photographer);
    if (!isManager) {
      const store = await cookies();
      const verified = isPinCookieValid(
        event.id,
        store.get(pinCookieName(event.id))?.value,
      );
      if (!verified) return json({ ok: false, error: "not_found" }, 404);
    }
  }

  const form = await request.formData();
  if (form.get("consent") !== "1") {
    return json({ ok: false, error: "consent_required" }, 400);
  }

  const ipHash = hashIp(clientIp(request.headers));

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

    const { matches: resolved, faceMatches } = await resolvePhotos(eventId, rawMatches);

    const savedIds = user
      ? await getSavedPhotoIds(user.id, resolved.map((m) => m.photoId))
      : new Set<string>();
    const matches: SearchMatch[] = resolved.map((m) => ({
      ...m,
      isSaved: savedIds.has(m.photoId),
    }));

    // One transaction: a `searches` row whose `matchCount` disagrees with
    // how many `search_matches` rows actually exist for it is worse than
    // neither existing — the studio page's match count and its face chips
    // would tell two different stories for the same search.
    await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(searches)
        .values({
          eventId,
          userId: user?.id ?? null,
          mode,
          matchCount: matches.length,
          topSimilarity: matches[0]?.similarity ?? null,
          ipHash,
        })
        .returning({ id: searches.id });

      if (faceMatches.length > 0) {
        await tx.insert(searchMatches).values(
          faceMatches.map((m) => ({
            searchId: inserted.id,
            faceId: m.faceId,
            similarity: m.similarity,
          })),
        );
      }
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
    console.error("[pix-ku-csc] face search failed:", error);
    return json({ ok: false, error: "generic" }, 500);
  }
  // `source` and `detection` fall out of scope here and are never persisted.
}

type FaceMatch = { faceId: string; similarity: number };

/** The part of a match `resolvePhotos` can actually know — whether it is
 *  saved depends on who is asking, which this function has no notion of. */
type ResolvedMatch = Omit<SearchMatch, "isSaved">;

/** Joins Rekognition face ids back to the photos they came from. */
async function resolvePhotos(
  eventId: string,
  raw: FaceMatch[],
): Promise<{ matches: ResolvedMatch[]; faceMatches: FaceMatch[] }> {
  if (raw.length === 0) return { matches: [], faceMatches: [] };

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

  // One photo can hold several matching faces; keep its strongest score once
  // for the results the visitor sees. `faceMatches` keeps every one of them —
  // it is what `search_match` records, and a visitor's own results collapsing
  // to "best per photo" is a display choice, not a reason to under-record
  // which faces this search actually reached.
  const byPhoto = new Map<string, ResolvedMatch>();
  const faceMatches: FaceMatch[] = [];
  for (const row of rows) {
    const similarity = best.get(row.faceId) ?? 0;
    faceMatches.push({ faceId: row.faceId, similarity });

    const existing = byPhoto.get(row.photoId);
    if (!existing || similarity > existing.similarity) {
      byPhoto.set(row.photoId, {
        photoId: row.photoId,
        // Non-null in practice, not just in principle: a `photo_face` row is
        // only ever inserted inside `indexPhotoFaces`'s own transaction (see
        // lib/face/pipeline.ts), which only runs once `processPhoto` has
        // already written both paths — a photo cannot match a search before
        // its derivatives exist.
        thumbPath: row.thumbPath!,
        previewPath: row.previewPath!,
        originalPath: row.originalPath,
        similarity,
      });
    }
  }

  return {
    matches: [...byPhoto.values()].sort((a, b) => b.similarity - a.similarity),
    faceMatches,
  };
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
  // Same reasoning as the event-PIN limiter: an address we can't resolve is
  // treated as already over the limit, not waved through.
  if (!ipHash) return true;
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
