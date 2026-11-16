"use client";
import { useRef, useState } from "react";
import {
  stockNotificationCategories,
  stockNotificationSettingsApi,
} from "@/lib/notifications/stock";
import NotificationPreferenceEditor from "./NotificationPreferenceEditor";
import { notifyNotificationsChanged } from "./useNotifications";
import styles from "./notifications.module.css";

export default function StockNotificationSettings() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const [adminId, setAdminId] = useState("");
  const lock = useRef(false);
  async function test() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setStatus("");
    setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/admin/notifications/stock-test", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedAdminId: adminId }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "The test could not be confirmed.");
      setStatus(
        "Test added to your Stock Control inbox. No stock, order, delivery or payment was changed.",
      );
      notifyNotificationsChanged();
    } catch (e) {
      setError(
        controller.signal.aborted
          ? "The test timed out. Refresh the inbox before trying again."
          : e instanceof Error
            ? e.message
            : "The test could not be confirmed.",
      );
    } finally {
      window.clearTimeout(timeout);
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className={styles.form}>
      <NotificationPreferenceEditor
        api={stockNotificationSettingsApi}
        title="Stock Control phone preferences"
        enabledLabel="Enable Stock Control phone alerts"
        saveLabel="Save Stock Control settings"
        savedMessage="Stock Control notification settings saved."
        categoryOptions={stockNotificationCategories}
        showUrgentBypass={false}
        onAdmin={setAdminId}
        introduction="Choose which Stock Control alerts reach your registered devices. Your inbox remains available when phone alerts are off. This first integration is available to Main Admins. Changes appear automatically after Stock Control saves them. Notification settings do not change stock records."
      />
      <section
        className={styles.panel}
        aria-label="Stock Control connection test"
      >
        <div className={styles.body}>
          <h2 className={styles.title}>Check the Stock Control connection</h2>
          <p className={styles.muted}>
            Add a test to your own inbox without changing stock, orders or
            deliveries. To check phone delivery, use Send test notification in
            the shared Notification Centre.
          </p>
          <button
            className={styles.button}
            type="button"
            disabled={busy || !adminId}
            onClick={() => void test()}
          >
            {busy ? "Adding test…" : "Add Stock Control test notification"}
          </button>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <p role="status" className={styles.status}>
            {status}
          </p>
        </div>
      </section>
    </div>
  );
}
