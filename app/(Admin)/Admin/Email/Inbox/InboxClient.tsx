"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Mail,
  MailOpen,
  RefreshCw,
  Search,
  Link2,
} from "lucide-react";

type InboxItem = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  unread: boolean;
  labelIds: string[];
};

type MessageDetail = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string;
  snippet: string;
  html: string;
  text: string;
  labelIds: string[];
};

type Notice =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

const GMAIL_RECONNECT_REGEX =
  /No Gmail account connected|Missing Gmail refresh token|Failed to refresh Gmail token/i;

export default function InboxClient() {
  const [messages, setMessages] = useState<InboxItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(
    null
  );
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [notice, setNotice] = useState<Notice>(null);

  const needsReconnect =
    notice?.type === "error" && GMAIL_RECONNECT_REGEX.test(notice.message);

  async function loadInbox(search = "") {
    try {
      setLoadingList(true);
      setNotice(null);

      const res = await fetch(
        `/api/admin/email/inbox?q=${encodeURIComponent(
          search
        )}&maxResults=25`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load inbox.");
      }

      const nextMessages = Array.isArray(data.messages) ? data.messages : [];
      setMessages(nextMessages);

      if (nextMessages.length > 0) {
        const keepCurrent =
          nextMessages.find((m: InboxItem) => m.id === selectedId)?.id || "";
        const nextSelectedId = keepCurrent || nextMessages[0].id;
        setSelectedId(nextSelectedId);
      } else {
        setSelectedId("");
        setSelectedMessage(null);
      }
    } catch (error) {
      setMessages([]);
      setSelectedId("");
      setSelectedMessage(null);
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to load inbox.",
      });
    } finally {
      setLoadingList(false);
    }
  }

  async function loadMessage(id: string) {
    try {
      setLoadingMessage(true);
      setNotice((current) =>
        current?.type === "error" && !needsReconnect ? null : current
      );

      const res = await fetch(`/api/admin/email/message/${id}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load email.");
      }

      setSelectedMessage(data.message);

      await fetch(`/api/admin/email/message/${id}/read`, {
        method: "POST",
      }).catch(() => null);

      setMessages((current) =>
        current.map((item) =>
          item.id === id ? { ...item, unread: false } : item
        )
      );
    } catch (error) {
      setSelectedMessage(null);
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to load email.",
      });
    } finally {
      setLoadingMessage(false);
    }
  }

  async function handleRefresh() {
    try {
      setRefreshing(true);
      await loadInbox(query);
      setNotice({ type: "success", message: "Inbox refreshed." });
    } catch {
      // handled inside loadInbox
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadInbox();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadMessage(selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!notice) return;

    if (notice.type === "error" && GMAIL_RECONNECT_REGEX.test(notice.message)) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selectedPreview = useMemo(() => {
    if (!selectedMessage) return "";
    return selectedMessage.text || selectedMessage.snippet || "";
  }, [selectedMessage]);

  return (
    <div className="min-h-screen bg-transparent text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Inbox</h1>
              <p className="mt-1 text-sm text-white/70">
                View your Google email inbox inside the admin portal.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setQuery(searchInput);
                  loadInbox(searchInput);
                }}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2"
              >
                <Search className="h-4 w-4 text-white/60" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search inbox..."
                  className="w-56 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                />
              </form>

              <button
                onClick={handleRefresh}
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/15"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </button>
            </div>
          </div>
        </div>

        {notice && (
          <div
            className={`mb-4 flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
              notice.type === "success"
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                : "border-red-400/30 bg-red-500/10 text-red-200"
            }`}
          >
            <span>{notice.message}</span>

            {needsReconnect ? (
              <a
                href="/api/google/connect"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 font-medium text-white transition hover:bg-white/15"
              >
                <Link2 className="h-4 w-4" />
                Reconnect Google
              </a>
            ) : null}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
            <div className="border-b border-white/10 px-4 py-3">
              <h2 className="text-sm font-semibold text-white/80">Messages</h2>
            </div>

            <div className="max-h-[75vh] overflow-y-auto">
              {loadingList ? (
                <div className="flex items-center justify-center py-16 text-white/60">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-white/50">
                  <p>No emails found.</p>

                  {needsReconnect ? (
                    <div className="mt-4">
                      <a
                        href="/api/admin/google/connect"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 font-medium text-white transition hover:bg-white/15"
                      >
                        <Link2 className="h-4 w-4" />
                        Reconnect Google
                      </a>
                    </div>
                  ) : null}
                </div>
              ) : (
                messages.map((message) => {
                  const active = selectedId === message.id;

                  return (
                    <button
                      key={message.id}
                      onClick={() => setSelectedId(message.id)}
                      className={`w-full border-b border-white/5 px-4 py-4 text-left transition ${
                        active ? "bg-white/10" : "hover:bg-white/5"
                      }`}
                    >
                      <div className="mb-1 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          {message.unread ? (
                            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-pink-300" />
                          ) : (
                            <MailOpen className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                          )}
                          <span
                            className={`truncate text-sm ${
                              message.unread
                                ? "font-semibold text-white"
                                : "text-white/80"
                            }`}
                          >
                            {message.from || "Unknown sender"}
                          </span>
                        </div>

                        <span className="shrink-0 text-[11px] text-white/40">
                          {formatDate(message.date)}
                        </span>
                      </div>

                      <div
                        className={`truncate text-sm ${
                          message.unread
                            ? "font-medium text-white"
                            : "text-white/75"
                        }`}
                      >
                        {message.subject || "(No subject)"}
                      </div>

                      <p className="mt-1 line-clamp-2 text-xs text-white/45">
                        {message.snippet}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
            <div className="border-b border-white/10 px-5 py-4">
              {selectedMessage ? (
                <>
                  <h2 className="text-lg font-semibold">
                    {selectedMessage.subject || "(No subject)"}
                  </h2>

                  <div className="mt-2 space-y-1 text-sm text-white/65">
                    <p>
                      <span className="text-white/40">From:</span>{" "}
                      {selectedMessage.from || "-"}
                    </p>
                    <p>
                      <span className="text-white/40">To:</span>{" "}
                      {selectedMessage.to || "-"}
                    </p>
                    {selectedMessage.cc ? (
                      <p>
                        <span className="text-white/40">CC:</span>{" "}
                        {selectedMessage.cc}
                      </p>
                    ) : null}
                    <p>
                      <span className="text-white/40">Date:</span>{" "}
                      {formatDateLong(selectedMessage.date)}
                    </p>
                  </div>
                </>
              ) : (
                <h2 className="text-lg font-semibold">Select an email</h2>
              )}
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-5 py-5">
              {loadingMessage ? (
                <div className="flex items-center justify-center py-16 text-white/60">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : !selectedMessage ? (
                <div className="py-16 text-center text-sm text-white/50">
                  {needsReconnect ? (
                    <div className="flex flex-col items-center gap-4">
                      <p>Your Google inbox is not connected right now.</p>
                      <a
                        href="/api/google/connect"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 font-medium text-white transition hover:bg-white/15"
                      >
                        <Link2 className="h-4 w-4" />
                        Reconnect Google
                      </a>
                    </div>
                  ) : (
                    "Choose a message from the inbox."
                  )}
                </div>
              ) : selectedMessage.html ? (
                <div
                  className="prose prose-invert max-w-none prose-p:text-white/80 prose-a:text-pink-300"
                  dangerouslySetInnerHTML={{ __html: selectedMessage.html }}
                />
              ) : (
                <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-white/80">
                  {selectedPreview || "No message content found."}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatDateLong(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}