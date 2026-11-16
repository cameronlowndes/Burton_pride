import type { Metadata } from "next";
import Link from "next/link";
import MoneyNotificationSettings from "../../../components/notifications/MoneyNotificationSettings";
import styles from "../../../components/notifications/notifications.module.css";
export const metadata: Metadata = {
  title: "Money Management notifications | Burton Pride Admin",
};
export default function Page() {
  return (
    <main className={styles.page}>
      <Link
        className={styles.button}
        href="/Admin/Dashboard/Notifications?source=money"
      >
        Back to Money Management notifications
      </Link>
      <h1 className="text-3xl font-bold">
        Money Management notification settings
      </h1>
      <MoneyNotificationSettings />
    </main>
  );
}
