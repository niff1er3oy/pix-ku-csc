"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

/**
 * `<Button type="submit">` wired to its own `<form>`'s pending state via
 * `useFormStatus`.
 *
 * Every other submit button in this codebase that wants the spinner/disabled
 * feedback `Button`'s `pending` prop gives it defines a tiny local `Submit`
 * component next to it that calls `useFormStatus()` directly — that works
 * because those forms all live inside files already marked `"use client"`
 * (`event-form.tsx`, `create-affiliation-form.tsx`, `events-manager.tsx`,
 * `review-queue.tsx`, …). `useFormStatus` cannot be called that way from a
 * Server Component, and several admin rows — `ReviewRow`, `TakenDownEventRow`,
 * `DirectoryRow`, the per-photographer takedown form — render their forms
 * from exactly that position. Without this, their submit buttons gave no
 * feedback at all while a server action was in flight: no spinner, nothing
 * disabled, nothing to tell an admin on a slow mobile connection that the tap
 * registered rather than inviting a second tap (and, for the two-decision
 * `ReviewRow` forms, a second tap on the *other* action).
 */
export function SubmitButton(props: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button
      {...props}
      type="submit"
      pending={pending}
      disabled={props.disabled ?? pending}
    />
  );
}
