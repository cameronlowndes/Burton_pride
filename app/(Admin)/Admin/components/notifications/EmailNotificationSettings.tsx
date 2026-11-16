"use client";
import { useRef, useState } from "react";
import {
  emailNotificationCategories,
  emailNotificationSettingsApi,
} from "@/lib/notifications/email";
import EmailConnectionStatus from "./EmailConnectionStatus";
import NotificationPreferenceEditor from "./NotificationPreferenceEditor";
import { notifyNotificationsChanged } from "./useNotifications";
import styles from "./notifications.module.css";

export default function EmailNotificationSettings() {
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
      const response = await fetch("/api/admin/notifications/email-test", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedAdminId: adminId }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "The test could not be confirmed.");
      setStatus("Test added to your Email Centre inbox. No email was sent.");
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
      <EmailConnectionStatus adminId={adminId} />
      <NotificationPreferenceEditor
        api={emailNotificationSettingsApi}
        title="Email Centre phone preferences"
        enabledLabel="Enable Email Centre phone alerts"
        saveLabel="Save Email Centre settings"
        savedMessage="Email Centre notification settings saved."
        categoryOptions={emailNotificationCategories}
        showUrgentBypass={false}
        onAdmin={setAdminId}
        introduction="Choose which Email Centre alerts reach your registered devices. Your inbox remains available when phone alerts are off. New-message alerts use your own verified Gmail connection. Shared send-history alerts are for Main Admins only."
      />
      <section
        className={styles.panel}
        aria-label="Email Centre connection test"
      >
        <div className={styles.body}>
          <h2 className={styles.title}>Check the Email Centre connection</h2>
          <p className={styles.muted}>
            Add a test to your own inbox without sending an email or changing
            your Gmail messages. To check phone delivery, use Send test
            notification in the shared Notification Centre.
          </p>
          <button
            className={styles.button}
            type="button"
            disabled={busy || !adminId}
            onClick={() => void test()}
          >
            {busy ? "Adding test…" : "Add Email Centre test notification"}
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
