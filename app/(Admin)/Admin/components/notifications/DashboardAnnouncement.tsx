"use client";
import { useEffect, useRef, useState } from "react";
import { notifyNotificationsChanged } from "./useNotifications";
import styles from "./notifications.module.css";
import {
  announcementRecipients,
  type AnnouncementRecipient as Person,
} from "@/lib/notifications/recipient-labels";
const api = "/api/admin/notifications/dashboard-events";
export default function DashboardAnnouncement() {
  const [people, setPeople] = useState<Person[]>([]);
  const [adminId, setAdminId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef("");
  const locked = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(api, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Announcement access could not be checked.");
        const data = await response.json();
        if (!controller.signal.aborted) {
          setPeople(announcementRecipients(data.audience));
          setAdminId(data.adminId);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  async function send(action: "test" | "announce") {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setStatus("");
    setError("");
    try {
      if (
        action === "announce" &&
        (!title.trim() || !message.trim() || selected.length === 0)
      )
        throw new Error("Enter a title, a message and at least one recipient.");
      if (action === "announce" && !key.current)
        key.current = crypto.randomUUID();
      const response = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          key: key.current,
          title: title.trim(),
          message: message.trim(),
          recipients: selected,
          expectedAdminId: adminId,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ||
            "The notification could not be confirmed. Retry with the same details.",
        );
      setStatus(
        action === "test"
          ? "Test added to your inbox. Phone delivery follows your preferences."
          : "Announcement added to the selected administrators’ inboxes.",
      );
      if (action === "announce") {
        setTitle("");
        setMessage("");
        setSelected([]);
        key.current = "";
      }
      notifyNotificationsChanged();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The notification could not be confirmed.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className={styles.form}
      aria-label="Dashboard notification actions"
    >
      <h3 className={styles.title}>Check the dashboard connection</h3>
      <p className={styles.muted}>
        Add a test to your own inbox. This does not guarantee a phone
        notification.
      </p>
      <button
        type="button"
        className={styles.button}
        disabled={busy || !adminId}
        onClick={() => void send("test")}
      >
        Add dashboard test notification
      </button>
      {people.length > 0 && (
        <form
          noValidate
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            void send("announce");
          }}
        >
          <h3 className={styles.title}>Send a portal announcement</h3>
          <p className={styles.muted}>
            Main Admins can send an announcement to the administrators selected
            below.
          </p>
          <label className={styles.field}>
            Title
            <input
              className={styles.input}
              maxLength={160}
              value={title}
              disabled={busy}
              onChange={(e) => {
                setTitle(e.target.value);
                key.current = "";
              }}
            />
          </label>
          <label className={styles.field}>
            Message
            <textarea
              className={`${styles.input} ${styles.textarea} resize-none`}
              style={{ resize: "none" }}
              maxLength={1500}
              value={message}
              disabled={busy}
              onChange={(e) => {
                setMessage(e.target.value);
                e.target.style.height = "120px";
                e.target.style.height = `${e.target.scrollHeight}px`;
                key.current = "";
              }}
            />
          </label>
          <fieldset className={styles.fieldset} disabled={busy}>
            <legend>Recipients ({selected.length})</legend>
            <div className={styles.audience}>
              {people.map((person) => (
                <label key={person.id} className={styles.switch}>
                  {person.name}
                  <input
                    className={styles.checkbox}
                    type="checkbox"
                    disabled={busy || !person.selectable}
                    checked={selected.includes(person.id)}
                    onChange={(e) => {
                      setSelected((ids) =>
                        e.target.checked
                          ? [...ids, person.id]
                          : ids.filter((id) => id !== person.id),
                      );
                      key.current = "";
                    }}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          {people.some((person) => !person.selectable) && (
            <p className={styles.muted}>
              Some administrator profiles have no username or profile name.
              Update those profiles before selecting them.
            </p>
          )}
          <button className={styles.button} type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send announcement to selected admins"}
          </button>
        </form>
      )}
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
