import { cn } from "@/lib/utils";

/**
 * An event's state, in the photographer's own terms. Shared by the studio
 * list and one event's own detail page so the two can never show a
 * different color for the same status.
 *
 * `draft` and `pending` are deliberately not both grey. A draft is waiting on
 * the photographer; a pending event is waiting on somebody else. Telling
 * those apart at a glance is the whole reason this chip exists.
 */
export function StatusChip({
  status,
  labels,
  className,
}: {
  status: "draft" | "pending" | "approved" | "rejected" | "archived";
  labels: Record<string, string>;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-pill px-3 py-1 text-caption font-semibold",
        status === "approved" && "bg-green-600 text-paper",
        status === "pending" && "bg-lime-500 text-green-950",
        status === "draft" && "bg-cloud text-slate",
        status === "rejected" && "bg-danger text-paper",
        status === "archived" && "bg-cloud text-slate",
        className,
      )}
    >
      {labels[status]}
    </span>
  );
}
