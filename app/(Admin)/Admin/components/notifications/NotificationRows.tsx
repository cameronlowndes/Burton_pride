"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  itemDestination,
  itemTitle,
  priorityLabels,
  type NotificationItem,
} from "@/lib/notifications/dashboard";
import { markNotificationRead } from "./useNotifications";
import { DeleteNotificationButton } from "./NotificationDialogs";
import styles from "./notifications.module.css";

const dates = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});
export default function NotificationRows({
  items,
  adminId,
  compact = false,
}: {
  items: NotificationItem[];
  adminId: string;
  compact?: boolean;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const region = useRef<HTMLDivElement>(null);
  async function markRead(id: string) {
    if (busy.current) return;
    busy.current = true;
    setSaving(id);
    setError("");
    setMessage("");
    try {
      await markNotificationRead(id, adminId);
      setMessage("Notification marked as read.");
      region.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      busy.current = false;
      setSaving(null);
    }
  }
  return (
    <div ref={region} tabIndex={-1}>
      <p role="status" className={styles.status}>
        {message}
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <ul className={styles.list}>
        {items.map((item) => (
          <li
            key={item.id}
            className={`${styles.row} ${!item.read_at ? styles.unread : ""}`}
          >
            <p className={styles.badge}>
              {item.source_app === "dashboard"
                ? "Admin Dashboard"
                : "Social Media Moderation"}
              {item.platform
                ? ` · ${item.platform === "facebook" ? "Facebook" : "Instagram"}`
                : ""}
            </p>
            <span
              className={`${styles.badge} ${item.priority === "urgent" ? styles.urgent : ""}`}
            >
              {priorityLabels[item.priority ?? "routine"]}
            </span>
            <h3 className={styles.title}>{itemTitle(item)}</h3>
            {!compact && item.message && (
              <p className={styles.muted}>{item.message}</p>
            )}
            <p className={styles.muted}>
              <time dateTime={item.occurred_at}>
                {Number.isNaN(Date.parse(item.occurred_at))
                  ? "Time unavailable"
                  : dates.format(new Date(item.occurred_at))}
              </time>{" "}
              · {item.read_at ? "Read" : "Unread"}
              {item.resolved_at ? " · Resolved" : ""}
            </p>
            <div className={styles.actions}>
              <Link className={styles.button} href={itemDestination(item)}>
                Open
              </Link>
              {!item.read_at && (
                <button
                  className={styles.button}
                  type="button"
                  disabled={saving !== null}
                  onClick={() => void markRead(item.id)}
                >
                  {saving === item.id ? "Saving…" : "Mark as read"}
                </button>
              )}
              <DeleteNotificationButton
                adminId={adminId}
                scope="one"
                id={item.id}
                title={itemTitle(item)}
                disabled={saving !== null}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
