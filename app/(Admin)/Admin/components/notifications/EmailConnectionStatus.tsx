"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { notifyNotificationsChanged } from "./useNotifications";
import styles from "./notifications.module.css";
type Connection = {
  id: string;
  lastChecked: string | null;
  lastSuccess: string | null;
  error: string | null;
  initialized: boolean;
  checking: boolean;
};
const dates = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});
function date(value: string | null) {
  return value ? dates.format(new Date(value)) : "Not checked yet";
}
const errors: Record<string, string> = {
  reconnect:
    "Gmail needs attention. Reconnect the account with permission to read your mailbox.",
  temporary: "Gmail could not be checked. The next scheduled check will retry.",
  configuration:
    "Email checks need server configuration. Ask the website administrator to check Google OAuth settings.",
  history_reset:
    "Gmail history expired. The next check starts a fresh baseline; messages from the gap may not have alerts. Check your Gmail inbox.",
};
export default function EmailConnectionStatus({
  adminId,
}: {
  adminId: string;
}) {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const active = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    setConnections(null);
    setError("");
    if (!adminId) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    void fetch("/api/admin/notifications/email-sync", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) setConnections(data.connections);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Could not check Gmail setup.",
          );
      })
      .finally(() => {
        clearTimeout(timeout);
      });
    const onTimeout = () =>
      setError(
        "The connection check timed out. Refresh connection status to try again.",
      );
    controller.signal.addEventListener("abort", onTimeout);
    return () => {
      controller.signal.removeEventListener("abort", onTimeout);
      controller.abort();
      clearTimeout(timeout);
    };
  }, [adminId, revision]);
  useEffect(() => () => active.current?.abort(), []);
  async function check() {
    if (lock.current || !adminId) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    const controller = new AbortController();
    active.current = controller;
    const timer = setTimeout(() => controller.abort(), 55000);
    try {
      const response = await fetch("/api/admin/notifications/email-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedAdminId: adminId }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Email could not be checked.");
      if (controller.signal.aborted) return;
      if (errors[result.state]) setError(errors[result.state]);
      else
        setStatus(
          result.state === "baseline"
            ? "Email checks started. Only new messages will create alerts."
            : result.state === "not_due"
              ? "No connection is due yet. A check may be running, or the retry time has not arrived."
              : "Email check completed. Any new alerts are in your Notification Centre.",
        );
      setRevision((n) => n + 1);
      notifyNotificationsChanged();
    } catch (e) {
      setError(
        controller.signal.aborted
          ? "The check timed out. Refresh status before trying again."
          : e instanceof Error
            ? e.message
            : "Email could not be checked.",
      );
    } finally {
      clearTimeout(timer);
      active.current = null;
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className={`${styles.panel} ${styles.body}`}
      aria-labelledby="email-connection-title"
    >
      <h2 className={styles.title} id="email-connection-title">
        Gmail connection and automatic checks
      </h2>
      <p className={styles.muted}>
        Scheduled checks continue while the portal is closed once the server
        schedule is installed. Check frequency depends on that schedule and the
        number of connected accounts.
      </p>
      {!adminId ? (
        <p>Load your notification preferences to check your account.</p>
      ) : !connections && !error ? (
        <p role="status">Checking your Gmail setup…</p>
      ) : null}
      {connections?.length === 0 && (
        <p>
          No Gmail connection has a verified link to your admin ID. Connect
          Gmail in Email Centre settings. Older connections need their owner
          verified before alerts can start.
        </p>
      )}
      {!!connections?.length && (
        <ul className={styles.list}>
          {connections.map((c, i) => (
            <li key={c.id} className={styles.row}>
              <h3 className={styles.title}>Gmail connection {i + 1}</h3>
              <p>
                {c.checking
                  ? "Checking now"
                  : c.error
                    ? errors[c.error]
                    : c.initialized
                      ? "Email checks started"
                      : "Waiting for the first email check"}
              </p>
              <p className={styles.muted}>
                Last attempt: {date(c.lastChecked)} · Last successful check:{" "}
                {date(c.lastSuccess)} · Europe/London
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        <Link className={styles.button} href="/Admin/Email/Settings">
          Open Email Centre settings
        </Link>
        <button
          className={styles.button}
          disabled={busy || !adminId || !connections?.length}
          onClick={() => void check()}
        >
          {busy ? "Checking email…" : "Check email now"}
        </button>
        <button
          className={styles.button}
          disabled={busy || !adminId}
          onClick={() => {
            setError("");
            setRevision((n) => n + 1);
          }}
        >
          Refresh connection status
        </button>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <p role="status" className={styles.status}>
        {status}
      </p>
    </section>
  );
}
