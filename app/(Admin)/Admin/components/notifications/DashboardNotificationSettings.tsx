"use client";
import { useEffect, useRef, useState } from "react";
import {
  dashboardCategories,
  preferencesApi,
  type DashboardPreferences,
} from "@/lib/notifications/dashboard";
import { notifyNotificationsChanged } from "./useNotifications";
import styles from "./notifications.module.css";

export default function DashboardNotificationSettings() {
  const [preferences, setPreferences] = useState<DashboardPreferences | null>(
    null,
  );
  const [adminId, setAdminId] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const saving = useRef(false);
  const leaving = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [destination, setDestination] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const response = await fetch(preferencesApi, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Settings could not be loaded.");
        if (!controller.signal.aborted) {
          setPreferences(result.preferences);
          setAdminId(result.adminId);
          setDirty(false);
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Settings could not be loaded.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty && !leaving.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      )
        return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const next = new URL(link.href, window.location.href);
      if (
        next.origin !== window.location.origin ||
        next.href === window.location.href
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setDestination(next.href);
      dialog.current?.showModal();
    };
    document.addEventListener("click", protect, true);
    return () => document.removeEventListener("click", protect, true);
  }, [dirty]);
  function update<K extends keyof DashboardPreferences>(
    key: K,
    value: DashboardPreferences[K],
  ) {
    setPreferences((p) => (p ? { ...p, [key]: value } : p));
    setDirty(true);
    setStatus("");
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preferences || saving.current) return;
    saving.current = true;
    setBusy(true);
    setStatus("");
    setError("");
    try {
      const response = await fetch(preferencesApi, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...preferences, expectedAdminId: adminId }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Settings were not saved.");
      setPreferences(result.preferences);
      setDirty(false);
      setStatus("Dashboard notification settings saved.");
      notifyNotificationsChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settings were not saved.");
    } finally {
      setBusy(false);
      saving.current = false;
    }
  }
  if (loading)
    return (
      <p role="status" className={styles.muted}>
        Loading dashboard settings…
      </p>
    );
  if (!preferences)
    return (
      <div>
        <p role="alert" className={styles.error}>
          {error}
        </p>
        <button
          type="button"
          className={styles.button}
          onClick={() => setReload((n) => n + 1)}
        >
          Try again
        </button>
      </div>
    );
  return (
    <form
      noValidate
      className={styles.form}
      onSubmit={(event) => void save(event)}
    >
      <h3 className={styles.title}>Dashboard phone preferences</h3>
      <p className={styles.muted}>
        These settings affect your dashboard phone alerts. Your authorised inbox
        entries remain available. Register each receiving device using Phone
        notifications.
      </p>
      <label className={styles.switch}>
        Enable dashboard phone alerts
        <input
          className={styles.checkbox}
          type="checkbox"
          checked={preferences.enabled}
          disabled={busy}
          onChange={(e) => update("enabled", e.target.checked)}
        />
      </label>
      <fieldset className={styles.fieldset} disabled={busy}>
        <legend>Categories</legend>
        {Object.entries(dashboardCategories).map(([key, label]) => (
          <label key={key} className={styles.switch}>
            {label}
            <input
              className={styles.checkbox}
              type="checkbox"
              checked={
                preferences.categories[key as keyof typeof dashboardCategories]
              }
              onChange={(e) =>
                update("categories", {
                  ...preferences.categories,
                  [key]: e.target.checked,
                })
              }
            />
          </label>
        ))}
      </fieldset>
      <fieldset className={`${styles.fieldset} ${styles.form}`} disabled={busy}>
        <legend>Quiet hours and time away</legend>
        <p className={styles.muted}>
          All dates and times use Europe/London. Alerts silenced during a pause
          stay in your inbox; dashboard phone alerts are not replayed later.
        </p>
        <label className={styles.switch}>
          Use daily quiet hours
          <input
            className={styles.checkbox}
            type="checkbox"
            checked={preferences.quietEnabled}
            onChange={(e) => update("quietEnabled", e.target.checked)}
          />
        </label>
        <div className={styles.grid}>
          <label className={styles.field}>
            Quiet from
            <input
              className={styles.input}
              type="time"
              value={preferences.quietStart}
              onChange={(e) => update("quietStart", e.target.value)}
            />
          </label>
          <label className={styles.field}>
            Quiet until
            <input
              className={styles.input}
              type="time"
              value={preferences.quietEnd}
              onChange={(e) => update("quietEnd", e.target.value)}
            />
          </label>
        </div>
        {(
          [
            ["awayUntil", "Out of office until"],
            ["holidayStart", "Holiday starts"],
            ["holidayEnd", "Holiday ends"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className={styles.field}>
            {label}
            <input
              className={styles.input}
              type="datetime-local"
              value={preferences[key]}
              onChange={(e) => update(key, e.target.value)}
            />
          </label>
        ))}
        <label className={styles.switch}>
          Allow urgent alerts during quiet hours and out of office
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={preferences.urgentBypass}
            onChange={(e) => update("urgentBypass", e.target.checked)}
          />
        </label>
        <p className={styles.muted}>
          Holiday mode and the master phone switch always take priority.
        </p>
      </fieldset>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <p role="status" className={styles.status}>
        {status || (dirty ? "You have unsaved changes." : "")}
      </p>
      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.button}
          disabled={busy || !dirty}
        >
          {busy ? "Saving…" : "Save dashboard settings"}
        </button>
        <button
          type="button"
          className={styles.button}
          disabled={busy || !dirty}
          onClick={() => {
            setDirty(false);
            setReload((n) => n + 1);
          }}
        >
          Discard changes and reload
        </button>
      </div>
      <dialog
        ref={dialog}
        className={styles.modal}
        aria-labelledby="discard-settings-title"
        onCancel={() => setDestination("")}
      >
        <h2 id="discard-settings-title" className={styles.title}>
          Discard unsaved settings?
        </h2>
        <p className={styles.muted}>
          Your changes have not been saved. Keep editing or discard them before
          leaving this page.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            autoFocus
            className={styles.button}
            onClick={() => {
              dialog.current?.close();
              setDestination("");
            }}
          >
            Keep editing
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              if (destination) {
                leaving.current = true;
                window.location.assign(destination);
              }
            }}
          >
            Discard and leave
          </button>
        </div>
      </dialog>
    </form>
  );
}
