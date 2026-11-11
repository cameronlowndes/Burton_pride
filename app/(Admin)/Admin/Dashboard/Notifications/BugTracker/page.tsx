import type { Metadata } from "next";
import Link from "next/link";
import BugTrackerNotificationSettings from "../../../components/notifications/BugTrackerNotificationSettings";
import styles from "../../../components/notifications/notifications.module.css";
export const metadata: Metadata = {
  title: "Bug Tracker notification settings",
  robots: { index: false, follow: false },
};
export default function BugTrackerNotificationsPage() {
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className="text-3xl font-bold">
            Bug Tracker notification settings
          </h1>
          <p className={styles.muted}>
            Manage your Bug Tracker alerts in the shared Admin Portal
            notification system.
          </p>
        </div>
        <Link
          className={styles.button}
          href="/Admin/Dashboard/Notifications?source=bug_tracker"
        >
          Back to Bug Tracker inbox
        </Link>
      </header>
      <div
        className={`${styles.panel} ${styles.body}`}
        style={{ marginTop: 24 }}
      >
        <BugTrackerNotificationSettings />
      </div>
    </section>
  );
}
