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

export default function AdminContactPage() {
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

  const unreadMessages = useMemo(
    () => messages.filter((m) => !m.is_read),
    [messages]
  );

  const readMessages = useMemo(
    () => messages.filter((m) => m.is_read),
    [messages]
  );

  async function loadMessages() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/contact", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load messages");
      }

      const list: ContactMessage[] = data?.messages || [];
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

  useEffect(() => {
    loadMessages();
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

  async function markRead(id: string, value: boolean) {
    try {
      setBusyId(id);
      setError(null);

      const res = await fetch(`/api/admin/contact/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_read: value }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update read status");
      }

      const updated = data?.message as ContactMessage | undefined;

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

      const body: Partial<ContactMessage> & {
        status: ContactStatus;
        is_read?: boolean;
      } = { status };

      if (status === "done") {
        body.is_read = true;
      }

      const res = await fetch(`/api/admin/contact/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update status");
      }

      const updated = data?.message as ContactMessage | undefined;

      updateMessageInState(id, (m) => {
        if (updated) return { ...m, ...updated };

        return {
          ...m,
          status,
          ...(status === "done" ? { is_read: true } : {}),
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

      const data = await res.json().catch(() => null);

      if (!res.ok) {
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

      const data = await res.json().catch(() => null);

      if (!res.ok) {
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
        className={`border-b border-white/10 p-4 transition hover:bg-white/10 ${
          active ? "bg-white/20" : ""
        }`}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedId(m.id);
              setPanel("message");
            }}
            className="cursor-pointer flex-1 min-w-0 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{m.name}</p>
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

                {!m.is_read && (
                  <span className="h-2 w-2 rounded-full bg-pink-400"></span>
                )}
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
              className="cursor-pointer shrink-0 rounded-xl bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/35 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={`Delete message from ${m.name}`}
            >
              Delete
            </button>
          ) : (
            <div className="flex shrink-0 flex-col gap-2">
              <button
                type="button"
                disabled={isDeleting || loading}
                onClick={() => deleteMessage(m.id)}
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

  return (
    <main className="min-h-screen p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Contact Messages</h1>
            <p className="mt-2 text-white/75">
              Manage messages from your website contact form
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={loadMessages}
              disabled={loading}
              className="cursor-pointer rounded-xl bg-white/15 px-4 py-2 font-semibold transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>

            {!confirmDeleteAll ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(true)}
                disabled={loading || messages.length === 0}
                className="cursor-pointer rounded-xl bg-red-600 px-4 py-2 font-semibold transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Delete All
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={deleteAllMessages}
                  disabled={loading}
                  className="cursor-pointer rounded-xl bg-red-700 px-4 py-2 font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Deleting..." : "Confirm Delete All"}
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmDeleteAll(false)}
                  disabled={loading}
                  className="cursor-pointer rounded-xl bg-white/15 px-4 py-2 font-semibold text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
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

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="flex flex-col gap-6">
            <div className="overflow-hidden rounded-3xl border border-white/20 bg-white/10 backdrop-blur-md">
              <div className="border-b border-white/20 p-4">
                <h2 className="text-xl font-semibold">Inbox</h2>
                <p className="text-sm opacity-80">
                  {loading ? "Loading..." : `${unreadMessages.length} unread`}
                </p>
              </div>

              <div className="max-h-[32vh] overflow-y-auto">
                {!loading && unreadMessages.length === 0 && (
                  <div className="p-4 text-white/70">No unread messages.</div>
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
                className="w-full cursor-pointer border-b border-white/20 p-4 text-left transition hover:bg-white/15"
              >
                <h2 className="text-xl font-semibold">Read Contact</h2>
                <p className="text-sm opacity-80">
                  {loading ? "Loading..." : `${readMessages.length} read`}
                </p>
              </button>

              <div className="max-h-[32vh] overflow-y-auto">
                {!loading && readMessages.length === 0 ? (
                  <div className="p-4 text-white/70">No read messages.</div>
                ) : (
                  readMessages.map(renderMessageButton)
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-md">
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
              <div>
                <div className="mb-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={busyId === selected.id || loading}
                    onClick={() => markRead(selected.id, !selected.is_read)}
                    className="cursor-pointer rounded-xl bg-white/20 px-4 py-2 transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyId === selected.id
                      ? "Saving..."
                      : selected.is_read
                      ? "Mark Unread"
                      : "Mark Read"}
                  </button>

                  <a
                    href={`mailto:${selected.email}`}
                    className="cursor-pointer rounded-xl bg-white/20 px-4 py-2 transition hover:bg-white/30"
                  >
                    Reply
                  </a>

                  {!selectedIsConfirmingDelete ? (
                    <button
                      type="button"
                      disabled={selectedIsDeleting || loading}
                      onClick={() => setConfirmDeleteId(selected.id)}
                      className="cursor-pointer rounded-xl bg-red-500 px-4 py-2 transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Delete
                    </button>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={selectedIsDeleting || loading}
                        onClick={() => deleteMessage(selected.id)}
                        className="cursor-pointer rounded-xl bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {selectedIsDeleting ? "Deleting..." : "Confirm Delete"}
                      </button>

                      <button
                        type="button"
                        disabled={selectedIsDeleting || loading}
                        onClick={() => setConfirmDeleteId(null)}
                        className="cursor-pointer rounded-xl bg-white/15 px-4 py-2 font-semibold text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <span
                    className={`ml-auto rounded-full px-3 py-1 text-sm font-semibold ${statusBadgeClass(
                      selected.status
                    )}`}
                  >
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <h2 className="text-2xl font-bold">{selected.name}</h2>
                <p className="mb-2 opacity-80">{selected.email}</p>

                <p className="mb-4 font-semibold">
                  {selected.subject || "No subject"}
                </p>

                <div className="mb-6 rounded-2xl border border-white/20 bg-white/10 p-5">
                  <p className="whitespace-pre-wrap">{selected.message}</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={busyId === selected.id || loading || selected.status === "new"}
                    onClick={() => updateStatus(selected.id, "new")}
                    className={`cursor-pointer rounded-xl px-4 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
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
                      busyId === selected.id ||
                      loading ||
                      selected.status === "in_progress"
                    }
                    onClick={() => updateStatus(selected.id, "in_progress")}
                    className={`cursor-pointer rounded-xl px-4 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected.status === "in_progress"
                        ? "bg-yellow-700 ring-2 ring-yellow-300/40"
                        : "bg-yellow-500 hover:bg-yellow-600"
                    }`}
                  >
                    In Progress
                  </button>

                  <button
                    type="button"
                    disabled={busyId === selected.id || loading || selected.status === "done"}
                    onClick={() => updateStatus(selected.id, "done")}
                    className={`cursor-pointer rounded-xl px-4 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
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