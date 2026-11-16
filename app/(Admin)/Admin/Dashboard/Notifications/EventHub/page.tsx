import type { Metadata } from "next";
import Link from "next/link";
import EventHubNotificationSettings from "../../../components/notifications/EventHubNotificationSettings";
import styles from "../../../components/notifications/notifications.module.css";
export const metadata: Metadata = {
  title: "Event Hub notifications | Burton Pride Admin",
};
export default function Page() {
  return (
    <main className={styles.page}>
      <Link
        className={styles.button}
        href="/Admin/Dashboard/Notifications?source=event_hub"
      >
        Back to Event Hub notifications
      </Link>
      <h1 className="text-3xl font-bold">Event Hub notification settings</h1>
      <EventHubNotificationSettings />
    </main>
  );
}
