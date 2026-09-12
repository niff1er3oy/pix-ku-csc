import Link from "next/link";

import { EventsManager } from "@/components/admin/events-manager";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonClass } from "@/components/ui/button";
import { CameraIcon, CloseIcon, ShieldIcon } from "@/components/ui/icon";
import {
  makePhotographer,
  revokePhotographer,
  setUserRole,
} from "@/lib/actions/admin";
import { getPhotographerEvents, type DirectoryRow as Row } from "@/lib/queries/admin";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * One account in the directory, with everything an admin can do to it.
 *
 * A person is one row whether or not they also shoot events — the photographer
 * record is folded in rather than listed separately, so the count in the
 * heading and the rows on screen can never disagree.
 *
 * The promote form is a `<details>` rather than a modal. Naming a photographer
 * needs neither interruption nor protected focus; it needs the account it
 * belongs to still visible above it, which is exactly what a modal takes away.
 * It also keeps working with no JavaScript.
 */
export async function DirectoryRow({
  row,
  isSelf,
  labels,
  dict,
  locale,
  joined,
}: {
  row: Row;
  /** The signed-in admin cannot change their own role — see `setUserRole`. */
  isSelf: boolean;
  labels: Dictionary["admin"];
  /** For `EventsManager` alone — see the note on `Directory`'s own `dict` prop. */
  dict: Dictionary;
  locale: "th" | "en";
  joined: string;
}) {
  const approved = row.photographerStatus === "approved";
  const pending = row.photographerStatus === "pending";
  const revoked = row.photographerStatus === "rejected";
  // Fetched here, not lazily from the popup: 25 rows a page, only the
  // approved-photographer ones, each a short list — cheap enough to load
  // with the row rather than standing up a second round trip just to open
  // it.
  const events = approved && row.photographerId ? await getPhotographerEvents(row.photographerId) : [];

  const roleLabel = pending
    ? labels.roleWaiting
    : revoked
      ? labels.roleRevoked
      : row.role === "admin"
        ? labels.roleAdmin
        : approved
          ? labels.rolePhotographer
          : labels.roleUser;

  return (
    <li className="enter grid gap-4 border-t border-edge py-5 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="flex min-w-0 gap-3">
        <Link href={`/profile/${row.userId}`} className="shrink-0">
          <Avatar src={row.image} size={40} className="mt-0.5" />
        </Link>

        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/profile/${row.userId}`}
              className="truncate font-display font-semibold text-ink underline-offset-4 hover:text-green-700 hover:underline"
            >
              {row.displayName || row.name || row.email}
            </Link>
            {isSelf && (
              <span className="rounded-pill bg-green-600 px-2 py-0.5 text-caption font-semibold text-paper">
                {labels.you}
              </span>
            )}
            <RoleBadge
              label={roleLabel}
              tone={
                row.role === "admin"
                  ? "admin"
                  : pending
                    ? "waiting"
                    : approved
                      ? "photographer"
                      : "plain"
              }
            />
          </p>

          <p className="mt-1 truncate text-label text-slate">{row.email}</p>

          <p className="mt-1 text-caption text-slate">
            {joined}
            {approved && (
              <>
                {" · "}
                {t(labels.eventsOwned, { count: String(row.eventCount) })}
              </>
            )}
            {approved &&
              ` · ${row.affiliation || dict.photographer.affiliationIndependent}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {approved && row.photographerId && (
          <EventsManager
            photographerName={row.displayName || row.name || row.email || ""}
            events={events}
            dict={dict}
            locale={locale}
          />
        )}

        {!isSelf && (
          <form action={setUserRole}>
            <input type="hidden" name="userId" value={row.userId} />
            <input
              type="hidden"
              name="role"
              value={row.role === "admin" ? (approved ? "photographer" : "user") : "admin"}
            />
            <Button
              type="submit"
              variant={row.role === "admin" ? "danger" : "ghost"}
              size="sm"
            >
              <ShieldIcon size={16} />
              {row.role === "admin" ? labels.removeAdmin : labels.makeAdmin}
            </Button>
          </form>
        )}

        {approved && row.photographerId ? (
          <details className="w-full sm:w-auto">
            <summary className={cn(buttonClass({ variant: "danger", size: "sm" }), "cursor-pointer list-none")}>
              <CloseIcon size={16} />
              {labels.revokePhotographer}
            </summary>
            <form
              action={revokePhotographer}
              className="mt-3 w-full rounded-card bg-cloud p-4 sm:w-80"
            >
              <input type="hidden" name="id" value={row.photographerId} />
              <p className="text-caption text-slate">{labels.revokeHint}</p>
              <input
                name="reason"
                type="text"
                maxLength={500}
                placeholder={labels.rejectReason}
                aria-label={labels.rejectReason}
                className="mt-3 h-[46px] w-full rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge placeholder:text-slate focus:ring-2 focus:ring-green-600"
              />
              <Button
                type="submit"
                variant="danger"
                size="md"
                className="mt-3 w-full"
              >
                {labels.revokePhotographer}
              </Button>
            </form>
          </details>
        ) : (
          <details className="w-full sm:w-auto">
            <summary className={cn(buttonClass({ size: "sm" }), "cursor-pointer list-none")}>
              <CameraIcon size={16} />
              {labels.makePhotographer}
            </summary>
            <form
              action={makePhotographer}
              className="mt-3 w-full rounded-card bg-cloud p-4 text-left sm:w-80"
            >
              <input type="hidden" name="userId" value={row.userId} />

              <p className="text-caption text-slate">
                {labels.makePhotographerHint}
              </p>

              <label
                htmlFor={`display-${row.userId}`}
                className="mt-3 block text-label font-medium text-ink"
              >
                {labels.displayNameLabel}
              </label>
              <input
                id={`display-${row.userId}`}
                name="displayName"
                type="text"
                required
                minLength={2}
                maxLength={80}
                defaultValue={row.name ?? ""}
                className="mt-1.5 h-[46px] w-full rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge focus:ring-2 focus:ring-green-600"
              />

              <label
                htmlFor={`affil-${row.userId}`}
                className="mt-3 block text-label font-medium text-ink"
              >
                {labels.affiliationLabel}
              </label>
              <input
                id={`affil-${row.userId}`}
                name="affiliation"
                type="text"
                maxLength={120}
                className="mt-1.5 h-[46px] w-full rounded-field bg-paper px-4 text-body text-ink ring-1 ring-inset ring-edge focus:ring-2 focus:ring-green-600"
              />

              <Button type="submit" size="md" className="mt-4 w-full">
                {labels.confirmPhotographer}
              </Button>
            </form>
          </details>
        )}
      </div>
    </li>
  );
}

function RoleBadge({
  label,
  tone,
}: {
  label: string;
  tone: "admin" | "photographer" | "waiting" | "plain";
}) {
  return (
    <span
      className={cn(
        "rounded-pill px-2 py-0.5 text-caption font-semibold",
        tone === "admin" && "bg-green-900 text-lime-300",
        tone === "photographer" && "bg-green-50 text-green-700",
        tone === "waiting" && "bg-lime-500 text-green-950",
        tone === "plain" && "bg-cloud text-slate",
      )}
    >
      {label}
    </span>
  );
}
