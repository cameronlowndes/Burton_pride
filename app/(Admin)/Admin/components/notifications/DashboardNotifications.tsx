"use client";
import NotificationDialogs from "./NotificationDialogs";
import Link from "next/link";
import { useNotifications } from "./useNotifications";
import NotificationRows from "./NotificationRows";
import styles from "./notifications.module.css";

function DashboardContent() {
  const { data, error, loading, refresh } = useNotifications("page=1");
  return (
    <section
      className={styles.panel}
      aria-labelledby="dashboard-notifications-title"
    >
      <header className={styles.header}>
        <h2 id="dashboard-notifications-title" className={styles.title}>
          Notifications{" "}
          {data?.enabled
            ? `(${data.unreadCount.toLocaleString("en-GB")} unread)`
            : ""}
        </h2>
        <div className={styles.actions}>
          <button
            className={styles.button}
            type="button"
            disabled={loading}
            onClick={refresh}
          >
            Refresh
          </button>
          <Link className={styles.button} href="/Admin/Dashboard/Notifications">
            View all notifications
          </Link>
        </div>
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
      ) : data.items.length === 0 ? (
        <p className={`${styles.body} ${styles.muted}`}>
          You’re all caught up. New alerts from your available apps will appear
          here.
        </p>
      ) : (
        <NotificationRows
          items={data.items.slice(0, 5)}
          adminId={data.adminId}
          compact
        />
      )}
    </section>
  );
}

export default function DashboardNotifications() {
  return (
    <NotificationDialogs>
      <DashboardContent />
    </NotificationDialogs>
  );
}
