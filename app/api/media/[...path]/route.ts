import type { NextRequest } from "next/server";

import { db } from "@/db";
import { downloads } from "@/db/schema";
import { authorizeMedia } from "@/lib/media-authorize";
import { applyWatermark } from "@/lib/images";
import { notifyPhotoDownloaded } from "@/lib/notifications";
import { readStorageFile } from "@/lib/storage";

/**
 * The only way an image leaves the server, one file at a time — its own
 * batch counterpart is `/api/media/zip`. Originals live outside ./public
 * precisely so that every read passes through `authorizeMedia`, and so the
 * watermark can be burned in on the way out — the file on disk stays clean,
 * which means a photographer toggling the watermark off doesn't have to
 * re-upload anything.
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
  const wantsDownload = request.nextUrl.searchParams.get("download") === "1";

  const decision = await authorizeMedia(relativePath, wantsDownload);
  if (!decision.ok) {
    return new Response(null, { status: decision.status });
  }

  let bytes: Buffer;
  try {
    bytes = await readStorageFile(relativePath);
  } catch {
    return new Response(null, { status: 404 });
  }

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

    if (decision.logDownload.notify) {
      const { ownerUserId, eventId, eventName } = decision.logDownload.notify;
      void notifyPhotoDownloaded({ userId: ownerUserId, eventId, eventName }).catch(
        () => {},
      );
    }
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
