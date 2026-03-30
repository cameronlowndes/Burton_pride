"use client";

import { useEffect, useMemo, useState } from "react";
import {
  History,
  Loader2,
  RefreshCw,
  Trash2,
  Mail,
  X,
  Eye,
  Search,
  AlertTriangle,
} from "lucide-react";

type EmailItem = {
  id: string;
  to: string;
  cc?: string | null;
  bcc?: string | null;
  subject: string;
  message?: string | null;
  html?: string | null;
  status?: string | null;
  created_at: string;
};

type HistoryResponse = {
  ok: boolean;
  items?: EmailItem[];
  error?: string;
};

type Notice =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

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

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function NoticeBanner({ notice }: { notice: Notice }) {
  if (!notice) return null;

  return (
    <div
      className={clsx(
        "rounded-2xl border px-4 py-3 text-sm",
        notice.type === "success"
          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
          : "border-rose-400/30 bg-rose-500/10 text-rose-100"
      )}
    >
      {notice.message}
    </div>
  );
}

function ConfirmModal({
  open,
  title,
  description,
  confirmText,
  cancelText = "Cancel",
  confirmTone = "danger",
  loading = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  cancelText?: string;
  confirmTone?: "danger" | "default";
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onCancel}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0a1022] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3">
              <AlertTriangle className="h-5 w-5 text-rose-200" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-7 text-white/60">
                {description}
              </p>
            </div>

            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="inline-flex min-h-[46px] items-center rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white transition hover:bg-white/[0.10] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cancelText}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={clsx(
                "inline-flex min-h-[46px] items-center rounded-2xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                confirmTone === "danger"
                  ? "border border-rose-400/20 bg-rose-600 text-white hover:bg-rose-500"
                  : "border border-fuchsia-400/20 bg-fuchsia-600 text-white hover:bg-fuchsia-500"
              )}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Working...
                </span>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmailHistoryPage() {
  const [items, setItems] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deletingOne, setDeletingOne] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<Notice>(null);

  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [emailToDelete, setEmailToDelete] = useState<EmailItem | null>(null);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/email/history", {
        cache: "no-store",
      });

      const data: HistoryResponse = await res.json();

      if (res.ok && data.ok) {
        setItems(data.items || []);
      } else {
        setItems([]);
        setNotice({
          type: "error",
          message: data.error || "Failed to load email history.",
        });
      }
    } catch {
      setItems([]);
      setNotice({
        type: "error",
        message: "Failed to load email history.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function confirmDeleteOne() {
    if (!emailToDelete) return;

    try {
      setDeletingOne(true);
      setNotice(null);

      const res = await fetch(`/api/admin/email/history/${emailToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete email record.");
      }

      if (selectedEmail?.id === emailToDelete.id) {
        setSelectedEmail(null);
      }

      setEmailToDelete(null);
      setNotice({
        type: "success",
        message: "Email record deleted successfully.",
      });

      await load();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to delete email record.",
      });
    } finally {
      setDeletingOne(false);
    }
  }

  async function confirmDeleteAll() {
    try {
      setDeletingAll(true);
      setNotice(null);

      const res = await fetch("/api/admin/email/history", {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete all email history.");
      }

      setSelectedEmail(null);
      setShowDeleteAllModal(false);
      setNotice({
        type: "success",
        message: "All email history has been deleted.",
      });

      await load();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete all email history.",
      });
    } finally {
      setDeletingAll(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedEmail(null);
        setShowDeleteAllModal(false);
        setEmailToDelete(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) => {
      return (
        item.to?.toLowerCase().includes(q) ||
        item.cc?.toLowerCase().includes(q) ||
        item.bcc?.toLowerCase().includes(q) ||
        item.subject?.toLowerCase().includes(q) ||
        item.message?.toLowerCase().includes(q) ||
        item.html?.toLowerCase().includes(q) ||
        item.status?.toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  return (
    <>
      <div className="p-4 md:p-6 lg:p-8">
        <div className="rounded-3xl border border-white/10 bg-[#0a1022]/80 p-6 shadow-2xl backdrop-blur-xl md:p-8">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-3">
                <History className="h-6 w-6 text-fuchsia-200" />
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">
                  Email History
                </h1>
                <p className="mt-2 text-sm text-white/60">
                  Click any email record to open the full content in a floating window.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={load}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white transition hover:bg-white/[0.10]"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>

              <button
                onClick={() => setShowDeleteAllModal(true)}
                disabled={deletingAll}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete all
              </button>
            </div>
          </div>

          <div className="mb-4">
            <NoticeBanner notice={notice} />
          </div>

          <div className="mb-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by email, subject, status, or message..."
                className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-fuchsia-400/30 focus:bg-white/[0.04]"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading email history...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-white/60">
              No emails found.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedEmail(item)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 shrink-0 text-fuchsia-200" />
                        <p className="truncate text-sm font-semibold text-white">
                          {item.subject || "No subject"}
                        </p>
                      </div>

                      <p className="mt-2 truncate text-sm text-white/65">
                        To: {item.to}
                      </p>

                      <p className="mt-1 text-xs text-white/40">
                        {formatDate(item.created_at)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={clsx(
                          "rounded-full px-3 py-1 text-xs font-medium",
                          item.status === "sent"
                            ? "bg-emerald-500/20 text-emerald-200"
                            : "bg-rose-500/20 text-rose-200"
                        )}
                      >
                        {item.status || "unknown"}
                      </span>

                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70">
                        <Eye className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedEmail ? (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label="Close email details"
            onClick={() => setSelectedEmail(null)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6">
            <div className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#0a1022] shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 md:px-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
                    <Mail className="h-5 w-5 text-fuchsia-200" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Email details
                    </h2>
                    <p className="text-sm text-white/55">
                      Full contact record
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedEmail(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[calc(92vh-76px)] overflow-y-auto px-5 py-5 md:px-6 md:py-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 md:col-span-2">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                      Subject
                    </p>
                    <p className="mt-2 text-base font-semibold text-white">
                      {selectedEmail.subject || "No subject"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                      To
                    </p>
                    <p className="mt-2 break-all text-sm text-white">
                      {selectedEmail.to || "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                      Sent at
                    </p>
                    <p className="mt-2 text-sm text-white">
                      {formatDate(selectedEmail.created_at)}
                    </p>
                  </div>

                  {selectedEmail.cc ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                        CC
                      </p>
                      <p className="mt-2 break-all text-sm text-white">
                        {selectedEmail.cc}
                      </p>
                    </div>
                  ) : null}

                  {selectedEmail.bcc ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                        BCC
                      </p>
                      <p className="mt-2 break-all text-sm text-white">
                        {selectedEmail.bcc}
                      </p>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 md:col-span-2">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                      Status
                    </p>
                    <div className="mt-2">
                      <span
                        className={clsx(
                          "rounded-full px-3 py-1 text-xs font-medium",
                          selectedEmail.status === "sent"
                            ? "bg-emerald-500/20 text-emerald-200"
                            : "bg-rose-500/20 text-rose-200"
                        )}
                      >
                        {selectedEmail.status || "unknown"}
                      </span>
                    </div>
                  </div>

                  {selectedEmail.message ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 md:col-span-2">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                        Plain text message
                      </p>
                      <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/85">
                        {selectedEmail.message}
                      </div>
                    </div>
                  ) : null}

                  {selectedEmail.html ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 md:col-span-2">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                        HTML preview
                      </p>
                      <div className="mt-3 overflow-hidden rounded-xl bg-white p-4 text-slate-900">
                        <div
                          dangerouslySetInnerHTML={{ __html: selectedEmail.html }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {!selectedEmail.message && !selectedEmail.html ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 md:col-span-2 text-sm text-white/60">
                      No saved message content on this record.
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setEmailToDelete(selectedEmail)}
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete this record
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedEmail(null)}
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white transition hover:bg-white/[0.10]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={showDeleteAllModal}
        title="Delete all email history?"
        description="This action cannot be undone. All email history records will be permanently removed."
        confirmText="Delete all"
        loading={deletingAll}
        onCancel={() => setShowDeleteAllModal(false)}
        onConfirm={confirmDeleteAll}
      />

      <ConfirmModal
        open={!!emailToDelete}
        title="Delete this email record?"
        description="This selected email history record will be permanently removed."
        confirmText="Delete record"
        loading={deletingOne}
        onCancel={() => setEmailToDelete(null)}
        onConfirm={confirmDeleteOne}
      />
    </>
  );
}