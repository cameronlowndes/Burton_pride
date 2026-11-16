import type { Metadata } from "next";
import Link from "next/link";
import StockNotificationSettings from "../../../components/notifications/StockNotificationSettings";
import styles from "../../../components/notifications/notifications.module.css";
export const metadata: Metadata = {
  title: "Stock Control notifications | Burton Pride Admin",
};
export default function Page() {
  return (
    <main className={styles.page}>
      <Link
        className={styles.button}
        href="/Admin/Dashboard/Notifications?source=stock"
      >
        Back to Stock Control notifications
      </Link>
      <h1 className="text-3xl font-bold">
        Stock Control notification settings
      </h1>
      <StockNotificationSettings />
    </main>
  );
}
