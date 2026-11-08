"use client";

import Link from "next/link";
import { Bell, Inbox as InboxIcon, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { isNotificationSource, notificationSources, type NotificationSource } from "@/lib/notifications/sources";
import { NOTIFICATION_API, NOTIFICATIONS_CHANGED } from "./NotificationBell";
import PhonePushSettings from "./PhonePushSettings";

type Alert = {
  id: string;
  job_id: string;
  platform: "facebook" | "instagram";
  occurred_at: string;
  read_at: string | null;
  reviewed_at: string | null;
};

type Inbox = { enabled: false } | {
  enabled: true;
  items: Alert[];
  hasNext: boolean;
  unreadCount: number;
};

type Result =
  | { key: string; inbox: Inbox }
  | { key: string; error: string };

const londonDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

const control = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/25 bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:opacity-50";
const panel = "min-w-0 rounded-2xl border border-white/15 bg-slate-950/65";
const moderationJobs = "/Admin/SocialMediaModeration/JobsID";
const loadFailure = "Could not load notifications. Check your connection and try again.";

export default function NotificationInbox({ initialSource }: { initialSource: NotificationSource | "" }) {
  const [source, setSource] = useState(initialSource);
  const [unread, setUnread] = useState(false);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const inboxTitle = useRef<HTMLHeadingElement>(null);
  const selectedApp = source ? notificationSources[source] : null;
  const key = `${source}:${unread}:${page}:${revision}`;

  const current = result?.key === key ? result : null;
  const inbox = current && "inbox" in current ? current.inbox : null;
  const loadError = current && "error" in current ? current.error : null;
  const ready = inbox?.enabled ? inbox : null;
  const showFilters = ready || (!current && result && "inbox" in result && result.inbox.enabled);
  const accessLabel = !current ? "Checking access"
    : loadError ? "Check unavailable"
    : ready ? "Pilot active"
    : "Access unavailable";

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), unread: unread ? "1" : "0" });
    if (source) params.set("source", source);

    async function load() {
      try {
        const response = await fetch(`${NOTIFICATION_API}?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const next: Result = response.ok
          ? { key, inbox: await response.json() as Inbox }
          : {
              key,
              error: response.status === 401
                ? "Your admin session has expired. Sign in again, then return to Notifications."
                : loadFailure,
            };
        if (!controller.signal.aborted) setResult(next);
      } catch {
        if (!controller.signal.aborted) setResult({ key, error: loadFailure });
      }
    }

    void load();
    return () => controller.abort();
  }, [key, page, source, unread]);

  function changePage(next: number) {
    setActionError("");
    setActionStatus("");
    setPage(next);
  }

  async function markRead(id: string) {
    setSaving(id);
    setActionError("");
    setActionStatus("");
    try {
      const response = await fetch(`${NOTIFICATION_API}?id=${encodeURIComponent(id)}`, { method: "POST" });
      if (!response.ok) throw new Error("Mark as read failed");

      inboxTitle.current?.focus();
      if (unread && page > 1 && ready?.items.length === 1) setPage(page - 1);
      setRevision((value) => value + 1);
      setActionStatus("Notification marked as read.");
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    } catch {
      setActionError("Could not mark the notification as read. Refresh the inbox and try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="w-full px-4 py-8 sm:px-6 sm:py-12" aria-labelledby="notifications-title">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/15 pb-6">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-purple-200">
            <Bell size={16} aria-hidden="true" />
            Admin Portal
          </p>
          <h1 id="notifications-title" className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Notification Centre
          </h1>
          <p className="mt-2 text-sm text-slate-300 sm:text-base">
            Review alerts from your Admin Portal apps in one place.
          </p>
        </div>
        <button
          type="button"
          className={control}
          disabled={!current || saving !== null}
          onClick={() => {
            setActionError("");
            setActionStatus("");
            setRevision((value) => value + 1);
            window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh notifications
        </button>
      </header>

      <dl className="my-6 grid gap-3 sm:grid-cols-3" aria-label="Notification overview">
        <div className={`${panel} border-t-2 border-t-purple-300 px-4 py-4 sm:px-5`}>
          <dt className="text-sm font-semibold text-slate-300">Unread notifications</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums">
            {ready ? ready.unreadCount.toLocaleString("en-GB") : <span className="text-base font-semibold text-slate-300">Unavailable</span>}
          </dd>
          <dd className="mt-1 text-sm text-slate-300">Across all available sources</dd>
        </div>
        <div className={`${panel} px-4 py-4 sm:px-5`}>
          <dt className="text-sm font-semibold text-slate-300">Pilot access</dt>
          <dd className="mt-2 text-base font-semibold">{accessLabel}</dd>
          <dd className="mt-1 text-sm text-slate-300">For your signed-in account</dd>
        </div>
        <div className={`${panel} px-4 py-4 sm:px-5`}>
          <dt className="text-sm font-semibold text-slate-300">Pilot delivery</dt>
          <dd className="mt-2 text-base font-semibold">In-app and phone push</dd>
          <dd className="mt-1 text-sm text-slate-300">Enable phone push on each device</dd>
        </div>
      </dl>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <section className={panel} aria-labelledby="notification-inbox-title">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 p-4 sm:p-5">
            <h2
              ref={inboxTitle}
              id="notification-inbox-title"
              tabIndex={-1}
              className="flex items-center gap-2 text-lg font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300"
            >
              <InboxIcon aria-hidden="true" size={19} className="text-purple-200" />
              Inbox
            </h2>
            {showFilters && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <label className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-200">
                  Source
                  <select className={control} value={source} disabled={saving !== null} onChange={(event) => {
                    changePage(1);
                    setSource(isNotificationSource(event.target.value) ? event.target.value : "");
                  }}>
                    <option value="">All apps</option>
                    {Object.entries(notificationSources).map(([key, app]) => (
                      <option key={key} value={key}>{app.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-200">
                  <input
                    type="checkbox"
                    checked={unread}
                    disabled={saving !== null}
                    onChange={(event) => {
                      changePage(1);
                      setUnread(event.target.checked);
                    }}
                    className="size-4 accent-purple-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300"
                  />
                  Unread only
                </label>
              </div>
            )}
          </div>

          <p role="status" className="sr-only">{actionStatus}</p>
          {actionError && <p role="alert" className="px-4 pt-4 text-sm text-rose-200 sm:px-5">{actionError}</p>}

          {!current ? (
            <p role="status" className="p-5 text-sm text-slate-300">Loading notifications…</p>
          ) : loadError ? (
            <p role="alert" className="p-5 text-sm text-rose-200">{loadError}</p>
          ) : !ready ? (
            <div className="p-5">
              <h3 className="font-semibold">Set up access to the notification pilot</h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
                This session does not have pilot access. Sign in as the Main Admin assigned to the pilot.
                If you manage the portal, check that the pilot entry uses that account’s <code>admin_users.id</code>.
                Once access is set up, select Refresh notifications.
              </p>
            </div>
          ) : (
            <>
              {ready.items.length === 0 ? (
                <div className="p-5">
                  <h3 className="font-semibold">{unread ? "No unread notifications on this page" : "No notifications on this page"}</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    {page > 1 ? "Go back to the previous page to see earlier results."
                      : selectedApp && !selectedApp.connected ? `${selectedApp.label} is awaiting notification integration.`
                      : unread ? "Turn off Unread only to see alerts you’ve already read."
                      : "New moderation jobs flagged for review will appear here."}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-white/15">
                  {ready.items.map((item) => (
                    <li
                      key={item.id}
                      className={`flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 ${item.read_at ? "" : "bg-purple-300/5"}`}
                    >
                      <div>
                        <p className="text-xs font-semibold text-purple-200">
                          Social Media Moderation · {item.platform === "facebook" ? "Facebook" : "Instagram"}
                        </p>
                        <h3 className="mt-1 font-semibold">{item.reviewed_at ? "Comment reviewed" : "Comment needs review"}</h3>
                        <p className="mt-1 text-sm text-slate-300">
                          <time dateTime={item.occurred_at}>{londonDate.format(new Date(item.occurred_at))}</time>
                          {" · "}
                          <span className={item.read_at ? "" : "font-semibold text-purple-200"}>
                            {item.read_at ? "Read" : "Unread"}
                          </span>
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link className={control} href={`${moderationJobs}?job=${encodeURIComponent(item.job_id)}`}>
                          View job
                        </Link>
                        {!item.read_at && (
                          <button className={control} type="button" disabled={saving !== null} onClick={() => void markRead(item.id)}>
                            {saving === item.id ? "Saving…" : "Mark as read"}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {(page > 1 || ready.hasNext) && (
                <nav aria-label="Notification pages" className="flex flex-wrap items-center gap-3 border-t border-white/15 p-4 sm:px-5">
                  <button type="button" className={control} disabled={page === 1 || saving !== null} onClick={() => {
                    inboxTitle.current?.focus();
                    changePage(page - 1);
                  }}>Previous</button>
                  <span className="text-sm tabular-nums text-slate-300">Page {page}</span>
                  <button type="button" className={control} disabled={!ready.hasNext || page === 1000 || saving !== null} onClick={() => {
                    inboxTitle.current?.focus();
                    changePage(page + 1);
                  }}>Next</button>
                </nav>
              )}
            </>
          )}
        </section>

        <aside className={`${panel} p-5`} aria-labelledby="notification-pilot-title">
          <h2 id="notification-pilot-title" className="flex items-center gap-2 font-bold">
            <ShieldCheck aria-hidden="true" size={18} className="text-purple-200" />
            Pilot source
          </h2>
          <h3 className="mt-4 text-sm font-semibold">Social Media Moderation</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">
            New Facebook and Instagram jobs flagged for review appear in this inbox.
          </p>
          <p className="mt-4 border-t border-white/15 pt-4 text-sm leading-relaxed text-slate-300">
            Mark as read clears the unread indicator. Open the job to review the comment.
          </p>
          {showFilters && <PhonePushSettings buttonClass={control} />}
        </aside>
      </div>
    </section>
  );
}
