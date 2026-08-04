import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "@/db";
import { downloads, events, photos } from "@/db/schema";
import { getPhotographer, getSessionUser } from "@/lib/dal";
import { applyWatermark } from "@/lib/images";
import { readStorageFile } from "@/lib/storage";

/**
 * The only way an image leaves the server.
 *
 * Originals live outside ./public precisely so that every read passes through
 * this authorization check, and so the watermark can be burned in on the way
 * out — the file on disk stays clean, which means a photographer toggling the
 * watermark off doesn't have to re-upload anything.
 */

const MIME: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/media/[...path]">,
) {
  const { path: segments } = await ctx.params;
  const relativePath = segments.join("/");

  const decision = await authorize(relativePath, request);
  if (!decision.ok) {
    return new Response(null, { status: decision.status });
  }

  let bytes: Buffer;
  try {
    bytes = await readStorageFile(relativePath);
  } catch {
    return new Response(null, { status: 404 });
  }

  const wantsDownload = request.nextUrl.searchParams.get("download") === "1";
  let contentType =
    MIME[relativePath.slice(relativePath.lastIndexOf(".")).toLowerCase()] ??
    "application/octet-stream";

  if (decision.watermark) {
    bytes = await applyWatermark(bytes, decision.watermark);
    contentType = "image/jpeg";
  }

  if (decision.logDownload) {
    // Fire and forget: a failed analytics insert must not fail the download.
    void db
      .insert(downloads)
      .values({
        photoId: decision.logDownload.photoId,
        userId: decision.logDownload.userId,
        watermarked: Boolean(decision.watermark),
      })
      .catch(() => {});
  }

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Length": String(bytes.byteLength),
    // Derivatives are immutable once written; originals may gain or lose a
    // watermark between requests, so they are never cached publicly.
    "Cache-Control": decision.private
      ? "private, no-store"
      : "public, max-age=31536000, immutable",
  });

  if (wantsDownload && decision.filename) {
    headers.set(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(decision.filename)}"`,
    );
  }

  return new Response(new Uint8Array(bytes), { headers });
}

type Decision =
  | { ok: false; status: 401 | 403 | 404 }
  | {
      ok: true;
      private: boolean;
      filename?: string;
      watermark?: Parameters<typeof applyWatermark>[1];
      logDownload?: { photoId: string; userId: string | null };
    };

async function authorize(
  relativePath: string,
  request: NextRequest,
): Promise<Decision> {
  const parts = relativePath.split("/");

  // --- faces/{userId}/{id}.jpg ---------------------------------------------
  // A saved reference selfie. Only ever visible to the person it belongs to.
  if (parts[0] === "faces") {
    const user = await getSessionUser();
    if (!user) return { ok: false, status: 401 };
    if (parts[1] !== user.id) return { ok: false, status: 403 };
    return { ok: true, private: true };
  }

  // --- events/{eventId}/{kind}/{file} --------------------------------------
  if (parts[0] !== "events" || parts.length < 4) {
    return { ok: false, status: 404 };
  }

  const [, eventId, kind] = parts;
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) return { ok: false, status: 404 };

  const user = await getSessionUser();
  const photographer = user ? await getPhotographer(user.id) : null;
  const isManager =
    user?.role === "admin" || photographer?.id === event.ownerId;

  // Before approval only the owner and admins can see anything at all.
  if (event.status !== "approved" && !isManager) {
    return { ok: false, status: 404 };
  }

  // `cover` belongs with the public derivatives: it is the image on the event
  // card and the page header, so anyone who can see the event can see it.
  if (
    kind === "thumb" ||
    kind === "preview" ||
    kind === "watermark" ||
    kind === "cover"
  ) {
    return { ok: true, private: !isManager ? false : true };
  }

  if (kind !== "originals") return { ok: false, status: 404 };

  // --- originals: the download path ---------------------------------------
  if (!event.allowOriginalDownload && !isManager) {
    return { ok: false, status: 403 };
  }

  const photoId = parts[3].replace(/\.[^.]+$/, "");
  const [photo] = await db
    .select()
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);

  if (!photo || photo.eventId !== event.id) return { ok: false, status: 404 };

  // Managers pull the clean file; everyone else gets the photographer's mark.
  const watermark =
    !isManager && event.watermarkEnabled
      ? {
          text: event.watermarkText,
          logo: event.watermarkLogoPath
            ? await readStorageFile(event.watermarkLogoPath).catch(() => null)
            : null,
          position: event.watermarkPosition,
          opacity: event.watermarkOpacity,
          scale: event.watermarkScale,
        }
      : undefined;

  return {
    ok: true,
    private: true,
    filename: photo.originalFilename,
    watermark,
    logDownload:
      request.nextUrl.searchParams.get("download") === "1"
        ? { photoId: photo.id, userId: user?.id ?? null }
        : undefined,
  };
}
