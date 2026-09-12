"use client";

import Link from "next/link";
import { useActionState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CloseIcon } from "@/components/ui/icon";
import {
  addAffiliationMember,
  removeAffiliationMember,
  type AddMemberState,
} from "@/lib/actions/affiliations";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";

type Member = {
  photographerId: string;
  userId: string;
  displayName: string;
  image: string | null;
};

/**
 * The roster, plus the two ways it changes — adding by email and removing —
 * both full mutual rights, not admin-only: any member here can do either to
 * any other, the same "จัดการของกันและกันได้เต็มที่" scope the events
 * themselves share. See `addAffiliationMember`/`removeAffiliationMember`
 * in `lib/actions/affiliations.ts`.
 */
export function AffiliationMembers({
  dict,
  members,
  selfUserId,
}: {
  dict: Dictionary;
  members: Member[];
  selfUserId: string;
}) {
  const [state, action] = useActionState<AddMemberState, FormData>(
    addAffiliationMember,
    undefined,
  );

  const message =
    state?.error === "invalid"
      ? dict.affiliationStudio.addMemberErrorInvalid
      : state?.error === "not_found"
        ? dict.affiliationStudio.addMemberErrorNotFound
        : state?.error === "not_approved"
          ? dict.affiliationStudio.addMemberErrorNotApproved
          : state?.error === "already_in"
            ? dict.affiliationStudio.addMemberErrorAlreadyIn
            : null;

  return (
    <div>
      <h2 className="flex items-baseline gap-2 text-h3 font-semibold text-ink">
        {dict.affiliationStudio.membersTitle}
        <span className="text-label font-normal text-slate">
          {t(dict.affiliationStudio.membersCount, {
            count: String(members.length),
          })}
        </span>
      </h2>

      <ul className="mt-4 flex flex-wrap gap-2">
        {members.map((member) => (
          <li key={member.photographerId} className="flex items-center gap-1">
            <Link
              href={`/profile/${member.userId}`}
              className="flex items-center gap-2 rounded-pill bg-cloud py-1.5 pl-1.5 pr-3 text-label text-ink transition-colors duration-200 hover:bg-green-50 hover:text-green-700"
            >
              <Avatar src={member.image} size={28} />
              <span className="truncate">{member.displayName}</span>
            </Link>
            {member.userId !== selfUserId && (
              <RemoveMemberButton
                photographerId={member.photographerId}
                label={dict.affiliationStudio.removeMember}
                confirmMessage={dict.affiliationStudio.removeMemberConfirm}
              />
            )}
          </li>
        ))}
      </ul>

      <form action={action} className="mt-5 flex max-w-sm flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="member-email" className="block text-label font-medium text-ink">
            {dict.affiliationStudio.addMemberLabel}
          </label>
          <input
            id="member-email"
            name="email"
            type="email"
            required
            className="mt-1.5 h-[46px] w-full rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 focus:ring-2 focus:ring-green-600"
          />
        </div>
        <AddSubmit label={dict.affiliationStudio.addMemberSubmit} />
      </form>

      {message && (
        <p role="alert" className="mt-2 text-label text-danger">
          {message}
        </p>
      )}
    </div>
  );
}

function AddSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="md" pending={pending}>
      {label}
    </Button>
  );
}

function RemoveMemberButton({
  photographerId,
  label,
  confirmMessage,
}: {
  photographerId: string;
  label: string;
  confirmMessage: string;
}) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(confirmMessage)) event.preventDefault();
  }

  return (
    <form action={removeAffiliationMember} onSubmit={onSubmit}>
      <input type="hidden" name="photographerId" value={photographerId} />
      <button
        type="submit"
        aria-label={label}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-pill text-slate transition-colors duration-200 hover:bg-danger/10 hover:text-danger"
      >
        <CloseIcon size={14} />
      </button>
    </form>
  );
}
