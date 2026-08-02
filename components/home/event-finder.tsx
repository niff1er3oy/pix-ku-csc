"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { EventCodeInput } from "@/components/home/event-code-input";
import { Button } from "@/components/ui/button";
import { findEvent, type FindEventState } from "@/lib/actions/find-event";
import type { FinderLabels } from "./finder-labels";

/**
 * The front door this category always has and this page was missing: a place
 * to put the code you already hold. Someone standing at the booth with a
 * printed code had nowhere to type it before.
 *
 * Resolution happens in the server action, so a wrong code answers inline —
 * right next to the boxes that can fix it — instead of throwing a 404 page.
 */
export function EventFinder({ labels }: { labels: FinderLabels }) {
  const [state, action] = useActionState<FindEventState, FormData>(
    findEvent,
    undefined,
  );

  // An outage answers inside the field, next to the input that can retry —
  // rather than throwing the visitor at the whole-page error boundary.
  const message =
    state?.error === "empty"
      ? labels.finderEmpty
      : state?.error === "not_found"
        ? labels.finderNotFound
        : state?.error === "unavailable"
          ? labels.finderUnavailable
          : null;

  return (
    <form action={action} className="mt-8">
      {/* Not a `<label>`: it names a group of six inputs rather than any one
          of them, so it is an id the group points at instead. */}
      <p id="event-finder-label" className="text-label font-medium text-ink">
        {labels.finderLabel}
      </p>

      <div className="mt-2">
        <EventCodeInput
          label="event-finder-label"
          slotLabel={labels.finderSlotLabel}
          invalid={message !== null}
          describedBy={
            message ? "event-finder-error event-finder-hint" : "event-finder-hint"
          }
        />

        {message ? (
          <p
            id="event-finder-error"
            role="alert"
            className="mt-2 text-label text-danger"
          >
            {message}
          </p>
        ) : null}

        {/* The format, stated rather than left to be discovered by failing.
            Held in the DOM at all times so a screen reader picks it up from
            `aria-describedby` before the first keystroke rather than after a
            rejection. */}
        <p id="event-finder-hint" className="mt-2 text-caption text-slate">
          {labels.finderHint}
        </p>

        <SubmitButton label={labels.finderSubmit} />
      </div>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      pending={pending}
      className="mt-4 w-full sm:w-auto"
    >
      {label}
    </Button>
  );
}
