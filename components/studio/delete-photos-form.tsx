"use client";

import { useRef, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { deletePhotos } from "@/lib/actions/studio";
import { t } from "@/lib/i18n/dictionaries";

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
  selectAllLabel,
  confirmMessage,
  selectNoneMessage,
  children,
}: {
  eventId: string;
  submitLabel: string;
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
    <form ref={formRef} action={deletePhotos} onSubmit={onSubmit}>
      <input type="hidden" name="eventId" value={eventId} />

      <label className="flex min-h-11 w-fit items-center gap-2 text-label font-medium text-ink">
        <input
          type="checkbox"
          onChange={toggleAll}
          className="size-5 rounded-[6px] accent-green-600"
        />
        {selectAllLabel}
      </label>

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
