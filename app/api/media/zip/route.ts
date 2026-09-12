import { Readable } from "node:stream";
import { ZipFile } from "yazl";

import { db } from "@/db";
import { downloads } from "@/db/schema";
import { applyWatermark } from "@/lib/images";
import { authorizeMedia } from "@/lib/media-authorize";
import { notifyPhotoDownloaded } from "@/lib/notifications";
import { readStorageFile } from "@/lib/storage";

/**
 * The batch counterpart to `/api/media/[...path]` — "download selected" and
 * "download all" both post their list of storage paths here instead of
 * firing one browser download per file, and get back a single zip built
 * from whichever of those paths this request is actually allowed to read.
 *
 * A POST with a JSON body rather than a GET with paths in the query string:
 * a full event can be 5,000 photos, and 5,000 storage paths would blow past
 * every practical URL length limit long before it blew past this route's
 * own cap on how many it will zip in one request.
 *
 * Every path is re-authorized through the exact same `authorizeMedia` this
 * endpoint's single-file sibling uses — the client already only ever sends
 * paths it saw as `href`s on photos it could already see, but that is not
 * the same claim as "may read," and a batch endpoint is not a second, looser
 * door into storage. A path that fails authorization, or does not exist on
 * disk, is silently left out of the zip rather than failing the whole
 * request — the same "skip it, do not abort the batch" choice
 * `deletePhotos` and `retryPhotoIndex` already make for one bad id among
 * many.
 *
 * Built and streamed one file at a time, not in parallel: a bounded-memory,
 * bounded-CPU batch job that takes longer beats a burst of concurrent
 * `sharp` watermark composites and database reads for however many photos a
 * "download all" happens to select.
 */

const MAX_FILES_PER_ZIP = 5000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const paths = Array.isArray(body?.paths)
    ? body.paths.filter((p: unknown): p is string => typeof p === "string")
    : [];

  if (paths.length === 0) {
    return new Response(null, { status: 400 });
  }
  if (paths.length > MAX_FILES_PER_ZIP) {
    return new Response(null, { status: 413 });
  }

  const zipfile = new ZipFile();
  const usedNames = new Set<string>();

  // Filling the zip runs independently of the caller awaiting bytes off
  // `zipfile.outputStream` below — `yazl` streams entries out as they're
  // added, so the response can start flowing before every file has even
  // been read, rather than buffering the whole archive in memory first.
  void (async () => {
    for (const relativePath of paths) {
      try {
        const decision = await authorizeMedia(relativePath, true);
        if (!decision.ok) continue;

        let bytes: Buffer;
        try {
          bytes = await readStorageFile(relativePath);
        } catch {
          continue;
        }

        if (decision.watermark) {
          bytes = await applyWatermark(bytes, decision.watermark);
        }

        const baseName = decision.filename ?? relativePath.split("/").pop() ?? "photo";
        zipfile.addBuffer(bytes, uniqueEntryName(baseName, usedNames));

        if (decision.logDownload) {
          // Fire and forget, same as the single-file route: a failed
          // analytics insert must not fail the download.
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
      } catch (error) {
        // One bad entry (a transient read error, an unexpected auth
        // failure) costs that file, not the rest of the zip the visitor is
        // already downloading.
        console.warn("[pix-ku-csc] skipped one file while zipping:", relativePath, error);
      }
    }
    zipfile.end();
  })();

  return new Response(Readable.toWeb(zipfile.outputStream as Readable) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="photos.zip"',
      "Cache-Control": "private, no-store",
    },
  });
}

/** Two different photographers' "IMG_0001.jpg" cannot both keep that name in
 *  the same zip — this appends " (1)", " (2)", … the same way a file manager
 *  resolves a name collision, rather than silently letting the second
 *  overwrite the first once extracted. */
function uniqueEntryName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }

  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";

  let attempt = 1;
  let candidate = `${stem} (${attempt})${ext}`;
  while (used.has(candidate)) {
    attempt++;
    candidate = `${stem} (${attempt})${ext}`;
  }
  used.add(candidate);
  return candidate;
}
