"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { ShieldIcon } from "@/components/ui/icon";
import { verifyEventPin, type VerifyEventPinState } from "@/lib/actions/event-pin";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * The second factor a private event's own PIN was always meant to be —
 * `verifyEventPin` is what actually checks it; this is just the form that
 * gets it there. The access code in the URL is what got a visitor this far,
 * but for a private event that is only ever half the door: see the note on
 * `entryPin` in `db/schema.ts` for why a private event without one is
 * just an unlisted public one.
 *
 * Reuses `dict.event.accessCode*` — copy that was written for exactly this
 * gate and had nowhere to render until now.
 */
export function EventPinGate({
  eventId,
  eventName,
  dict,
}: {
  eventId: string;
  eventName: string;
  dict: Dictionary;
}) {
  const [state, action] = useActionState<VerifyEventPinState, FormData>(
    verifyEventPin,
    undefined,
  );

  const message =
    state?.error === "rate_limited"
      ? dict.event.accessCodeRateLimited
      : state?.error
        ? dict.event.accessCodeWrong
        : null;

  return (
    <section className="mx-auto flex min-h-[60svh] w-full max-w-md flex-col items-center justify-center px-5 py-16 text-center sm:px-8">
      <span className="grid size-16 shrink-0 place-items-center rounded-pill bg-green-50 text-green-700">
        <ShieldIcon size={28} />
      </span>

      <h1 className="mt-4 truncate text-h2 font-bold">{eventName}</h1>
      <p className="mt-1 text-label font-medium text-ink">
        {dict.event.accessCodeTitle}
      </p>
      <p className="mt-2 text-body text-slate">{dict.event.accessCodeBody}</p>

      <form action={action} className="mt-6 w-full">
        <input type="hidden" name="eventId" value={eventId} />

        <label htmlFor="event-pin" className="sr-only">
          {dict.event.accessCodeLabel}
        </label>
        <input
          id="event-pin"
          name="pin"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          placeholder="••••••"
          aria-invalid={message !== null || undefined}
          aria-describedby={message ? "event-pin-error" : undefined}
          className={cn(
            "tnum h-16 w-full rounded-field bg-paper px-4 text-center font-display text-2xl font-semibold tracking-[0.5em] text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 focus:ring-2 focus:ring-green-600",
            message && "ring-danger",
          )}
        />

        {message && (
          <p id="event-pin-error" role="alert" className="mt-2 text-label text-danger">
            {message}
          </p>
        )}

        <SubmitButton label={dict.event.accessCodeSubmit} />
      </form>
    </section>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" pending={pending} className="mt-6 w-full">
      {label}
    </Button>
  );
}
