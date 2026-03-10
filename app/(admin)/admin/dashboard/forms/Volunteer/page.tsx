"use client";

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

export default function VolunteerAdminPage() {
  const [items, setItems] = useState<VolunteerApplication[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const unreadItems = useMemo(
    () => items.filter((item) => !item.is_read),
    [items]
  );

  const readItems = useMemo(
    () => items.filter((item) => item.is_read),
    [items]
  );

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

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

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load volunteer applications");
      }

      const nextItems: VolunteerApplication[] = data.items || [];
      setItems(nextItems);

      if (!selectedId && nextItems.length > 0) {
        setSelectedId(nextItems[0].id);
      }

      if (selectedId && !nextItems.some((item) => item.id === selectedId)) {
        setSelectedId(nextItems[0]?.id ?? null);
      }
    } catch (err) {
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
      prev.map((entry) =>
        entry.id === item.id ? { ...entry, is_read: true } : entry
      )
    );

    try {
      const res = await fetch(`/api/admin/volunteers/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_read: true }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to mark volunteer application as read");
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

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update volunteer status");
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
      prev.map((entry) =>
        entry.id === id ? { ...entry, is_read: false } : entry
      )
    );

    try {
      const res = await fetch(`/api/admin/volunteers/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_read: false }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to mark volunteer application as unread");
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

    setItems((prev) => prev.filter((entry) => entry.id !== id));

    if (selectedId === id) {
      const remaining = items.filter((entry) => entry.id !== id);
      setSelectedId(remaining[0]?.id ?? null);
    }

    try {
      const res = await fetch(`/api/admin/volunteers/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete volunteer application");
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

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete all volunteer applications");
      }

      setItems([]);
      setSelectedId(null);
      setConfirmDeleteAll(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function renderList(title: string, list: VolunteerApplication[], readState: "unread" | "read") {
    return (
      <div className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-md overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <p className="text-sm text-white/80">
            {list.length} {readState === "unread" ? "unread" : "read"}
          </p>
        </div>

        {list.length === 0 ? (
          <div className="px-5 py-5 text-white/80">
            {readState === "unread"
              ? "No unread volunteer forms."
              : "No read volunteer forms yet."}
          </div>
        ) : (
          <div>
            {list.map((item) => {
              const active = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className={`w-full border-b border-white/10 px-5 py-4 text-left transition last:border-b-0 ${
                    active ? "bg-white/15" : "hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xl font-semibold text-white">
                          {item.full_name}
                        </p>
                        {!item.is_read ? (
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-pink-400" />
                        ) : null}
                      </div>
                      <p className="truncate text-white/80">{item.email}</p>
                      <p className="mt-2 truncate text-white/95">
                        {item.why_volunteer || item.experience || "Volunteer form"}
                      </p>
                      <p className="mt-2 text-sm text-white/70">{formatDate(item.created_at)}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(
                          item.status
                        )}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteOne(item.id);
                        }}
                        className="rounded-xl bg-pink-500/30 px-3 py-2 text-sm font-semibold text-pink-50 hover:bg-pink-500/40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r  px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-4xl font-bold sm:text-5xl">Volunteer Applications</h1>
            <p className="mt-2 text-white/80">
              Manage volunteer form submissions from your website.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void fetchItems(true)}
              disabled={refreshing || loading}
              className="rounded-2xl bg-white/15 px-5 py-3 font-semibold text-white backdrop-blur hover:bg-white/20 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            {!confirmDeleteAll ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(true)}
                className="rounded-2xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
              >
                Delete All
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void handleDeleteAll()}
                  className="rounded-2xl bg-red-700 px-5 py-3 font-semibold text-white hover:bg-red-800"
                >
                  Confirm Delete All
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAll(false)}
                  className="rounded-2xl bg-white/15 px-5 py-3 font-semibold text-white hover:bg-white/20"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-pink-300/30 bg-pink-500/20 px-4 py-3 text-white">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            {renderList("Inbox", unreadItems, "unread")}
            {renderList("Read Volunteers", readItems, "read")}
          </div>

          <div className="rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur-md sm:p-6">
            {loading ? (
              <p className="text-white/85">Loading volunteer applications...</p>
            ) : !selectedItem ? (
              <p className="text-white/85">Select a volunteer application to view it.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={busyId === selectedItem.id}
                      onClick={() => void markUnread(selectedItem.id)}
                      className="rounded-2xl bg-white/15 px-4 py-2.5 font-semibold text-white hover:bg-white/20 disabled:opacity-60"
                    >
                      Mark Unread
                    </button>

                    <a
                      href={`mailto:${selectedItem.email}`}
                      className="rounded-2xl bg-white/15 px-4 py-2.5 font-semibold text-white hover:bg-white/20"
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
                  </div>

                  <span
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${statusBadgeClass(
                      selectedItem.status
                    )}`}
                  >
                    {statusLabel(selectedItem.status)}
                  </span>
                </div>

                <div className="mt-6">
                  <h2 className="text-4xl font-bold text-white">{selectedItem.full_name}</h2>
                  <p className="mt-1 text-xl text-white/80">{selectedItem.email}</p>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                    <p className="text-sm font-semibold text-white/70">Phone</p>
                    <p className="mt-2 text-lg text-white">{selectedItem.phone || "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                    <p className="text-sm font-semibold text-white/70">Date of birth</p>
                    <p className="mt-2 text-lg text-white">{selectedItem.date_of_birth || "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4 sm:col-span-2">
                    <p className="text-sm font-semibold text-white/70">Availability</p>
                    <p className="mt-2 text-lg text-white">{selectedItem.availability || "-"}</p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-sm font-semibold text-white/70">Relevant experience</p>
                  <p className="mt-2 whitespace-pre-wrap text-white/95">
                    {selectedItem.experience || "-"}
                  </p>
                </div>

                <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-sm font-semibold text-white/70">Why do you want to volunteer?</p>
                  <p className="mt-2 whitespace-pre-wrap text-white/95">
                    {selectedItem.why_volunteer || "-"}
                  </p>
                </div>

                <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-sm font-semibold text-white/70">Emergency contact</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-sm text-white/70">Name</p>
                      <p className="mt-1 text-white">{selectedItem.emergency_contact_name || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-white/70">Phone</p>
                      <p className="mt-1 text-white">{selectedItem.emergency_contact_phone || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-white/70">Relationship</p>
                      <p className="mt-1 text-white">{selectedItem.emergency_contact_relationship || "-"}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={busyId === selectedItem.id}
                    onClick={() => void updateStatus(selectedItem.id, "new")}
                    className="rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    New
                  </button>
                  <button
                    type="button"
                    disabled={busyId === selectedItem.id}
                    onClick={() => void updateStatus(selectedItem.id, "in_progress")}
                    className="rounded-2xl bg-yellow-500 px-4 py-3 font-semibold text-white hover:bg-yellow-600 disabled:opacity-60"
                  >
                    In Progress
                  </button>
                  <button
                    type="button"
                    disabled={busyId === selectedItem.id}
                    onClick={() => void updateStatus(selectedItem.id, "done")}
                    className="rounded-2xl bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-60"
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
