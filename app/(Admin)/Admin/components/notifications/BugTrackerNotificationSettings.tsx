"use client";
import { useRef, useState } from "react";
import {
  bugNotificationCategories,
  bugNotificationSettingsApi,
} from "@/lib/notifications/bug-tracker";
import NotificationPreferenceEditor from "./NotificationPreferenceEditor";
import { notifyNotificationsChanged } from "./useNotifications";
import styles from "./notifications.module.css";

export default function BugTrackerNotificationSettings() {
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
    try {
      const response = await fetch(
        "/api/admin/notifications/bug-tracker-test",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedAdminId: adminId }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "The test could not be confirmed.");
      setStatus(
        "Test added to your Bug Tracker inbox. No real bug report was created.",
      );
      notifyNotificationsChanged();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The test could not be confirmed.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className={styles.form}>
      <NotificationPreferenceEditor
        api={bugNotificationSettingsApi}
        title="Bug Tracker phone preferences"
        enabledLabel="Enable Bug Tracker phone alerts"
        saveLabel="Save Bug Tracker settings"
        savedMessage="Bug Tracker notification settings saved."
        categoryOptions={bugNotificationCategories}
        showUrgentBypass={false}
        onAdmin={setAdminId}
        introduction="Choose which Bug Tracker alerts reach your registered devices. Your inbox remains available when phone alerts are off. This source is available to Main Admins only."
      />
      <section
        className={styles.panel}
        aria-label="Bug Tracker connection test"
      >
        <div className={styles.body}>
          <h2 className={styles.title}>Check the Bug Tracker connection</h2>
          <p className={styles.muted}>
            Add a test to your own inbox without creating or changing a bug
            report. To check phone delivery, use Send test notification in the
            shared Notification Centre.
          </p>
          <button
            className={styles.button}
            type="button"
            disabled={busy || !adminId}
            onClick={() => void test()}
          >
            {busy ? "Adding test…" : "Add Bug Tracker test notification"}
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
