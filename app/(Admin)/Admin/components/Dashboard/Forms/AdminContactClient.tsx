"use client";

import { useEffect, useMemo, useState } from "react";

type ContactStatus = "new" | "in_progress" | "done";
type PanelType = "message" | "read-empty";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: ContactStatus;
  is_read: boolean;
  created_at: string;
};

type ContactApiResponse = {
  ok?: boolean;
  error?: string;
  messages?: ContactMessage[];
  message?: ContactMessage;
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

function statusLabel(status: ContactStatus) {
  if (status === "in_progress") return "In Progress";
  if (status === "done") return "Done";
  return "New";
}

function statusBadgeClass(status: ContactStatus) {
  if (status === "done") {
    return "bg-green-500/25 text-green-100 border border-green-300/30";
  }

  if (status === "in_progress") {
    return "bg-yellow-500/25 text-yellow-100 border border-yellow-300/30";
  }

  return "bg-blue-500/25 text-blue-100 border border-blue-300/30";
}

async function parseJsonResponse<T = ContactApiResponse>(res: Response): Promise<T> {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : ({} as T);
  } catch {
    if (text.trim().startsWith("<")) {
      throw new Error(
        "The server returned HTML instead of JSON. This usually means the API route is missing, blocked by middleware, or redirected."
      );
    }

    throw new Error("The server returned invalid JSON.");
  }
}

