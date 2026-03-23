"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Mail,
  RefreshCw,
  Reply,
  Trash2,
  AlertTriangle,
} from "lucide-react";

type FeedbackStatus = "new" | "reviewed" | "archived";

type FeedbackRow = {
  id: string;
  name: string | null;
  email: string;
  message: string;
  status: FeedbackStatus;
  is_read: boolean;
  created_at: string;
};

type FeedbackApiResponse = {
  ok: boolean;
  error?: string;
  feedback?: FeedbackRow[];
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status: FeedbackStatus) {
  if (status === "new") {
    return "bg-indigo-500/70 text-white";
  }

  if (status === "reviewed") {
    return "bg-emerald-500/80 text-white";
  }

  return "bg-slate-500/70 text-white";
}

function getStatusLabel(status: FeedbackStatus) {
  if (status === "new") return "New";
  if (status === "reviewed") return "Done";
  return "Archived";
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FeedbackRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<"single" | "all" | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function loadFeedback(showRefresh = false) {
    try {
      setError(null);

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const res = await fetch("/api/admin/feedback", {
        method: "GET",
        cache: "no-store",
      });

      const data: FeedbackApiResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load feedback");
      }

      const feedback = data.feedback || [];
      setItems(feedback);

      if (selected) {
        const updatedSelected = feedback.find((item) => item.id === selected.id);
        setSelected(updatedSelected || null);
      } else {
        setSelected(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feedback");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadFeedback();
  }, []);

  const unreadItems = useMemo(
    () => items.filter((item) => !item.is_read),
    [items]
  );

  const readItems = useMemo(
    () => items.filter((item) => item.is_read),
    [items]
  );

  async function updateFeedback(
    id: string,
    updates: Partial<Pick<FeedbackRow, "status" | "is_read">>
  ) {
    try {
      setActionLoading(true);
      setError(null);

      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update feedback");
      }

      const updated = data.feedback as FeedbackRow;

      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setSelected((prev) => (prev?.id === id ? updated : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update feedback");
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteFeedback(id: string) {
    try {
      setActionLoading(true);
      setError(null);

      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete feedback");
      }

      setItems((prev) => {
        const next = prev.filter((item) => item.id !== id);
        if (selected?.id === id) {
          setSelected(null);
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete feedback");
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteAllFeedback() {
    try {
      setActionLoading(true);
      setError(null);

      const ids = items.map((item) => item.id);

      for (const id of ids) {
        const res = await fetch(`/api/admin/feedback/${id}`, {
          method: "DELETE",
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to delete all feedback");
        }
      }

      setItems([]);
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete all feedback");
    } finally {
      setActionLoading(false);
    }
  }

  function openFeedback(item: FeedbackRow) {
    setSelected(item);
  }

  function handleDeleteClick(id: string) {
    setConfirmType("single");
    setConfirmId(id);
    setConfirmOpen(true);
  }

  function handleDeleteAllClick() {
    setConfirmType("all");
    setConfirmId(null);
    setConfirmOpen(true);
  }

  function closeConfirmModal() {
    if (actionLoading) return;
    setConfirmOpen(false);
    setConfirmType(null);
    setConfirmId(null);
  }

  async function confirmDelete() {
    if (confirmType === "single" && confirmId) {
      await deleteFeedback(confirmId);
    }

    if (confirmType === "all") {
      await deleteAllFeedback();
    }

    setConfirmOpen(false);
    setConfirmId(null);
    setConfirmType(null);
  }

  const disableStatusButtons = !!selected?.is_read;

  return (
    <div className="min-h-screen bg-gradient-to-r px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-6xl font-bold tracking-tight">Contact Messages</h1>
            <p className="mt-4 text-xl text-white/85">
              Manage messages from your website contact form
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => loadFeedback(true)}
              disabled={refreshing || actionLoading}
              className="rounded-2xl bg-white/25 px-6 py-3 text-lg font-semibold text-white backdrop-blur-md transition hover:bg-white/35 disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </span>
            </button>

            <button
              type="button"
              onClick={handleDeleteAllClick}
              disabled={items.length === 0 || actionLoading}
              className="rounded-2xl bg-red-500 px-6 py-3 text-lg font-semibold text-white transition hover:bg-red-400 disabled:opacity-60"
            >
              Delete All
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-300/30 bg-red-500/20 px-5 py-4 text-base text-white">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-5">
            <div className="overflow-hidden rounded-[28px] border border-white/15 bg-white/10 shadow-2xl backdrop-blur-xl">
              <div className="border-b border-white/10 px-5 py-4">
                <h2 className="text-4xl font-bold">Inbox</h2>
                <p className="mt-1 text-lg text-white/75">
                  {unreadItems.length} unread
                </p>
              </div>

              {loading ? (
                <div className="p-5 text-white/75">Loading messages...</div>
              ) : unreadItems.length === 0 ? (
                <div className="p-5 text-white/70">No unread messages.</div>
              ) : (
                <div className="divide-y divide-white/10">
                  {unreadItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openFeedback(item)}
                      className={`w-full px-5 py-4 text-left transition hover:bg-white/10 ${
                        selected?.id === item.id ? "bg-white/10" : ""
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <p className="truncate text-3xl font-bold">
                          {item.name || "No name"}
                        </p>

                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusBadge(
                              item.status
                            )}`}
                          >
                            {getStatusLabel(item.status)}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(item.id);
                            }}
                            className="rounded-full bg-pink-400/30 px-3 py-1 text-xs font-bold text-white transition hover:bg-red-500"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <p className="truncate text-sm text-white/70">{item.email}</p>
                      <p className="mt-2 truncate text-lg text-white/95">{item.message}</p>
                      <p className="mt-1 text-sm text-white/55">
                        {formatDate(item.created_at)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-[28px] border border-white/15 bg-white/10 shadow-2xl backdrop-blur-xl">
              <div className="border-b border-white/10 px-5 py-4">
                <h2 className="text-4xl font-bold">Read Contact</h2>
                <p className="mt-1 text-lg text-white/75">{readItems.length} read</p>
              </div>

              {loading ? (
                <div className="p-5 text-white/75">Loading messages...</div>
              ) : readItems.length === 0 ? (
                <div className="p-5 text-white/60">No read messages.</div>
              ) : (
                <div className="divide-y divide-white/10">
                  {readItems.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelected(item)}
                      className={`w-full px-5 py-4 text-left transition hover:bg-white/10 ${
                        selected?.id === item.id ? "bg-white/10" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-2xl font-bold">
                            {item.name || "No name"}
                          </p>
                          <p className="truncate text-sm text-white/65">
                            {item.email}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusBadge(
                            item.status
                          )}`}
                        >
                          {getStatusLabel(item.status)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/15 bg-white/10 shadow-2xl backdrop-blur-xl">
            {!selected ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center px-8 text-center">
                <Mail className="h-14 w-14 text-white/45" />
                <h3 className="mt-4 text-3xl font-bold">Select a message</h3>
                <p className="mt-2 max-w-md text-lg text-white/70">
                  Open a feedback message from the inbox to read and manage it.
                </p>
              </div>
            ) : (
              <div className="flex min-h-[520px] flex-col">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        updateFeedback(selected.id, {
                          is_read: !selected.is_read,
                          status: !selected.is_read ? "reviewed" : "new",
                        })
                      }
                      disabled={actionLoading}
                      className="rounded-2xl bg-white/20 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/30 disabled:opacity-60"
                    >
                      {selected.is_read ? "Mark Unread" : "Mark Read"}
                    </button>

                    <a
                      href={`mailto:${selected.email}?subject=${encodeURIComponent(
                        "Burton Pride Feedback"
                      )}`}
                      className="rounded-2xl bg-white/20 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/30"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Reply className="h-4 w-4" />
                        Reply
                      </span>
                    </a>

                    <button
                      type="button"
                      onClick={() => handleDeleteClick(selected.id)}
                      disabled={actionLoading}
                      className="rounded-2xl bg-red-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-400 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>

                  <span
                    className={`rounded-full px-4 py-2 text-sm font-bold ${getStatusBadge(
                      selected.status
                    )}`}
                  >
                    {getStatusLabel(selected.status)}
                  </span>
                </div>

                <div className="px-5 pb-6 pt-2">
                  <h2 className="text-5xl font-bold leading-none">
                    {selected.name || "No name"}
                  </h2>

                  <p className="mt-3 text-lg text-white/75">{selected.email}</p>

                  <p className="mt-6 text-3xl font-bold">
                    {selected.is_read ? "Read Message" : "New Message"}
                  </p>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-lg text-white/95">
                    {selected.message}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        updateFeedback(selected.id, {
                          status: "new",
                          is_read: false,
                        })
                      }
                      disabled={actionLoading || disableStatusButtons}
                      className="rounded-2xl bg-indigo-500 px-5 py-3 text-lg font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      New
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateFeedback(selected.id, {
                          status: "reviewed",
                          is_read: true,
                        })
                      }
                      disabled={actionLoading || disableStatusButtons}
                      className="rounded-2xl bg-yellow-500 px-5 py-3 text-lg font-bold text-white transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      In Progress
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateFeedback(selected.id, {
                          status: "reviewed",
                          is_read: true,
                        })
                      }
                      disabled={actionLoading || disableStatusButtons}
                      className="rounded-2xl bg-emerald-500 px-5 py-3 text-lg font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Done
                    </button>
                  </div>

                  <div className="mt-8 flex items-center gap-2 text-sm text-white/55">
                    <Check className="h-4 w-4" />
                    {formatDate(selected.created_at)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/20 bg-gradient-to-br from-pink-500/90 via-purple-500/90 to-blue-500/90 p-6 text-white shadow-2xl backdrop-blur-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500/30">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>

              <div className="flex-1">
                <h3 className="text-2xl font-bold">
                  {confirmType === "all" ? "Delete all messages?" : "Delete this message?"}
                </h3>

                <p className="mt-2 text-sm leading-6 text-white/85">
                  {confirmType === "all"
                    ? "This will permanently remove every feedback message from your admin inbox. This action cannot be undone."
                    : "This message will be permanently removed from your admin inbox. This action cannot be undone."}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeConfirmModal}
                disabled={actionLoading}
                className="rounded-2xl bg-white/20 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/30 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                disabled={actionLoading}
                className="rounded-2xl bg-red-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-400 disabled:opacity-60"
              >
                {actionLoading
                  ? "Deleting..."
                  : confirmType === "all"
                  ? "Yes, Delete All"
                  : "Yes, Delete Message"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}