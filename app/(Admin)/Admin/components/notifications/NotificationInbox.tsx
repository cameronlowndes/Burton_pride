"use client";
import NotificationDialogs from "./NotificationDialogs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  notificationSources,
  isNotificationSource,
  type NotificationSource,
} from "@/lib/notifications/sources";
import { dashboardCategories } from "@/lib/notifications/dashboard";
import { useNotifications } from "./useNotifications";
import {
  AutoRefreshButton,
  DeleteNotificationButton,
} from "./NotificationDialogs";
import NotificationRows from "./NotificationRows";
import DashboardNotificationSettings from "./DashboardNotificationSettings";
import DashboardAnnouncement from "./DashboardAnnouncement";
import PhonePushSettings from "./PhonePushSettings";
import styles from "./notifications.module.css";

function InboxContent({
  initialSource,
}: {
  initialSource: NotificationSource | "";
}) {
  const params = useSearchParams();
  const router = useRouter();
  const paramsKey = params.toString();
  const [pending, setPending] = useState<{ base: string; next: string } | null>(
    null,
  );
  const activeParams = new URLSearchParams(
    pending?.base === paramsKey ? pending.next : paramsKey,
  );
  useEffect(() => {
    if (pending && pending.base !== paramsKey) setPending(null);
  }, [paramsKey, pending]);
  const rawSource = activeParams.get("source");
  const source =
    rawSource === null
      ? ""
      : isNotificationSource(rawSource)
        ? rawSource
        : initialSource;
  const rawPage = Number(activeParams.get("page") || 1);
  const page = Number.isInteger(rawPage)
    ? Math.max(1, Math.min(1000, rawPage))
    : 1;
  const unread = activeParams.get("unread") === "1";
  const category = activeParams.get("category") || "";
  const priority = activeParams.get("priority") || "";
  const query = new URLSearchParams({
    page: String(page),
    unread: unread ? "1" : "0",
  });
  if (source) query.set("source", source);
  if (category) query.set("category", category);
  if (priority) query.set("priority", priority);
  const { data, access, error, loading, refresh } = useNotifications(
    query.toString(),
  );
  function change(changes: Record<string, string>) {
    const next = new URLSearchParams(activeParams.toString());
    next.set("page", "1");
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setPending({ base: paramsKey, next: next.toString() });
    router.replace(`/Admin/Dashboard/Notifications?${next}`, { scroll: false });
  }
  const selected = source ? notificationSources[source] : null;
  const canBugTracker = Boolean(
    (access as { canBugTracker?: boolean } | null | undefined)?.canBugTracker,
  );
  return (
    <section className={styles.page} aria-labelledby="notifications-title">
      <header className={styles.header}>
        <div>
          <p className={styles.muted}>Admin Portal</p>
          <h1 id="notifications-title" className="text-3xl font-bold">
            Notification Centre
          </h1>
          <p className={styles.muted}>
            Review alerts from your available Admin Portal apps in one place.
          </p>
        </div>
        <button
          type="button"
          className={styles.button}
          disabled={loading}
          onClick={refresh}
        >
          Refresh notifications
        </button>
      </header>
      <p className={styles.muted}>
        {data?.enabled
          ? `${data.unreadCount.toLocaleString("en-GB")} unread across all available sources`
          : "Checking notification access"}{" "}
        · Times shown in Europe/London
      </p>
      {access?.enabled && (
        <div
          className={styles.actions}
          aria-label="Personal notification controls"
        >
          <AutoRefreshButton
            adminId={access.adminId}
            enabled={access.autoRefresh !== false}
          />
          <DeleteNotificationButton adminId={access.adminId} scope="read" />
          <DeleteNotificationButton adminId={access.adminId} scope="all" />
        </div>
      )}
      <div className={styles.columns}>
        <section className={styles.panel} aria-labelledby="inbox-title">
          <div className={styles.header}>
            <h2 id="inbox-title" className={styles.title}>
              Inbox
            </h2>
            <div className={styles.actions}>
              <label className={styles.field}>
                Source
                <select
                  aria-label="Source"
                  className={styles.input}
                  value={source}
                  onChange={(e) =>
                    change({ source: e.target.value, category: "" })
                  }
                >
                  <option value="">All apps</option>
                  {Object.entries(notificationSources).map(([key, app]) => (
                    <option key={key} value={key}>
                      {app.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Priority
                <select
                  aria-label="Priority"
                  className={styles.input}
                  value={priority}
                  onChange={(e) => change({ priority: e.target.value })}
                >
                  <option value="">All priorities</option>
                  <option value="routine">Information</option>
                  <option value="action">Action required</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              {source === "dashboard" && (
                <label className={styles.field}>
                  Category
                  <select
                    aria-label="Category"
                    className={styles.input}
                    value={category}
                    onChange={(e) => change({ category: e.target.value })}
                  >
                    <option value="">All categories</option>
                    {Object.entries(dashboardCategories).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className={styles.switch}>
                Unread only
                <input
                  className={styles.checkbox}
                  type="checkbox"
                  checked={unread}
                  onChange={(e) =>
                    change({ unread: e.target.checked ? "1" : "0" })
                  }
                />
              </label>
            </div>
          </div>
          {error ? (
            <p role="alert" className={`${styles.body} ${styles.error}`}>
              {error}
            </p>
          ) : !data ? (
            <p role="status" className={styles.body}>
              Loading notifications…
            </p>
          ) : !data.enabled ? (
            <p className={styles.body}>
              Your account does not have notification access. Ask a Main Admin
              to check your permissions.
            </p>
          ) : data.items.length ? (
            <NotificationRows items={data.items} adminId={data.adminId} />
          ) : (
            <div className={styles.body}>
              <h3 className={styles.title}>No notifications match this view</h3>
              <p className={styles.muted}>
                {selected && !selected.connected
                  ? `${selected.label} is awaiting notification integration.`
                  : unread
                    ? "Turn off Unread only to see notifications you have already read."
                    : "New alerts will appear here when there is activity for your account."}
              </p>
              {(page > 1 || category || priority) && (
                <button
                  type="button"
                  className={styles.button}
                  onClick={() =>
                    change({ page: "1", category: "", priority: "" })
                  }
                >
                  Return to the first page and clear filters
                </button>
              )}
            </div>
          )}
          {data?.enabled && (
            <nav className={styles.header} aria-label="Notification pages">
              <button
                type="button"
                className={styles.button}
                disabled={page === 1 || loading}
                onClick={() => change({ page: String(page - 1) })}
              >
                Previous
              </button>
              <span>Page {page}</span>
              <button
                type="button"
                className={styles.button}
                disabled={!data.hasNext || page === 1000 || loading}
                onClick={() => change({ page: String(page + 1) })}
              >
                Next
              </button>
            </nav>
          )}
        </section>
        <aside className={styles.aside}>
          <section className={`${styles.panel} ${styles.body}`}>
            <h2 className={styles.title}>
              {selected?.label || "Connected sources"}
            </h2>
            <p className={styles.muted}>
              {source === "dashboard"
                ? "Portal announcements and account changes appear here. Reading an alert clears your unread indicator; it does not complete the related task."
                : source === "moderation"
                  ? "Facebook and Instagram review jobs and moderation service alerts appear here."
                  : selected
                    ? `${selected.label}${selected.connected ? " is connected." : " is awaiting notification integration."}`
                    : "Admin Dashboard and Social Media Moderation share this inbox. Each administrator has their own unread state."}
            </p>
            {selected?.settingsHref &&
            ((source === "dashboard" && access?.canDashboard) ||
              (source === "moderation" && access?.canModeration) ||
              (source === "bug_tracker" && canBugTracker)) ? (
              <Link className={styles.button} href={selected.settingsHref}>
                {selected.label} settings
              </Link>
            ) : (
              <p className={styles.muted}>
                {source
                  ? "Notification settings are not available for this source yet."
                  : "Choose a source to open its notification settings."}
              </p>
            )}
            {access?.enabled && (
              <PhonePushSettings
                key={access.adminId}
                buttonClass={styles.button}
              />
            )}
          </section>
          {access?.canDashboard && (
            <section className={`${styles.panel} ${styles.body}`}>
              <DashboardAnnouncement key={access.adminId} />
            </section>
          )}
        </aside>
      </div>
      {access?.canDashboard && (
        <section
          className={`${styles.panel} ${styles.body}`}
          style={{ marginTop: 24 }}
          id="dashboard-notification-settings"
          tabIndex={-1}
          aria-label="Dashboard notification preferences"
        >
          <DashboardNotificationSettings key={access.adminId} />
        </section>
      )}
    </section>
  );
}

export default function NotificationInbox(props: {
  initialSource: NotificationSource | "";
}) {
  return (
    <NotificationDialogs>
      <InboxContent {...props} />
    </NotificationDialogs>
  );
}
