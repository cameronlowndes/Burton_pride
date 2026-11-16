"use client";
import { useRef, useState } from "react";
import {
  lotteryNotificationCategories,
  lotteryNotificationSettingsApi,
} from "@/lib/notifications/lottery";
import NotificationPreferenceEditor from "./NotificationPreferenceEditor";
import { notifyNotificationsChanged } from "./useNotifications";
import styles from "./notifications.module.css";

export default function LotteryNotificationSettings() {
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
      const response = await fetch("/api/admin/notifications/lottery-test", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedAdminId: adminId }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "The test could not be confirmed.");
      setStatus(
        "Test added to your Lottery Management inbox. No lottery, ticket, draw or payment was changed.",
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
        api={lotteryNotificationSettingsApi}
        title="Lottery Management phone preferences"
        enabledLabel="Enable Lottery Management phone alerts"
        saveLabel="Save Lottery Management settings"
        savedMessage="Lottery Management notification settings saved."
        categoryOptions={lotteryNotificationCategories}
        showUrgentBypass={false}
        onAdmin={setAdminId}
        introduction="Choose which Lottery Management alerts reach your registered devices. Your inbox remains available when phone alerts are off. This first integration is available to Main Admins. Changes appear automatically after Lottery Management saves them. Notification settings do not change lottery records."
      />
      <section
        className={styles.panel}
        aria-label="Lottery Management connection test"
      >
        <div className={styles.body}>
          <h2 className={styles.title}>
            Check the Lottery Management connection
          </h2>
          <p className={styles.muted}>
            Add a test to your own inbox without changing a lottery, ticket,
            draw or payment. To check phone delivery, use Send test notification
            in the shared Notification Centre.
          </p>
          <button
            className={styles.button}
            type="button"
            disabled={busy || !adminId}
            onClick={() => void test()}
          >
            {busy ? "Adding test…" : "Add Lottery Management test notification"}
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
