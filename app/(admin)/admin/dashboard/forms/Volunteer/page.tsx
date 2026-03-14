"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type VolunteerStatus = "new" | "in_progress" | "done";

type VolunteerApplication = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  availability: string | null;
  experience: string | null;
  why_volunteer: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  status: VolunteerStatus;
  is_read: boolean;
  created_at: string;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  volunteers?: VolunteerApplication[];
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

function formatDob(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: VolunteerStatus) {
  if (status === "in_progress") return "In Progress";
  if (status === "done") return "Done";
  return "New";
}

function statusBadgeClass(status: VolunteerStatus) {
  if (status === "done") {
    return "bg-green-500/25 text-green-100 border border-green-300/30";
  }
  if (status === "in_progress") {
    return "bg-yellow-500/25 text-yellow-100 border border-yellow-300/30";
  }
  return "bg-blue-500/25 text-blue-100 border border-blue-300/30";
}

async function parseJsonResponse(res: Response) {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    if (text.trim().startsWith("<")) {
      throw new Error(
        "The server returned HTML instead of JSON. This usually means the API route is missing, blocked by middleware, or redirected."
      );
    }
    throw new Error("The server returned invalid JSON.");
  }
}

export default function VolunteerAdminPage() {
  const [items, setItems] = useState<VolunteerApplication[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const unreadItems = useMemo(() => items.filter((item) => !item.is_read), [items]);
  const readItems = useMemo(() => items.filter((item) => item.is_read), [items]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const disableStatusButtons = !!selectedItem?.is_read;

  useEffect(() => {
    void fetchItems();
  }, []);

  async function fetchItems(showRefreshState = false) {
    try {
      if (showRefreshState) setRefreshing(true);
      else setLoading(true);

      setError(null);

      const res = await fetch("/api/admin/volunteers", {
        method: "GET",
        cache: "no-store",
      });

      const data: ApiResponse = await parseJsonResponse(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load volunteer applications");
      }

      const nextItems: VolunteerApplication[] = Array.isArray(data?.volunteers)
        ? data.volunteers
        : [];

      setItems(nextItems);

      setSelectedId((currentSelectedId) => {
        if (!nextItems.length) return null;
        if (!currentSelectedId) return nextItems[0].id;
        return nextItems.some((item) => item.id === currentSelectedId)
          ? currentSelectedId
          : nextItems[0].id;
      });
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function openItem(item: VolunteerApplication) {
    setSelectedId(item.id);

    if (item.is_read) return;

    const previousItems = items;

    setItems((prev) =>
      prev.map((entry) => (entry.id === item.id ? { ...entry, is_read: true } : entry))
    );

    try {
      const res = await fetch(`/api/admin/volunteers/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_read: true }),
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to mark volunteer application as read");
      }
    } catch (err) {
      setItems(previousItems);
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function updateStatus(id: string, status: VolunteerStatus) {
    const previousItems = items;
    setBusyId(id);
    setError(null);

    setItems((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, status, is_read: true } : entry
      )
    );

    try {
      const res = await fetch(`/api/admin/volunteers/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, is_read: true }),
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to update volunteer status");
      }
    } catch (err) {
      setItems(previousItems);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  async function markUnread(id: string) {
    const previousItems = items;
    setBusyId(id);
    setError(null);

    setItems((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, is_read: false } : entry))
    );

    try {
      const res = await fetch(`/api/admin/volunteers/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_read: false }),
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to mark volunteer application as unread");
      }
    } catch (err) {
      setItems(previousItems);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteOne(id: string) {
    const confirmed = window.confirm(
      "Delete this volunteer application? This cannot be undone."
    );

    if (!confirmed) return;

    const previousItems = items;
    setBusyId(id);
    setError(null);

    const remaining = items.filter((entry) => entry.id !== id);
    setItems(remaining);

    if (selectedId === id) {
      setSelectedId(remaining[0]?.id ?? null);
    }

    try {
      const res = await fetch(`/api/admin/volunteers/${id}`, {
        method: "DELETE",
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to delete volunteer application");
      }
    } catch (err) {
      setItems(previousItems);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteAll() {
    setError(null);

    try {
      const res = await fetch("/api/admin/volunteers/delete-all", {
        method: "DELETE",
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to delete all volunteer applications");
      }

      setItems([]);
      setSelectedId(null);
      setConfirmDeleteAll(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function renderList(
    title: string,
    list: VolunteerApplication[],
    readState: "unread" | "read"
  ) {
    return (
      <div className="overflow-hidden rounded-3xl border border-white/20 bg-white/10 backdrop-blur-md">
        <div className="border-b border-white/10 px-4 py-4 sm:px-5">
          <h2 className="text-xl font-bold text-white sm:text-2xl">{title}</h2>
          <p className="text-sm text-white/80">
            {list.length} {readState === "unread" ? "unread" : "read"}
          </p>
        </div>

        {list.length === 0 ? (
          <div className="px-4 py-5 text-white/80 sm:px-5">
            {readState === "unread"
              ? "No unread volunteer forms."
              : "No read volunteer forms yet."}
          </div>
        ) : (
          <div>
            {list.map((item) => {
              const active = item.id === selectedId;

              return (
                <div
                  key={item.id}
                  className={`w-full border-b border-white/10 px-4 py-4 transition last:border-b-0 sm:px-5 ${
                    active ? "bg-white/15" : "hover:bg-white/10"
                  }`}
                >
                  <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <button
                      type="button"
                      onClick={() => void openItem(item)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <p className="truncate text-lg font-semibold text-white sm:text-xl">
                          {item.full_name}
                        </p>
                        {!item.is_read ? (
                          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-pink-400" />
                        ) : null}
                      </div>

                      <p className="truncate text-sm text-white/80 sm:text-base">
                        {item.email}
                      </p>

                      <p className="mt-2 line-clamp-2 text-white/95">
                        {item.why_volunteer || item.experience || "Volunteer form"}
                      </p>

                      <p className="mt-2 text-sm text-white/70">
                        {formatDate(item.created_at)}
                      </p>
                    </button>

                    <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(
                          item.status
                        )}`}
                      >
                        {statusLabel(item.status)}
                      </span>

                      <button
                        type="button"
                        onClick={() => void deleteOne(item.id)}
                        className="w-full rounded-xl bg-pink-500/30 px-3 py-2 text-sm font-semibold text-pink-50 hover:bg-pink-500/40 sm:w-auto"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden px-3 py-6 text-white sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold sm:text-4xl lg:text-5xl">
              Volunteer Applications
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/80 sm:text-base">
              Manage volunteer form submissions from your website.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={() => void fetchItems(true)}
              disabled={refreshing || loading}
              className="w-full rounded-2xl bg-white/15 px-5 py-3 font-semibold text-white backdrop-blur hover:bg-white/20 disabled:opacity-60 sm:w-auto"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <Link
              href="/admin/dashboard/forms/Volunteer/Volunteer-list-version"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white backdrop-blur hover:bg-white/20 sm:w-auto"
            >
              ← Form List
            </Link>

            {!confirmDeleteAll ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(true)}
                className="w-full rounded-2xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 sm:w-auto"
              >
                Delete All
              </button>
            ) : (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => void handleDeleteAll()}
                  className="w-full rounded-2xl bg-red-700 px-5 py-3 font-semibold text-white hover:bg-red-800 sm:w-auto"
                >
                  Confirm Delete All
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAll(false)}
                  className="w-full rounded-2xl bg-white/15 px-5 py-3 font-semibold text-white hover:bg-white/20 sm:w-auto"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-pink-300/30 bg-pink-500/20 px-4 py-3 text-white">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="min-w-0 space-y-6">
            {renderList("Inbox", unreadItems, "unread")}
            {renderList("Read Volunteers", readItems, "read")}
          </div>

          <div className="min-w-0 rounded-3xl border border-white/20 bg-white/10 p-4 backdrop-blur-md sm:p-6">
            {loading ? (
              <p className="text-white/85">Loading volunteer applications...</p>
            ) : !selectedItem ? (
              <p className="text-white/85">Select a volunteer application to view it.</p>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    disabled={busyId === selectedItem.id || !selectedItem.is_read}
                    onClick={() => void markUnread(selectedItem.id)}
                    className="rounded-2xl bg-white/15 px-4 py-2.5 font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Mark Unread
                  </button>

                  <a
                    href={`mailto:${selectedItem.email}`}
                    className="rounded-2xl bg-white/15 px-4 py-2.5 text-center font-semibold text-white hover:bg-white/20"
                  >
                    Reply
                  </a>

                  <button
                    type="button"
                    disabled={busyId === selectedItem.id}
                    onClick={() => void deleteOne(selectedItem.id)}
                    className="rounded-2xl bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    Delete
                  </button>

                  <span
                    className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold sm:ml-auto ${statusBadgeClass(
                      selectedItem.status
                    )}`}
                  >
                    {statusLabel(selectedItem.status)}
                  </span>
                </div>

                {!selectedItem.is_read ? (
                  <p className="mt-3 text-sm text-white/70">
                    Mark Unread is disabled for inbox volunteer applications.
                  </p>
                ) : null}

                <div className="mt-6 min-w-0">
                  <h2 className="break-words text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
                    {selectedItem.full_name}
                  </h2>
                  <p className="mt-1 break-all text-base text-white/80 sm:text-lg lg:text-xl">
                    {selectedItem.email}
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                    <p className="text-sm font-semibold text-white/70">Phone</p>
                    <p className="mt-2 break-words text-base text-white sm:text-lg">
                      {selectedItem.phone || "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                    <p className="text-sm font-semibold text-white/70">Date of birth</p>
                    <p className="mt-2 text-base text-white sm:text-lg">
                      {formatDob(selectedItem.date_of_birth)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4 sm:col-span-2">
                    <p className="text-sm font-semibold text-white/70">Availability</p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-base text-white sm:text-lg">
                      {selectedItem.availability || "-"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-sm font-semibold text-white/70">Relevant experience</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-white/95">
                    {selectedItem.experience || "-"}
                  </p>
                </div>

                <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-sm font-semibold text-white/70">
                    Why do you want to volunteer?
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-white/95">
                    {selectedItem.why_volunteer || "-"}
                  </p>
                </div>

                <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-sm font-semibold text-white/70">Emergency contact</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-sm text-white/70">Name</p>
                      <p className="mt-1 break-words text-white">
                        {selectedItem.emergency_contact_name || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-white/70">Phone</p>
                      <p className="mt-1 break-words text-white">
                        {selectedItem.emergency_contact_phone || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-white/70">Relationship</p>
                      <p className="mt-1 break-words text-white">
                        {selectedItem.emergency_contact_relationship || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {disableStatusButtons ? (
                  <p className="mt-6 text-sm text-white/70">
                    Status buttons are disabled for applications in Read Volunteers.
                  </p>
                ) : null}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    disabled={
                      disableStatusButtons ||
                      busyId === selectedItem.id ||
                      selectedItem.status === "new"
                    }
                    onClick={() => void updateStatus(selectedItem.id, "new")}
                    className="rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    New
                  </button>

                  <button
                    type="button"
                    disabled={
                      disableStatusButtons ||
                      busyId === selectedItem.id ||
                      selectedItem.status === "in_progress"
                    }
                    onClick={() => void updateStatus(selectedItem.id, "in_progress")}
                    className="rounded-2xl bg-yellow-500 px-4 py-3 font-semibold text-white hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    In Progress
                  </button>

                  <button
                    type="button"
                    disabled={
                      disableStatusButtons ||
                      busyId === selectedItem.id ||
                      selectedItem.status === "done"
                    }
                    onClick={() => void updateStatus(selectedItem.id, "done")}
                    className="rounded-2xl bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}