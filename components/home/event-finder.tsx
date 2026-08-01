"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { findEvent, type FindEventState } from "@/lib/actions/find-event";
import type { FinderLabels } from "./finder-labels";

/**
 * The front door this category always has and this page was missing: a place
 * to put the link or code you already hold. Someone standing at the booth with
 * a printed code had nowhere to type it before.
 *
 * Resolution happens in the server action, so a wrong code answers inline —
 * right next to the field that can fix it — instead of throwing a 404 page.
 */
export function EventFinder({ labels }: { labels: FinderLabels }) {
  const [state, action] = useActionState<FindEventState, FormData>(
    findEvent,
    undefined,
  );

  const message =
    state?.error === "empty"
      ? labels.finderEmpty
      : state?.error === "not_found"
        ? labels.finderNotFound
        : null;

  return (
    <form action={action} className="mt-8">
      <label
        htmlFor="event-finder"
        className="block text-label font-medium text-ink"
      >
        {labels.finderLabel}
      </label>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="event-finder"
          name="q"
          type="text"
          inputMode="url"
          autoComplete="off"
          enterKeyHint="go"
          placeholder={labels.finderPlaceholder}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? "event-finder-error" : undefined}
          className="h-14 min-w-0 flex-1 rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 placeholder:text-slate/70 focus:ring-2 focus:ring-green-600"
        />
        <SubmitButton label={labels.finderSubmit} />
      </div>

      {message && (
        <p
          id="event-finder-error"
          role="alert"
          className="mt-2 text-label text-danger"
        >
          {message}
        </p>
      )}
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-14 shrink-0 rounded-pill bg-green-600 px-8 font-display text-base font-semibold text-paper shadow-[var(--shadow-pop)] transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:bg-green-700 active:scale-[0.98] active:duration-100 disabled:pointer-events-none disabled:opacity-60"
    >
      {label}
    </button>
  );
}
