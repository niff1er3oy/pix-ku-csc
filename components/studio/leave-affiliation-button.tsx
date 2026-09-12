"use client";

import type { FormEvent } from "react";

import { buttonClass } from "@/components/ui/button";
import { leaveAffiliation } from "@/lib/actions/affiliations";

/** Reversible (rejoin with the code any time), but still a real change in
 *  who can reach an affiliation's events — confirmed the same way
 *  `DeleteFaceForm` confirms, rather than a modal this one decision does
 *  not warrant. */
export function LeaveAffiliationButton({
  label,
  confirmMessage,
}: {
  label: string;
  confirmMessage: string;
}) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(confirmMessage)) event.preventDefault();
  }

  return (
    <form action={leaveAffiliation} onSubmit={onSubmit}>
      <button type="submit" className={buttonClass({ variant: "ghost", size: "sm" })}>
        {label}
      </button>
    </form>
  );
}
