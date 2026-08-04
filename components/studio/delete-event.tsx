"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { AlertIcon } from "@/components/ui/icon";
import { deleteEvent } from "@/lib/actions/studio";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Deleting an event, with the friction the action deserves.
 *
 * The photographer has to retype the event's own six-character code. A confirm
 * dialog gets clicked through on reflex; six characters that are only correct
 * for the event actually on screen force a look at which one this is. The
 * server checks it again — this is a hint to the person, not the guard.
 *
 * The warning lists what actually goes, with the real photo count, because
 * "this cannot be undone" tells somebody nothing about the size of what they
 * are about to lose. An approved event says so too: students may already have
 * been handed the code and told to come back for their photographs.
 *
 * Collapsed by default. A destructive control sitting open at the bottom of a
 * working page is something to fall into, not to reach for.
 */
export function DeleteEvent({
  eventId,
  accessCode,
  photoCount,
  isLive,
  labels,
}: {
  eventId: string;
  accessCode: string;
  photoCount: number;
  isLive: boolean;
  labels: Dictionary["studio"];
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toUpperCase() === accessCode.toUpperCase();

  return (
    <details className="mt-16 border-t border-edge pt-8">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-label font-medium text-danger">
        <AlertIcon size={18} />
        {labels.deleteEvent}
      </summary>

      <form action={deleteEvent} className="mt-4 max-w-lg">
        <input type="hidden" name="id" value={eventId} />

        <div className="rounded-card bg-cloud p-5">
          <p className="text-label font-medium text-ink">
            {labels.deleteWarnTitle}
          </p>

          <ul className="mt-3 list-disc space-y-1 pl-5 text-caption text-slate">
            <li>
              {t(labels.deleteWarnPhotos, { count: String(photoCount) })}
            </li>
            <li>{labels.deleteWarnFaces}</li>
            <li>{labels.deleteWarnCode}</li>
            {isLive && (
              <li className="font-medium text-danger">
                {labels.deleteWarnLive}
              </li>
            )}
          </ul>

          <label
            htmlFor="confirm"
            className="mt-5 block text-label font-medium text-ink"
          >
            {t(labels.deleteConfirmLabel, { code: accessCode })}
          </label>
          <input
            id="confirm"
            name="confirm"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="tnum mt-1.5 h-[46px] w-full max-w-[14rem] rounded-field bg-paper px-4 text-center font-display text-lg font-semibold uppercase tracking-[0.2em] text-ink ring-1 ring-inset ring-edge focus:ring-2 focus:ring-danger"
          />

          <Submit label={labels.deleteEventConfirm} enabled={matches} />
        </div>
      </form>
    </details>
  );
}

function Submit({ label, enabled }: { label: string; enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="danger"
      size="md"
      className="mt-4"
      disabled={!enabled || pending}
      pending={pending}
    >
      {label}
    </Button>
  );
}
