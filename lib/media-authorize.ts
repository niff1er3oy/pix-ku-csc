import "server-only";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { affiliations, events, photographers, photos, type Event } from "@/db/schema";
import { canManageEvent, getPhotographer, getSessionUser } from "@/lib/dal";
import { isPinCookieValid, pinCookieName } from "@/lib/event-pin";
import { applyWatermark } from "@/lib/images";
import { isCanonicalStoragePath, readStorageFile } from "@/lib/storage";
import { isUuid } from "@/lib/utils";

/**
 * The one authorization gate every stored file passes through, shared by
 * `/api/media/[...path]` (one file) and `/api/media/zip` (many, zipped
 * server-side) — a fix here needs making once, not twice, and a file that
 * "download selected" isn't allowed to read one-by-one must not become
 * reachable just by asking for it inside a zip instead.
 */

export type LogDownload = {
  photoId: string;
  userId: string | null;
  /** Absent when the downloader is the event's own owner — nobody needs
   *  telling that they just downloaded their own photo. */
  notify?: { ownerUserId: string; eventId: string; eventName: string };
};

export type MediaDecision =
  | { ok: false; status: 401 | 403 | 404 }
  | {
      ok: true;
      private: boolean;
      filename?: string;
      watermark?: Parameters<typeof applyWatermark>[1];
      logDownload?: LogDownload;
    };

/**
 * `wantsDownload` is a plain boolean rather than read from a `NextRequest`
 * here, so this works the same whether the caller has a real request with a
 * `?download=1` query string (`/api/media/[...path]`) or is authorizing one
 * path out of a batch with no per-file request of its own (`/api/media/zip`,
 * where every file in the zip counts as a download by definition).
 */
export async function authorizeMedia(
  relativePath: string,
  wantsDownload: boolean,
): Promise<MediaDecision> {
  // Everything below authorizes from the leading segments, while the caller
  // reads the whole path — so the two must not be able to disagree. A path
  // with a `..` in it (typed straight into the zip endpoint's JSON, or sent
  // here as `..%2F`, which Next decodes into a segment holding real slashes)
  // was authorized as one event's thumbnail and read as another event's
  // file: a PIN-gated event's photos, or a clean original the photographer
  // had turned downloads off for. Each branch also pins its exact depth, so
  // the last segment can only ever name a file in the directory just checked.
  if (!isCanonicalStoragePath(relativePath)) return { ok: false, status: 404 };
  const parts = relativePath.split("/");

  // --- faces/{userId}/{id}.jpg ---------------------------------------------
  // A saved reference selfie. Only ever visible to the person it belongs to.
  if (parts[0] === "faces") {
    if (parts.length !== 3) return { ok: false, status: 404 };
    const user = await getSessionUser();
    if (!user) return { ok: false, status: 401 };
    if (parts[1] !== user.id) return { ok: false, status: 403 };
    return { ok: true, private: true };
  }

  // --- affiliations/{affiliationId}/image/{file} ---------------------------
  // Public the same way `/affiliations` itself is — no session, no
  // ownership check, just whether the affiliation still exists.
  if (parts[0] === "affiliations") {
    const [, affiliationId, folder] = parts;
    if (parts.length !== 4 || folder !== "image" || !isUuid(affiliationId)) {
      return { ok: false, status: 404 };
    }
    const [affiliation] = await db
      .select({ id: affiliations.id })
      .from(affiliations)
      .where(eq(affiliations.id, affiliationId))
      .limit(1);
    if (!affiliation) return { ok: false, status: 404 };
    return { ok: true, private: false };
  }

  // --- events/{eventId}/{kind}/{file} --------------------------------------
  if (parts[0] !== "events" || parts.length !== 4) {
    return { ok: false, status: 404 };
  }

  const [, eventId, kind] = parts;
  // A malformed id is a 404, not Postgres's `22P02` surfacing as a 500.
  if (!isUuid(eventId)) return { ok: false, status: 404 };
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

  // A private event's PIN is the second factor its access code alone was
  // never meant to be (see the note on `entryPin` in db/schema.ts) — enforced
  // here too, not just at `/e/[code]`. That page only renders a gallery once
  // the PIN cookie checks out, but every image it then points at is fetched
  // straight from this route, with the event's real id and nothing else
  // standing between a scraped/guessed id and the files themselves.
  const pinGated = event.isPrivate && Boolean(event.entryPin);
  if (pinGated && !isManager) {
    const store = await cookies();
    const verified = isPinCookieValid(
      event.id,
      store.get(pinCookieName(event.id))?.value,
    );
    if (!verified) return { ok: false, status: 404 };
  }

  // `cover` belongs with the public derivatives: it is the image on the event
  // card and the page header, so anyone who can see the event can see it.
  // `thumb` stays unwatermarked too — it is small enough (640px) that
  // burning a mark into every grid tile would cost a composite per request
  // for little real protection.
  //
  // `pinGated` keeps a PIN-protected event's derivatives out of shared caches.
  // `private: false` becomes `public, max-age=31536000, immutable`, which
  // tells every cache between here and the visitor — Cloudflare, in this
  // deployment — that it may hand the same bytes to anyone who asks for the
  // URL for a year without consulting this function again. For a gated event
  // that is the PIN check above being skipped for every request after the
  // first verified one.
  if (kind === "thumb" || kind === "watermark" || kind === "cover") {
    return { ok: true, private: isManager || pinGated };
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
  if (!isUuid(photoId)) return { ok: false, status: 404 };
  const [photo] = await db
    .select()
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);

  if (!photo || photo.eventId !== event.id) return { ok: false, status: 404 };

  let logDownload: LogDownload | undefined;
  if (wantsDownload) {
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
