import {
  AlertIcon,
  BellIcon,
  CameraIcon,
  CheckIcon,
  CloseIcon,
  DownloadIcon,
} from "@/components/ui/icon";
import type { Notification, NotificationType } from "@/db/schema";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { markAllNotificationsRead, openNotification } from "@/lib/actions/notifications";
import { cn, formatDate } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/locale";

/**
 * `<details>` rather than a click-tracked client component, same reasoning as
 * the promote/revoke panels in `DirectoryRow`: the disclosure and every
 * action inside it (open one, mark all read) works with no JavaScript, and
 * opening a notification is one form submit that marks it read and redirects
 * to its link in the same request — see `openNotification`.
 */
export function NotificationBell({
  notifications,
  unreadCount,
  dict,
  locale,
}: {
  notifications: Notification[];
  unreadCount: number;
  dict: Dictionary;
  locale: Locale;
}) {
  return (
    // No `relative` here, unlike `AccountMenu`/`MobileNavMenu`'s own
    // `<details>`. Those two anchor correctly to themselves because each is
    // the rightmost thing in the header row, flush with its right edge — this
    // bell sits to the *left* of the account chip, so a panel anchored to its
    // own (44px-wide) box and sized to the viewport's width
    // (`calc(100vw-2.5rem)` below) ran off the left edge of the screen by the
    // width of everything to this button's right. Letting it inherit
    // `SiteHeader`'s `relative` `<nav>` as its positioned ancestor instead
    // anchors it to the row that actually reaches the container's true right
    // edge, the same edge the account chip's own panel already lines up with.
    <details>
      <summary
        aria-label={
          unreadCount > 0
            ? `${dict.notifications.title} — ${t(dict.notifications.unreadCount, { count: unreadCount })}`
            : dict.notifications.title
        }
        className="relative inline-flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-pill text-slate transition-colors duration-200 hover:bg-cloud hover:text-green-700"
      >
        <BellIcon size={22} />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-green-600 px-1 text-[10px] font-semibold leading-none text-paper"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </summary>

      <div className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-[min(22rem,calc(100vw-2.5rem))] overflow-y-auto rounded-card bg-paper p-2 shadow-lift ring-1 ring-edge">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <h2 className="text-label font-semibold text-ink">{dict.notifications.title}</h2>
          {unreadCount > 0 && (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="text-caption font-medium text-green-700 hover:underline"
              >
                {dict.notifications.markAllRead}
              </button>
            </form>
          )}
        </div>

        {notifications.length === 0 ? (
          <p className="px-3 py-8 text-center text-body text-slate">
            {dict.notifications.empty}
          </p>
        ) : (
          <ul className="flex flex-col">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <form action={openNotification}>
                  <input type="hidden" name="id" value={notification.id} />
                  <button
                    type="submit"
                    className="flex w-full items-start gap-3 rounded-field px-3 py-2.5 text-left transition-colors duration-200 hover:bg-cloud"
                  >
                    <NotificationTypeIcon type={notification.type} />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-body",
                          notification.readAt ? "text-slate" : "font-medium text-ink",
                        )}
                      >
                        {t(
                          dict.notifications.types[notification.type],
                          (notification.data ?? {}) as Record<string, string | number>,
                        )}
                      </span>
                      {typeof notification.data?.reason === "string" &&
                        notification.data.reason && (
                          <span className="mt-0.5 block text-caption text-slate">
                            {notification.data.reason}
                          </span>
                        )}
                      <span className="mt-0.5 block text-caption text-slate">
                        {formatDate(notification.createdAt, locale, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                    {!notification.readAt && (
                      <span
                        aria-hidden
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-pill bg-green-600"
                      />
                    )}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function NotificationTypeIcon({ type }: { type: NotificationType }) {
  const className = "mt-0.5 shrink-0 text-slate";
  switch (type) {
    case "photographer_application_received":
      return <CameraIcon size={18} className={className} />;
    case "photographer_approved":
    case "photographer_granted":
    case "event_approved":
    case "affiliation_member_added":
      return <CheckIcon size={18} className={className} />;
    case "photographer_rejected":
    case "photographer_revoked":
    case "event_rejected":
    case "affiliation_member_removed":
      return <CloseIcon size={18} className={className} />;
    case "photo_index_failed":
      return <AlertIcon size={18} className={className} />;
    case "photo_downloaded":
      return <DownloadIcon size={18} className={className} />;
  }
}
