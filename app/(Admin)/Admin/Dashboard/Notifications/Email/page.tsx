import type { Metadata } from "next";
import Link from "next/link";
import EmailNotificationSettings from "../../../components/notifications/EmailNotificationSettings";
import styles from "../../../components/notifications/notifications.module.css";
export const metadata: Metadata = {
  title: "Email Centre notifications | Burton Pride Admin",
};
export default function Page() {
  return (
    <main className={styles.page}>
      <Link
        className={styles.button}
        href="/Admin/Dashboard/Notifications?source=email"
      >
        Back to Email Centre notifications
      </Link>
      <h1 className="text-3xl font-bold">Email Centre notification settings</h1>
      <EmailNotificationSettings />
    </main>
  );
}
