"use client";
import NotificationDialogs from "./NotificationDialogs";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  NOTIFICATION_API,
  NOTIFICATIONS_CHANGED,
} from "@/lib/notifications/dashboard";
import { useNotifications } from "./useNotifications";
import NotificationRows from "./NotificationRows";
import styles from "./notifications.module.css";
export { NOTIFICATION_API, NOTIFICATIONS_CHANGED };

function BellContent() {
  const { data, error, loading, refresh } = useNotifications("page=1");
  return (
    <div className={styles.bell}>
      <details>
        <summary
          className={styles.summary}
          aria-label={
            data?.enabled
              ? `Notifications, ${data.unreadCount} unread`
              : "Notifications"
          }
        >
          <Bell size={18} aria-hidden="true" />
          Notifications
          {data?.enabled && data.unreadCount > 0 && (
            <span className={styles.count} aria-hidden="true">
              {data.unreadCount > 99 ? "99+" : data.unreadCount}
            </span>
          )}
        </summary>
        <section
          className={`${styles.panel} ${styles.popover}`}
          aria-label="Recent notifications"
        >
          <header className={styles.header}>
            <h2 className={styles.title}>Recent notifications</h2>
            <button
              className={styles.button}
              type="button"
              disabled={loading}
              onClick={refresh}
            >
              Refresh
            </button>
          </header>
          {error ? (
            <p role="alert" className={`${styles.body} ${styles.error}`}>
              {error}
            </p>
          ) : !data ? (
            <p role="status" className={styles.body}>
              Loading notifications…
            </p>
          ) : !data.enabled ? (
            <p className={styles.body}>
              Notifications are unavailable for this account.
            </p>
          ) : data.items.length ? (
            <NotificationRows
              items={data.items.slice(0, 3)}
              adminId={data.adminId}
              compact
            />
          ) : (
            <p className={styles.body}>No notifications yet.</p>
          )}
          <div className={styles.body}>
            <Link
              href="/Admin/Dashboard/Notifications"
              className={styles.button}
            >
              View all notifications
            </Link>
          </div>
        </section>
      </details>
    </div>
  );
}

export default function NotificationBell() {
  return (
    <NotificationDialogs>
      <BellContent />
    </NotificationDialogs>
  );
}
