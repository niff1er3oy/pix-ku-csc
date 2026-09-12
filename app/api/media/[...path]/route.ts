import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "@/db";
import { affiliations, downloads, events, photographers, photos, type Event } from "@/db/schema";
import { canManageEvent, getPhotographer, getSessionUser } from "@/lib/dal";
import { applyWatermark } from "@/lib/images";
import { notifyPhotoDownloaded } from "@/lib/notifications";
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

type LogDownload = {
  photoId: string;
  userId: string | null;
  /** Absent when the downloader is the event's own owner — nobody needs
   *  telling that they just downloaded their own photo. */
  notify?: { ownerUserId: string; eventId: string; eventName: string };
};

type Decision =
  | { ok: false; status: 401 | 403 | 404 }
  | {
      ok: true;
      private: boolean;
      filename?: string;
      watermark?: Parameters<typeof applyWatermark>[1];
      logDownload?: LogDownload;
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

  // --- affiliations/{affiliationId}/image/{file} ---------------------------
  // Public the same way `/affiliations` itself is — no session, no
  // ownership check, just whether the affiliation still exists.
  if (parts[0] === "affiliations") {
    if (parts.length < 3) return { ok: false, status: 404 };
    const [, affiliationId] = parts;
    const [affiliation] = await db
      .select({ id: affiliations.id })
      .from(affiliations)
      .where(eq(affiliations.id, affiliationId))
      .limit(1);
    if (!affiliation) return { ok: false, status: 404 };
    return { ok: true, private: false };
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
  const isManager = !!user && canManageEvent(user, event, photographer);

  // Before approval only the owner and admins can see anything at all.
  if (event.status !== "approved" && !isManager) {
    return { ok: false, status: 404 };
  }

  // `cover` belongs with the public derivatives: it is the image on the event
  // card and the page header, so anyone who can see the event can see it.
  // `thumb` stays unwatermarked too — it is small enough (640px) that
  // burning a mark into every grid tile would cost a composite per request
  // for little real protection.
  if (kind === "thumb" || kind === "watermark" || kind === "cover") {
    return { ok: true, private: !isManager ? false : true };
  }

  // `preview` is the large (2000px) image the gallery and lightbox actually
  // display — the one a visitor can just right-click "Save image as" on
  // without ever touching the download button. It gets the same mark the
  // original download does, computed fresh on every request rather than
  // baked into the stored file, so turning the watermark on or off in
  // settings takes effect immediately without re-processing every photo.
  //
  // `private: true` here is deliberate, not the previous long-lived public
  // cache: the bytes now depend on event settings that can change at any
  // time, and a CDN holding a year-old "immutable" copy would keep serving
  // last week's watermark — or none at all — long after it stopped being
  // true.
  if (kind === "preview") {
    // The owner/admin's own on-screen browsing skips the mark here — this is
    // what the studio's photo grid and lightbox load while reviewing an
    // upload, and a giant watermark over every tile would get in the way of
    // checking focus and framing. See `resolveWatermark` for why *downloads*
    // do not get the same exemption.
    return {
      ok: true,
      private: true,
      watermark: await resolveWatermark(event, isManager),
    };
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

  let logDownload: LogDownload | undefined;
  if (request.nextUrl.searchParams.get("download") === "1") {
    logDownload = { photoId: photo.id, userId: user?.id ?? null };

    const [owner] = await db
      .select({ userId: photographers.userId })
      .from(photographers)
      .where(eq(photographers.id, event.ownerId))
      .limit(1);

    if (owner && owner.userId !== (user?.id ?? null)) {
      logDownload.notify = { ownerUserId: owner.userId, eventId: event.id, eventName: event.nameTh };
    }
  }

  return {
    ok: true,
    private: true,
    filename: photo.originalFilename,
    // `false`, not `isManager`: once a watermark is turned on, every actual
    // download carries it — the owner's and admin's included. The clean
    // file behind it never goes anywhere on its own; the only way to get
    // one out of this endpoint is to turn the watermark off first, the same
    // door everyone else uses.
    watermark: await resolveWatermark(event, false),
    logDownload,
  };
}

/** `skipForOwner` exempts only the on-screen preview an owner/admin browses
 *  in their own studio — see the call sites for why each does or does not
 *  pass it. */
async function resolveWatermark(
  event: Event,
  skipForOwner: boolean,
): Promise<Parameters<typeof applyWatermark>[1] | undefined> {
  if (skipForOwner || !event.watermarkEnabled) return undefined;

  return {
    text: event.watermarkText,
    logo: event.watermarkLogoPath
      ? await readStorageFile(event.watermarkLogoPath).catch(() => null)
      : null,
    position: event.watermarkPosition,
    opacity: event.watermarkOpacity,
    scale: event.watermarkScale,
  };
}
