import { RefreshIcon } from "@/components/ui/icon";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * One event an admin previously took down with `rejectEvent`, with the single
 * decision that action leaves open: put it back.
 *
 * Unlike `ReviewRow` this has no reject side — a takedown here was already an
 * admin's own decision, so there is nothing left to decide against, only
 * whether to undo it. The reason `rejectEvent` recorded is shown as body text
 * so restoring one is informed rather than a guess from the title alone.
 */
export function TakenDownEventRow({
  id,
  title,
  meta,
  reason,
  submitted,
  restore,
  labels,
  hidden = false,
}: {
  id: string;
  title: string;
  /** Secondary facts; blanks are dropped so callers can pass optionals. */
  meta: (string | null | undefined)[];
  reason: string | null;
  submitted: string;
  restore: (formData: FormData) => Promise<void>;
  labels: Dictionary["admin"];
  /** Set by `ReviewQueue` when a search doesn't match this row. */
  hidden?: boolean;
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
        <h3 className="text-h3">{title}</h3>
        <span className="tnum text-caption text-slate">{submitted}</span>
      </div>

      {facts.length > 0 && (
        <p className="mt-2 text-label text-slate">{facts.join(" · ")}</p>
      )}

      {reason && (
        <p className="mt-3 max-w-prose text-body leading-relaxed text-ink">{reason}</p>
      )}

      <div className="mt-5 border-t border-edge pt-5">
        <form action={restore}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton size="md">
            <RefreshIcon size={18} />
            {labels.restoreEvent}
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}
