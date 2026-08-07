"use client";

import type { FormEvent, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { deletePhotos } from "@/lib/actions/studio";
import { t } from "@/lib/i18n/dictionaries";

/**
 * Wraps the photo grid so its checkboxes — plain `<input name="photoIds">`,
 * rendered server-side inside `PhotoGallery`'s `select` slot — can post one
 * or a hundred at once with no JavaScript required at all. This component
 * only adds the confirm step on top; the delete itself works without it.
 */
export function DeletePhotosForm({
  eventId,
  submitLabel,
  confirmMessage,
  selectNoneMessage,
  children,
}: {
  eventId: string;
  submitLabel: string;
  /** `{count}` in the template is replaced with how many boxes are checked. */
  confirmMessage: string;
  selectNoneMessage: string;
  children: ReactNode;
}) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const checked = event.currentTarget.querySelectorAll<HTMLInputElement>(
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
    <form action={deletePhotos} onSubmit={onSubmit}>
      <input type="hidden" name="eventId" value={eventId} />
      {children}
      <Submit label={submitLabel} />
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="danger"
      size="sm"
      className="mt-4"
      pending={pending}
    >
      {label}
    </Button>
  );
}
