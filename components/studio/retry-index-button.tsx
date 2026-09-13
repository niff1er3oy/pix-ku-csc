"use client";

import { useFormStatus } from "react-dom";

import { RefreshIcon } from "@/components/ui/icon";
import { retryPhotoIndex } from "@/lib/actions/studio";

/**
 * Sits in `PhotoGallery`'s `select` slot for a photo whose indexing failed —
 * a `formAction` override on the shared grid form, the same technique
 * `DeletePhotosForm` uses for its checkboxes. `useFormStatus` is form-wide,
 * not per-button, so this also disables itself (and the bulk delete button)
 * while any submission in the grid is in flight — which is what stops a
 * double click here from indexing the same photo's faces twice.
 */
export function RetryIndexButton({
  photoId,
  label,
}: {
  photoId: string;
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      formAction={retryPhotoIndex}
      name="photoId"
      value={photoId}
      disabled={pending}
      aria-label={label}
      title={label}
      // 44px, not the 28px this started at: this is the only way to retry a
      // failed index anywhere on the page — the lightbox that opens the same
      // photo has no retry control of its own — and it sits right below a
      // selection checkbox that is itself easy to miss. A precise tap on a
      // sub-44px target stacked under another one is harder one-handed than
      // it is with a mouse, which is exactly the asymmetry this button
      // existing at all is supposed to fix, not add to.
      className="inline-flex size-11 items-center justify-center rounded-pill bg-paper/90 text-ink shadow-[var(--shadow-card)] transition-colors duration-200 hover:bg-cloud hover:text-green-700 disabled:opacity-50"
    >
      <RefreshIcon size={18} />
    </button>
  );
}
