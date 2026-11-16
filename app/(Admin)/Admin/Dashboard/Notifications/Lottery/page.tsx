import type { Metadata } from "next";
import Link from "next/link";
import LotteryNotificationSettings from "../../../components/notifications/LotteryNotificationSettings";
import styles from "../../../components/notifications/notifications.module.css";
export const metadata: Metadata = {
  title: "Lottery Management notifications | Burton Pride Admin",
};
export default function Page() {
  return (
    <main className={styles.page}>
      <Link
        className={styles.button}
        href="/Admin/Dashboard/Notifications?source=lottery"
      >
        Back to Lottery Management notifications
      </Link>
      <h1 className="text-3xl font-bold">
        Lottery Management notification settings
      </h1>
      <LotteryNotificationSettings />
    </main>
  );
}