export default function AdminContactClient() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelType>("message");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const selected = useMemo(
    () => messages.find((m) => m.id === selectedId) || null,
    [messages, selectedId]
  );

  const unreadMessages = useMemo(() => messages.filter((m) => !m.is_read), [messages]);
  const readMessages = useMemo(() => messages.filter((m) => m.is_read), [messages]);

  useEffect(() => {
    void loadMessages();
  }, []);

  function showNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => {
      setNotice(null);
    }, 1800);
  }

  function updateMessageInState(
    id: string,
    updater: (message: ContactMessage) => ContactMessage
  ) {
    setMessages((prev) => {
      const updatedList = prev.map((m) => (m.id === id ? updater(m) : m));
      const changed = updatedList.find((m) => m.id === id);
      const others = updatedList.filter((m) => m.id !== id);
      return changed ? [changed, ...others] : updatedList;
    });
  }

  async function loadMessages() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/contact", {
        cache: "no-store",
      });

      const data = await parseJsonResponse<ContactApiResponse>(res);

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Failed to load messages");
      }

      const list: ContactMessage[] = Array.isArray(data?.messages) ? data.messages : [];
      setMessages(list);

      if (list.length > 0) {
        setSelectedId((current) => {
          if (current && list.some((m) => m.id === current)) return current;
          return list[0]?.id || null;
        });
        setPanel("message");
      } else {
        setSelectedId(null);
        setPanel("read-empty");
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string, value: boolean) {
    try {
      setBusyId(id);
      setError(null);

      const res = await fetch(`/api/admin/contact/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_read: value }),
      });

      const data = await parseJsonResponse<ContactApiResponse>(res);

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Failed to update read status");
      }

      const updated = data?.message;

      updateMessageInState(id, (m) =>
        updated ? { ...m, ...updated } : { ...m, is_read: value }
      );

      if (value) {
        showNotice("Moved to Read Contact");
      } else {
        showNotice("Moved back to Inbox");
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to update read status");
    } finally {
      setBusyId(null);
    }
  }

  async function updateStatus(id: string, status: ContactStatus) {
    try {
      setBusyId(id);
      setError(null);

      const currentMessage = messages.find((m) => m.id === id);
      if (!currentMessage) {
        throw new Error("Message not found");
      }

      const nextIsRead = status === "done" ? true : currentMessage.is_read;

      updateMessageInState(id, (m) => ({
        ...m,
        status,
        is_read: nextIsRead,
      }));

      if (selectedId === id) {
        setSelectedId(id);
        setPanel("message");
      }

      const res = await fetch(`/api/admin/contact/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          is_read: nextIsRead,
        }),
      });

      const data = await parseJsonResponse<ContactApiResponse>(res);

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Failed to update status");
      }

      const updated = data?.message;

      updateMessageInState(id, (m) => {
        if (updated) {
          return {
            ...m,
            ...updated,
            status,
            is_read: updated.is_read ?? nextIsRead,
          };
        }

        return {
          ...m,
          status,
          is_read: nextIsRead,
        };
      });

      if (status === "done") {
        showNotice("Status changed to Done and moved to Read Contact");
      } else {
        showNotice(`Status changed to ${statusLabel(status)}`);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to update status");
      await loadMessages();
    } finally {
      setBusyId(null);
    }
  }

  async function deleteMessage(id: string) {
    try {
      setBusyId(id);
      setError(null);

      const res = await fetch(`/api/admin/contact/${id}`, {
        method: "DELETE",
      });

      const data = await parseJsonResponse<ContactApiResponse>(res);

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Failed to delete message");
      }

      setMessages((prev) => {
        const remaining = prev.filter((m) => m.id !== id);

        if (remaining.length === 0) {
          setSelectedId(null);
          setPanel("read-empty");
          return remaining;
        }

        if (selectedId === id) {
          setSelectedId(remaining[0]?.id || null);
          setPanel("message");
        }

        return remaining;
      });

      setConfirmDeleteId(null);
      showNotice("Message deleted");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to delete message");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteAllMessages() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/contact/delete-all", {
        method: "DELETE",
      });

      const data = await parseJsonResponse<ContactApiResponse>(res);

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Failed to delete all messages");
      }

      setMessages([]);
      setSelectedId(null);
      setPanel("read-empty");
      setConfirmDeleteAll(false);
      setConfirmDeleteId(null);
      showNotice("All messages deleted");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to delete all messages");
    } finally {
      setLoading(false);
    }
  }

  function renderMessageButton(m: ContactMessage) {
    const active = panel === "message" && selectedId === m.id;
    const isDeleting = busyId === m.id;
    const isConfirmingDelete = confirmDeleteId === m.id;

    return (
      <div
        key={m.id}
        className={`w-full border-b border-white/10 px-4 py-4 transition last:border-b-0 ${
          active ? "bg-white/20" : "hover:bg-white/10"
        }`}
      >
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
          <button
            type="button"
            onClick={() => {
              setSelectedId(m.id);
              setPanel("message");
            }}
            className="min-w-0 flex-1 cursor-pointer text-left"
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold">{m.name}</p>
                <p className="truncate text-sm opacity-80">{m.email}</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusBadgeClass(
                    m.status
                  )}`}
                >
                  {statusLabel(m.status)}
                </span>

                {!m.is_read && <span className="h-2.5 w-2.5 rounded-full bg-pink-400" />}
              </div>
            </div>

            <p className="mt-2 truncate text-sm opacity-90">
              {m.subject || "No subject"}
            </p>

            <p className="mt-1 text-xs opacity-70">{formatDate(m.created_at)}</p>
          </button>

          {!isConfirmingDelete ? (
            <button
              type="button"
              disabled={isDeleting || loading}
              onClick={() => setConfirmDeleteId(m.id)}
              className="w-full shrink-0 cursor-pointer rounded-xl bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/35 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              aria-label={`Delete message from ${m.name}`}
            >
              Delete
            </button>
          ) : (
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto">
              <button
                type="button"
                disabled={isDeleting || loading}
                onClick={() => void deleteMessage(m.id)}
                className="cursor-pointer rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Confirm"}
              </button>

              <button
                type="button"
                disabled={isDeleting || loading}
                onClick={() => setConfirmDeleteId(null)}
                className="cursor-pointer rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const selectedIsDeleting = selected ? busyId === selected.id : false;
  const selectedIsConfirmingDelete = selected ? confirmDeleteId === selected.id : false;
  const disableStatusButtons = !!selected?.is_read;

  return (
    <main className="min-h-screen overflow-x-hidden  px-3 py-6 text-white sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
              Contact Messages
            </h1>
            <p className="mt-3 text-base text-white/80 sm:text-lg">
              Manage messages from your website contact form
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={() => void loadMessages()}
              disabled={loading}
              className="w-full cursor-pointer rounded-2xl bg-white/15 px-5 py-3 font-semibold transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>

            {!confirmDeleteAll ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(true)}
                disabled={loading || messages.length === 0}
                className="w-full cursor-pointer rounded-2xl bg-red-600 px-5 py-3 font-semibold transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Delete All
              </button>
            ) : (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => void deleteAllMessages()}
                  disabled={loading}
                  className="cursor-pointer rounded-2xl bg-red-700 px-5 py-3 font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Deleting..." : "Confirm Delete All"}
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmDeleteAll(false)}
                  disabled={loading}
                  className="cursor-pointer rounded-2xl bg-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {notice && (
          <div className="mb-4 rounded-2xl border border-green-300/30 bg-green-500/20 px-4 py-3 text-green-50">
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-300/30 bg-red-500/20 px-4 py-3 text-red-50">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="min-w-0 space-y-6">
            <div className="overflow-hidden rounded-3xl border border-white/20 bg-white/10 backdrop-blur-md">
              <div className="border-b border-white/20 px-4 py-4 sm:px-5">
                <h2 className="text-xl font-semibold sm:text-2xl">Inbox</h2>
                <p className="text-sm opacity-80">
                  {loading ? "Loading..." : `${unreadMessages.length} unread`}
                </p>
              </div>

              <div className="max-h-[42vh] overflow-y-auto">
                {!loading && unreadMessages.length === 0 && (
                  <div className="px-4 py-5 text-white/70 sm:px-5">
                    No unread messages.
                  </div>
                )}

                {unreadMessages.map(renderMessageButton)}
              </div>
            </div>

            <div
              className={`overflow-hidden rounded-3xl border border-white/20 bg-white/10 text-left backdrop-blur-md transition ${
                panel === "read-empty" ? "ring-2 ring-white/30" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  if (readMessages.length > 0) {
                    setSelectedId(readMessages[0].id);
                    setPanel("message");
                  } else {
                    setSelectedId(null);
                    setPanel("read-empty");
                  }
                }}
                className="w-full cursor-pointer border-b border-white/20 px-4 py-4 text-left transition hover:bg-white/15 sm:px-5"
              >
                <h2 className="text-xl font-semibold sm:text-2xl">Read Contact</h2>
                <p className="text-sm opacity-80">
                  {loading ? "Loading..." : `${readMessages.length} read`}
                </p>
              </button>

              <div className="max-h-[42vh] overflow-y-auto">
                {!loading && readMessages.length === 0 ? (
                  <div className="px-4 py-5 text-white/70 sm:px-5">
                    No read messages.
                  </div>
                ) : (
                  readMessages.map(renderMessageButton)
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-3xl border border-white/20 bg-white/10 p-4 backdrop-blur-md sm:p-6">
            {panel === "read-empty" ? (
              <div className="flex min-h-[320px] items-center justify-center text-center">
                <div>
                  <h2 className="text-2xl font-bold">Read Contact</h2>
                  <p className="mt-3 text-white/75">No read messages yet.</p>
                  <p className="mt-1 text-white/60">
                    Messages you mark as read will appear here.
                  </p>
                </div>
              </div>
            ) : !selected ? (
              <p className="opacity-70">Select a message</p>
            ) : (
              <div className="min-w-0">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    disabled={busyId === selected.id || loading}
                    onClick={() => void markRead(selected.id, !selected.is_read)}
                    className="cursor-pointer rounded-2xl bg-white/20 px-4 py-2.5 transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyId === selected.id
                      ? "Saving..."
                      : selected.is_read
                      ? "Mark Unread"
                      : "Mark Read"}
                  </button>

                  <a
                    href={`mailto:${selected.email}`}
                    className="rounded-2xl bg-white/20 px-4 py-2.5 text-center transition hover:bg-white/30"
                  >
                    Reply
                  </a>

                  {!selectedIsConfirmingDelete ? (
                    <button
                      type="button"
                      disabled={selectedIsDeleting || loading}
                      onClick={() => setConfirmDeleteId(selected.id)}
                      className="cursor-pointer rounded-2xl bg-red-500 px-4 py-2.5 transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Delete
                    </button>
                  ) : (
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        disabled={selectedIsDeleting || loading}
                        onClick={() => void deleteMessage(selected.id)}
                        className="cursor-pointer rounded-2xl bg-red-600 px-4 py-2.5 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {selectedIsDeleting ? "Deleting..." : "Confirm Delete"}
                      </button>

                      <button
                        type="button"
                        disabled={selectedIsDeleting || loading}
                        onClick={() => setConfirmDeleteId(null)}
                        className="cursor-pointer rounded-2xl bg-white/15 px-4 py-2.5 font-semibold text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <span
                    className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold sm:ml-auto ${statusBadgeClass(
                      selected.status
                    )}`}
                  >
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <h2 className="break-words text-2xl font-bold sm:text-3xl">
                  {selected.name}
                </h2>
                <p className="mb-2 break-all text-white/80">{selected.email}</p>

                <p className="mb-4 break-words text-lg font-semibold">
                  {selected.subject || "No subject"}
                </p>

                <div className="mb-6 rounded-2xl border border-white/20 bg-white/10 p-4 sm:p-5">
                  <p className="whitespace-pre-wrap break-words">{selected.message}</p>
                </div>

                {disableStatusButtons ? (
                  <p className="mb-4 text-sm text-white/70">
                    Status buttons are disabled for messages in Read Contact.
                  </p>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    disabled={
                      disableStatusButtons ||
                      busyId === selected.id ||
                      loading ||
                      selected.status === "new"
                    }
                    onClick={() => void updateStatus(selected.id, "new")}
                    className={`rounded-2xl px-4 py-3 font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected.status === "new"
                        ? "bg-blue-700 ring-2 ring-blue-300/40"
                        : "bg-blue-500 hover:bg-blue-600"
                    }`}
                  >
                    New
                  </button>

                  <button
                    type="button"
                    disabled={
                      disableStatusButtons ||
                      busyId === selected.id ||
                      loading ||
                      selected.status === "in_progress"
                    }
                    onClick={() => void updateStatus(selected.id, "in_progress")}
                    className={`rounded-2xl px-4 py-3 font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected.status === "in_progress"
                        ? "bg-yellow-700 ring-2 ring-yellow-300/40"
                        : "bg-yellow-500 hover:bg-yellow-600"
                    }`}
                  >
                    In Progress
                  </button>

                  <button
                    type="button"
                    disabled={
                      disableStatusButtons ||
                      busyId === selected.id ||
                      loading ||
                      selected.status === "done"
                    }
                    onClick={() => void updateStatus(selected.id, "done")}
                    className={`rounded-2xl px-4 py-3 font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected.status === "done"
                        ? "bg-green-700 ring-2 ring-green-300/40"
                        : "bg-green-500 hover:bg-green-600"
                    }`}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}