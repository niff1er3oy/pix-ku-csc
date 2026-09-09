"use client";

import { useRef, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { DownloadIcon, TrashIcon } from "@/components/ui/icon";
import { deletePhotos } from "@/lib/actions/studio";
import { t } from "@/lib/i18n/dictionaries";

/** Only ever one of these per page today, so a fixed id is safe — exported
 *  so the lightbox's own per-photo delete button, rendered through a portal
 *  well outside this form's own DOM subtree, can still submit into it via
 *  the standard `form="…"` attribute. */
export const DELETE_PHOTOS_FORM_ID = "delete-photos-form";

/**
 * Wraps the photo grid so its checkboxes — plain `<input name="photoIds">`,
 * rendered server-side inside `PhotoGallery`'s `select` slot — can post one
 * or a hundred at once with no JavaScript required at all. This component
 * only adds the confirm step and the "select all" convenience on top; the
 * delete itself works without either.
 *
 * "Select all" reaches into the DOM via a form ref rather than lifting every
 * checkbox into React state — the grid can be a thousand photos, and there
 * is nothing here that needs to *know* which ones are checked until the
 * moment of submit, when the browser already collects that for free.
 */
export function DeletePhotosForm({
  eventId,
  submitLabel,
  downloadLabel,
  selectAllLabel,
  confirmMessage,
  selectNoneMessage,
  children,
}: {
  eventId: string;
  submitLabel: string;
  downloadLabel: string;
  selectAllLabel: string;
  /** `{count}` in the template is replaced with how many boxes are checked. */
  confirmMessage: string;
  selectNoneMessage: string;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  function toggleAll(event: ChangeEvent<HTMLInputElement>) {
    const checked = event.target.checked;
    formRef.current
      ?.querySelectorAll<HTMLInputElement>('input[name="photoIds"]')
      .forEach((box) => {
        box.checked = checked;
      });
  }

  /**
   * No zip, no new route — each checked box already carries the same
   * per-photo `/api/media/...?download=1` link its own thumbnail uses, via
   * `data-download-href`. Firing them off with a delay between each is a
   * real limitation next to a single zip download, but it reuses a route
   * that is already correctly authorized and watermark-aware rather than
   * standing up a second way to read a photo off disk. The stagger exists
   * because Chrome silently blocks a burst of automatic downloads fired in
   * the same tick — spaced out, each one lands as an ordinary user-triggered
   * download instead.
   */
  function downloadSelected() {
    const hrefs = Array.from(
      formRef.current?.querySelectorAll<HTMLInputElement>(
        'input[name="photoIds"]:checked',
      ) ?? [],
    )
      .map((box) => box.dataset.downloadHref)
      .filter((href): href is string => Boolean(href));

    if (hrefs.length === 0) {
      window.alert(selectNoneMessage);
      return;
    }

    hrefs.forEach((href, index) => {
      window.setTimeout(() => {
        const link = document.createElement("a");
        link.href = href;
        link.download = "";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, index * 400);
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // A per-photo retry button (`name="photoId"`, its own `formAction`)
    // lives inside this same form — see `PhotoGallery`'s `select` slot on the
    // studio page. It submits through here too, and must skip the "select at
    // least one" / confirm checks below, which only make sense for a delete.
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | null;
    if (submitter?.name === "photoId") return;

    // The lightbox's own delete button submits its one photo id directly as
    // the submitter's own name/value, not through a checked checkbox — it is
    // never "nothing selected", so that check is skipped for it specifically,
    // but it still confirms like every other delete does.
    const isSinglePhotoDelete = submitter?.name === "photoIds";

    const checked = isSinglePhotoDelete
      ? 1
      : event.currentTarget.querySelectorAll<HTMLInputElement>(
          'input[name="photoIds"]:checked',
        ).length;

    if (checked === 0) {
      event.preventDefault();
      window.alert(selectNoneMessage);
      return;
    }

    if (!window.confirm(t(confirmMessage, { count: String(checked) }))) {
      event.preventDefault();
    }
  }

  return (
    <form
      ref={formRef}
      id={DELETE_PHOTOS_FORM_ID}
      action={deletePhotos}
      onSubmit={onSubmit}
    >
      <input type="hidden" name="eventId" value={eventId} />

      {children}

      {/* "Select all" beside the button it feeds, rather than above a grid
          that can run to hundreds of photos — the two only make sense as a
          pair right before the moment of submitting, not one at the top of
          the page and the other at the bottom of it. */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 w-fit items-center gap-2 text-label font-medium text-ink">
          <input
            type="checkbox"
            onChange={toggleAll}
            className="size-5 rounded-[6px] accent-green-600"
          />
          {selectAllLabel}
        </label>

        <Button type="button" size="sm" onClick={downloadSelected}>
          <DownloadIcon size={16} />
          {downloadLabel}
        </Button>

        <Submit label={submitLabel} />
      </div>
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="sm" pending={pending}>
      <TrashIcon size={16} />
      {label}
    </Button>
  );
}
