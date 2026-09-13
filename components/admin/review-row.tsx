import { CheckIcon, CloseIcon } from "@/components/ui/icon";
import { SubmitButton } from "@/components/ui/submit-button";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * One item awaiting review, with the two decisions attached.
 *
 * Approve and reject are separate `<form>`s rather than one form with two
 * submit buttons. A single form would make "reject" the same submission as
 * "approve" with a different `formAction`, and a stray Enter key in the reason
 * box would then post whichever button the browser considers default —
 * approving something the reviewer was in the middle of writing a rejection
 * for. Two forms cannot confuse the two.
 *
 * Both are plain server actions, so the review desk works with no JavaScript.
 */
export function ReviewRow({
  id,
  title,
  meta,
  body,
  submitted,
  approve,
  reject,
  labels,
  hidden = false,
  selected,
  onToggleSelect,
  bulkFormId,
}: {
  id: string;
  title: string;
  /** Secondary facts; blanks are dropped so callers can pass optionals. */
  meta: (string | null | undefined)[];
  body: string | null;
  submitted: string;
  approve: (formData: FormData) => Promise<void>;
  reject: (formData: FormData) => Promise<void>;
  labels: Dictionary["admin"];
  /** Set by `ReviewQueue` when a search doesn't match this row — hidden
   *  with CSS rather than left out of the list, since the reject form below
   *  can already hold a half-typed reason nobody wants to lose to a
   *  keystroke that briefly filters it out and back in. */
  hidden?: boolean;
  /** The three below are only set by `ReviewQueue` when it was given a
   *  `bulkApprove` prop (only the pending-photographers queue does). When
   *  `onToggleSelect` is absent no checkbox renders — the taken-down-events
   *  queue's rows never pass these, so that queue is unaffected. */
  selected?: boolean;
  onToggleSelect?: () => void;
  bulkFormId?: string;
}) {
  const facts = meta.filter((value): value is string => Boolean(value));

  return (
    <li
      className={cn(
        "enter rounded-card bg-paper p-5 shadow-[var(--shadow-card)] sm:p-6",
        hidden && "hidden",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {onToggleSelect && (
          <input
            type="checkbox"
            form={bulkFormId}
            name="ids"
            value={id}
            checked={selected ?? false}
            onChange={onToggleSelect}
            aria-label={t(labels.selectPhotographer, { name: title })}
            className="size-5 shrink-0 rounded-[6px] accent-green-600"
          />
        )}
        <h3 className="text-h3">{title}</h3>
        <span className="tnum text-caption text-slate">{submitted}</span>
      </div>

      {facts.length > 0 && (
        <p className="mt-2 text-label text-slate">{facts.join(" · ")}</p>
      )}

      {body && (
        <p className="mt-3 max-w-prose text-body leading-relaxed text-ink">
          {body}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3 border-t border-edge pt-5 sm:flex-row sm:items-start">
        <form action={approve}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton size="md">
            <CheckIcon size={18} />
            {labels.approve}
          </SubmitButton>
        </form>

        <form action={reject} className="flex flex-1 flex-col gap-2 sm:flex-row">
          <input type="hidden" name="id" value={id} />
          <div className="min-w-0 flex-1">
            <label htmlFor={`reason-${id}`} className="sr-only">
              {labels.rejectReason}
            </label>
            <input
              id={`reason-${id}`}
              name="reason"
              type="text"
              maxLength={500}
              placeholder={labels.rejectReason}
              aria-describedby={`reason-hint-${id}`}
              className="h-[46px] w-full rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 placeholder:text-slate focus:ring-2 focus:ring-green-600"
            />
            <p id={`reason-hint-${id}`} className="mt-1.5 text-caption text-slate">
              {labels.rejectReasonHint}
            </p>
          </div>
          <SubmitButton variant="secondary" size="md">
            <CloseIcon size={18} />
            {labels.reject}
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}
