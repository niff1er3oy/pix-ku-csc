import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
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
  ImageError,
  MAX_SELFIE_BYTES,
} from "@/lib/images";
import { getSavedPhotoIds } from "@/lib/queries/saved-photos";
import { gate, takeHit, withTimeout } from "@/lib/rate-limit";
import { clientIp, hashIp, readStorageFile } from "@/lib/storage";
import { isUuid } from "@/lib/utils";

const ANON_COOKIE = "fkd_anon";
const CONSENT_VERSION = "2026-07-01";

/**
 * Attempts per minute, counted when a request arrives — not searches that
 * finished. The limiter this replaces counted rows in `searches`, which only
 * a completed match ever writes: a selfie with no face in it still paid for a
 * `DetectFaces` call and wrote a consent row, and could be repeated without
 * limit because nothing ever recorded that it happened.
 *
 * Two keys, because the two cases are not the same person-shaped thing. A
 * signed-in account is one person, and 12 a minute is far more retries than
 * one person needs. An address is not: a whole venue on campus Wi-Fi, or a
 * mobile carrier's NAT, arrives as one, so the anonymous allowance is set for
 * a crowd rather than for an individual.
 */
const ATTEMPTS_PER_MINUTE_SIGNED_IN = 12;
const ATTEMPTS_PER_MINUTE_PER_ADDRESS = 30;
const ATTEMPT_WINDOW_MS = 60_000;

/**
 * The part an address cannot talk its way around: however many addresses a
 * burst claims to come from, only this many searches run at once.
 *
 * Three, to match `MAX_CONCURRENT_INDEXING` in lib/face/pipeline.ts and for
 * its reason — each search is two Rekognition calls against the same account
 * quota an upload batch is drawing on. The rest wait their turn for a few
 * seconds, which a crowd arriving together is better served by than an
 * error; past the queue, or past the wait, the answer is "try again" rather
 * than a request left hanging.
 */
const searchGate = gate("face-search", 3, 20, 15_000);

/** A hung AWS call must not hold one of three slots for good. */
const SEARCH_TIMEOUT_MS = 45_000;

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
  if (!isUuid(eventId)) return json({ ok: false, error: "not_found" }, 404);

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event || event.status !== "approved" || !event.faceCollectionId) {
    return json({ ok: false, error: "not_found" }, 404);
  }
  const collectionId = event.faceCollectionId;

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

  // Admission, before the body is even read: a request over its allowance
  // costs nothing further — no upload buffered, no row written, no AWS call.
  // An address that cannot be resolved is refused rather than waved through;
  // "no IP" is the easiest thing to arrange on purpose.
  const ipHash = hashIp(clientIp(request.headers));
  const limiterKey = user ? `search:user:${user.id}` : ipHash && `search:ip:${ipHash}`;
  const allowance = user ? ATTEMPTS_PER_MINUTE_SIGNED_IN : ATTEMPTS_PER_MINUTE_PER_ADDRESS;
  if (!limiterKey || !takeHit(limiterKey, allowance, ATTEMPT_WINDOW_MS)) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  const form = await request.formData();
  if (form.get("consent") !== "1") {
    return json({ ok: false, error: "consent_required" }, 400);
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

  // Taken only now, with the upload fully received: a slot held while a body
  // trickled in over a bad connection would let three slow phones — or three
  // deliberately slow ones — stall the search for everybody else.
  if (!(await searchGate.enter())) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  // --- Match ---------------------------------------------------------------
  try {
    // Consent is recorded before any processing, and only for a request that
    // is actually about to be processed.
    await recordConsent(user?.id ?? null, ipHash, request);

    let detection: Buffer;
    try {
      detection = await buildDetectionCopy(source);
    } catch (error) {
      // A file sharp cannot decode is the visitor's file, not a server fault:
      // it used to fall through to the 500 below and its "something went
      // wrong" message, which tells nobody to pick a different photo.
      const tooLarge = error instanceof ImageError && error.code === "too_large";
      return json({ ok: false, error: tooLarge ? "too_large" : "bad_format" }, 400);
    }

    const rawMatches = await withTimeout(
      (async () => {
        await assertSingleFace(detection);
        return faceProvider.searchByImage(collectionId, detection, FACE_MATCH_THRESHOLD);
      })(),
      SEARCH_TIMEOUT_MS,
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
  } finally {
    searchGate.leave();
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

function json(body: SearchResponse, status = 200) {
  return Response.json(body, {
    status,
    // Results describe a person's face. They must never sit in a shared cache.
    headers: { "Cache-Control": "private, no-store" },
  });
}
