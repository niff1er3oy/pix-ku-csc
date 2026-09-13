"use client";

import type { FormEvent } from "react";

import { CloseIcon } from "@/components/ui/icon";
import { deleteAffiliation } from "@/lib/actions/affiliations";

export function DeleteAffiliationButton({
  id,
  label,
  confirmMessage,
}: {
  id: string;
  label: string;
  confirmMessage: string;
}) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(confirmMessage)) event.preventDefault();
  }

  return (
    <form action={deleteAffiliation} onSubmit={onSubmit}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label={label}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill text-slate transition-colors duration-200 hover:bg-danger/10 hover:text-danger"
      >
        <CloseIcon size={16} />
      </button>
    </form>
  );
}
