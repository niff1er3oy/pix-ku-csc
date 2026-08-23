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
      className="inline-flex size-7 items-center justify-center rounded-pill bg-paper/90 text-ink shadow-[var(--shadow-card)] transition-colors duration-200 hover:bg-cloud hover:text-green-700 disabled:opacity-50"
    >
      <RefreshIcon size={14} />
    </button>
  );
}
