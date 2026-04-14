"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Mail,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Trash2,
} from "lucide-react";

type DraftItem = {
  id: string;
  to: string;
  cc?: string | null;
  bcc?: string | null;
  subject: string;
  message?: string | null;
  html?: string | null;
  created_at: string;
  updated_at?: string | null;
  attachment_count?: number;
  signature_id?: string | null;
};

type DraftListResponse = {
  ok: boolean;
  items?: DraftItem[];
  error?: string;
};

type DraftReadResponse = {
  ok: boolean;
  item?: DraftItem;
  error?: string;
};

type Notice =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function htmlToPlainText(value?: string | null) {
  return (value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {notice.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
        </div>
        <p>{notice.message}</p>
      </div>
    </div>
  );
}

function FieldLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <label className="mb-2 block text-sm font-medium text-white/85">
      {children}
    </label>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0a1022]/80 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
          {icon}
        </div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function AdminEmailDraftsPage() {
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [query, setQuery] = useState("");
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [selectedDraft, setSelectedDraft] = useState<DraftItem | null>(null);
  const [readingDraft, setReadingDraft] = useState(false);
  const [sendingDraftId, setSendingDraftId] = useState("");
  const [deletingDraftId, setDeletingDraftId] = useState("");

  const filteredDrafts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return drafts;

    return drafts.filter((item) => {
      return (
        item.subject?.toLowerCase().includes(q) ||
        item.to?.toLowerCase().includes(q) ||
        item.cc?.toLowerCase().includes(q) ||
        item.bcc?.toLowerCase().includes(q) ||
        item.message?.toLowerCase().includes(q) ||
        htmlToPlainText(item.html).toLowerCase().includes(q)
      );
    });
  }, [drafts, query]);

  useEffect(() => {
    loadDrafts();
  }, []);

  useEffect(() => {
    if (!selectedDraftId) {
      setSelectedDraft(null);
      return;
    }

    loadDraft(selectedDraftId);
  }, [selectedDraftId]);

  async function loadDrafts() {
    try {
      setLoading(true);
      setNotice(null);

      const res = await fetch("/api/admin/email/drafts", {
        cache: "no-store",
      });

      const data: DraftListResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load drafts.");
      }

      const nextItems = data.items || [];
      setDrafts(nextItems);

      if (nextItems.length > 0) {
        setSelectedDraftId((prev) => {
          if (prev && nextItems.some((item) => item.id === prev)) return prev;
          return nextItems[0].id;
        });
      } else {
        setSelectedDraftId("");
        setSelectedDraft(null);
      }
    } catch (error) {
      setDrafts([]);
      setSelectedDraftId("");
      setSelectedDraft(null);
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to load drafts.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadDraft(id: string) {
    try {
      setReadingDraft(true);

      const res = await fetch(`/api/admin/email/drafts/${id}`, {
        cache: "no-store",
      });

      const data: DraftReadResponse = await res.json();

      if (!res.ok || !data.ok || !data.item) {
        throw new Error(data.error || "Failed to load draft.");
      }

      setSelectedDraft(data.item);
    } catch (error) {
      setSelectedDraft(null);
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to load draft.",
      });
    } finally {
      setReadingDraft(false);
    }
  }

  async function handleDeleteDraft(id: string) {
    try {
      setDeletingDraftId(id);
      setNotice(null);

      const res = await fetch(`/api/admin/email/drafts/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete draft.");
      }

      const remaining = drafts.filter((item) => item.id !== id);
      setDrafts(remaining);

      if (selectedDraftId === id) {
        setSelectedDraftId(remaining[0]?.id || "");
        setSelectedDraft(remaining[0] || null);
      }

      setNotice({
        type: "success",
        message: data.message || "Draft deleted successfully.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to delete draft.",
      });
    } finally {
      setDeletingDraftId("");
    }
  }

  async function handleSendDraft(id: string) {
    try {
      setSendingDraftId(id);
      setNotice(null);

      const res = await fetch(`/api/admin/email/drafts/${id}/send`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to send draft.");
      }

      const remaining = drafts.filter((item) => item.id !== id);
      setDrafts(remaining);

      if (selectedDraftId === id) {
        setSelectedDraftId(remaining[0]?.id || "");
        setSelectedDraft(remaining[0] || null);
      }

      setNotice({
        type: "success",
        message: data.message || "Draft sent successfully.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to send draft.",
      });
    } finally {
      setSendingDraftId("");
    }
  }

  return (
    <div className="min-w-0 p-4 md:p-6 lg:p-8">
      <div className="grid gap-6 xl:grid-cols-[370px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <SectionCard
            title="Draft emails"
            icon={<FileText className="h-5 w-5 text-fuchsia-200" />}
          >
            <div className="space-y-4">
              <NoticeBanner notice={notice} />

              <div>
                <FieldLabel>Search drafts</FieldLabel>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search subject, email or content..."
                    className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-fuchsia-400/30 focus:bg-white/[0.04]"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={loadDrafts}
                  className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white transition hover:bg-white/[0.10]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>

                <Link
                  href="/admin/dashboard/email/send"
                  className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 text-sm font-semibold text-white transition hover:from-fuchsia-500 hover:to-pink-500"
                >
                  <Mail className="h-4 w-4" />
                  New email
                </Link>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
                {loading
                  ? "Loading drafts..."
                  : `${filteredDrafts.length} draft${filteredDrafts.length === 1 ? "" : "s"} found`}
              </div>

              <div className="space-y-3">
                {loading ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-sm text-white/60">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading drafts...
                    </div>
                  </div>
                ) : filteredDrafts.length > 0 ? (
                  filteredDrafts.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedDraftId(item.id)}
                      className={clsx(
                        "block w-full rounded-2xl border px-4 py-4 text-left transition",
                        selectedDraftId === item.id
                          ? "border-fuchsia-400/30 bg-fuchsia-500/10"
                          : "border-white/10 bg-black/20 hover:bg-white/[0.06]"
                      )}
                    >
                      <div className="truncate text-sm font-semibold text-white">
                        {item.subject || "(No subject)"}
                      </div>
                      <div className="mt-1 truncate text-xs text-white/55">
                        To: {item.to || "—"}
                      </div>
                      <div className="mt-2 line-clamp-2 text-xs text-white/45">
                        {item.message ||
                          htmlToPlainText(item.html) ||
                          "No content"}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-[11px] text-white/35">
                          {formatDate(item.updated_at || item.created_at)}
                        </span>
                        <span className="text-[11px] text-white/35">
                          {item.attachment_count || 0} attachment
                          {(item.attachment_count || 0) === 1 ? "" : "s"}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-sm text-white/60">
                    No drafts found.
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        </aside>

        <section className="rounded-3xl border border-white/10 bg-[#0a1022]/80 p-6 shadow-2xl backdrop-blur-xl md:p-8">
          <div className="mb-6 flex items-start gap-4">
            <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-3">
              <Mail className="h-6 w-6 text-fuchsia-200" />
            </div>

            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                <FileText className="h-3.5 w-3.5" />
                Saved drafts
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
                Draft Manager
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65 md:text-base">
                View, edit, send and delete all saved draft emails from one page.
              </p>
            </div>
          </div>

          {!selectedDraftId ? (
            <div className="rounded-3xl border border-white/10 bg-black/20 px-6 py-10 text-center text-white/60">
              No draft selected.
            </div>
          ) : readingDraft ? (
            <div className="rounded-3xl border border-white/10 bg-black/20 px-6 py-10 text-center text-white/60">
              <div className="inline-flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading draft...
              </div>
            </div>
          ) : selectedDraft ? (
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                    To
                  </p>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
                    {selectedDraft.to || "—"}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                    Subject
                  </p>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
                    {selectedDraft.subject || "(No subject)"}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                    CC
                  </p>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/80">
                    {selectedDraft.cc || "—"}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                    BCC
                  </p>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/80">
                    {selectedDraft.bcc || "—"}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                    Created
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {formatDate(selectedDraft.created_at)}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                    Updated
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {formatDate(selectedDraft.updated_at || selectedDraft.created_at)}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                    Attachments
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {selectedDraft.attachment_count || 0}
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">Draft preview</p>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/admin/dashboard/email/send?draft=${selectedDraft.id}`}
                      className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white transition hover:bg-white/[0.10]"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit draft
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleSendDraft(selectedDraft.id)}
                      disabled={sendingDraftId === selectedDraft.id}
                      className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 text-sm font-semibold text-white transition hover:from-fuchsia-500 hover:to-pink-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sendingDraftId === selectedDraft.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Send draft
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteDraft(selectedDraft.id)}
                      disabled={deletingDraftId === selectedDraft.id}
                      className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingDraftId === selectedDraft.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
                  <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-600">
                    <Eye className="h-4 w-4" />
                    Email preview
                  </div>

                  <div className="max-h-[700px] overflow-auto p-4 text-slate-900">
                    {selectedDraft.html ? (
                      <div
                        dangerouslySetInnerHTML={{
                          __html: selectedDraft.html,
                        }}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap text-sm text-slate-800">
                        {selectedDraft.message || "No draft content."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-black/20 px-6 py-10 text-center text-white/60">
              Draft not found.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}