import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";

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
}) {
  const facts = meta.filter((value): value is string => Boolean(value));

  return (
    <li className="rounded-card bg-paper p-5 ring-1 ring-edge sm:p-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
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
          <Button type="submit" size="md">
            {labels.approve}
          </Button>
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
          <Button type="submit" variant="secondary" size="md">
            {labels.reject}
          </Button>
        </form>
      </div>
    </li>
  );
}
