"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SponsorStatus = "new" | "in_progress" | "done";

type SponsorApplication = {
  id: string;
  sponsor_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  sponsorship_type: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  country: string | null;
  logo_link: string | null;
  message: string | null;
  status: SponsorStatus;
  is_read: boolean;
  created_at: string;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  sponsors?: SponsorApplication[];
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

function statusLabel(status: SponsorStatus) {
  if (status === "in_progress") return "In Progress";
  if (status === "done") return "Done";
  return "New";
}

function statusBadgeClass(status: SponsorStatus) {
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

function getAddressFields(item: SponsorApplication) {
  return [
    {
      label: "Address line 1",
      value: item.address_line1?.trim() || "",
    },
    {
      label: "Address line 2",
      value: item.address_line2?.trim() || "",
    },
    {
      label: "City / Town",
      value: item.city?.trim() || "",
    },
    {
      label: "County",
      value: item.county?.trim() || "",
    },
    {
      label: "Postcode",
      value: item.postcode?.trim() || "",
    },
    {
      label: "Country",
      value: item.country?.trim() || "",
    },
  ].filter((field) => field.value);
}

function getGoogleMapsUrl(item: SponsorApplication) {
  const address = [
    item.address_line1?.trim(),
    item.address_line2?.trim(),
    item.city?.trim(),
    item.county?.trim(),
    item.postcode?.trim(),
    item.country?.trim(),
  ]
    .filter(Boolean)
    .join(", ");

  if (!address) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default function SponsorAdminPage() {
  const [items, setItems] = useState<SponsorApplication[]>([]);
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
  const selectedAddressFields = selectedItem ? getAddressFields(selectedItem) : [];
  const googleMapsUrl = selectedItem ? getGoogleMapsUrl(selectedItem) : null;

  useEffect(() => {
    void fetchItems();
  }, []);

  async function fetchItems(showRefreshState = false) {
    try {
      if (showRefreshState) setRefreshing(true);
      else setLoading(true);

      setError(null);

      const res = await fetch("/api/admin/sponsors", {
        method: "GET",
        cache: "no-store",
      });

      const data: ApiResponse = await parseJsonResponse(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load sponsor applications");
      }

      const nextItems: SponsorApplication[] = Array.isArray(data?.sponsors)
        ? data.sponsors
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

  async function openItem(item: SponsorApplication) {
    setSelectedId(item.id);
  }

  async function updateStatus(id: string, status: SponsorStatus) {
    const previousItems = items;
    setBusyId(id);
    setError(null);

    const shouldMarkRead = status === "done";

    setItems((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status,
              is_read: shouldMarkRead ? true : entry.is_read,
            }
          : entry
      )
    );

    try {
      const res = await fetch(`/api/admin/sponsors/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(shouldMarkRead ? { status, is_read: true } : { status }),
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to update sponsor status");
      }
    } catch (err) {
      setItems(previousItems);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  async function markRead(id: string) {
    const previousItems = items;
    setBusyId(id);
    setError(null);

    setItems((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, is_read: true } : entry))
    );

    try {
      const res = await fetch(`/api/admin/sponsors/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_read: true }),
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to mark sponsor as read");
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
      const res = await fetch(`/api/admin/sponsors/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_read: false }),
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to mark sponsor as unread");
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
      "Delete this sponsor application? This cannot be undone."
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
      const res = await fetch(`/api/admin/sponsors/${id}`, {
        method: "DELETE",
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to delete sponsor application");
      }
    } catch (err) {
      setItems(previousItems);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteAll() {
    const ids = items.map((item) => item.id);
    if (!ids.length) return;

    setError(null);
    setBusyId("delete-all");

    const previousItems = items;

    try {
      for (const id of ids) {
        const res = await fetch(`/api/admin/sponsors/${id}`, {
          method: "DELETE",
        });

        const data = await parseJsonResponse(res);

        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Failed to delete all sponsor applications");
        }
      }

      setItems([]);
      setSelectedId(null);
      setConfirmDeleteAll(false);
    } catch (err) {
      setItems(previousItems);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  function renderList(
    title: string,
    list: SponsorApplication[],
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
              ? "No unread sponsor forms."
              : "No read sponsor forms yet."}
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
                          {item.sponsor_name}
                        </p>
                        {!item.is_read ? (
                          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-pink-400" />
                        ) : null}
                      </div>

                      <p className="truncate text-sm text-white/80 sm:text-base">
                        {item.contact_name} • {item.email}
                      </p>

                      <p className="mt-2 line-clamp-2 text-white/95">
                        {item.message || item.sponsorship_type || "Sponsor application"}
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
              Sponsor Applications
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/80 sm:text-base">
              Manage sponsor form submissions from your website.
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
              href="/Admin/Dashboard/Forms/Sponsors/Sponsors-list-version"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-white/15 px-5 py-3 font-semibold text-white backdrop-blur hover:bg-white/20 sm:w-auto"
            >
              List Version
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
                  disabled={busyId === "delete-all"}
                  className="w-full rounded-2xl bg-red-700 px-5 py-3 font-semibold text-white hover:bg-red-800 disabled:opacity-60 sm:w-auto"
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

            <Link
              href="/admin/dashboard"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white backdrop-blur hover:bg-white/20 sm:w-auto"
            >
              ← Dashboard
            </Link>
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
            {renderList("Read Sponsors", readItems, "read")}
          </div>

          <div className="min-w-0 rounded-3xl border border-white/20 bg-white/10 p-4 backdrop-blur-md sm:p-6">
            {loading ? (
              <p className="text-white/85">Loading sponsor applications...</p>
            ) : !selectedItem ? (
              <p className="text-white/85">Select a sponsor application to view it.</p>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  {!selectedItem.is_read ? (
                    <button
                      type="button"
                      disabled={busyId === selectedItem.id}
                      onClick={() => void markRead(selectedItem.id)}
                      className="rounded-2xl bg-white/15 px-4 py-2.5 font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Mark Read
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === selectedItem.id}
                      onClick={() => void markUnread(selectedItem.id)}
                      className="rounded-2xl bg-white/15 px-4 py-2.5 font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Mark Unread
                    </button>
                  )}

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

                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                    {selectedItem.logo_link ? (
                      <div className="relative mx-auto h-40 w-full overflow-hidden rounded-xl bg-white">
                        <Image
                          src={selectedItem.logo_link}
                          alt={`${selectedItem.sponsor_name} logo`}
                          fill
                          className="object-contain p-3"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="flex h-40 items-center justify-center rounded-xl bg-white/5 text-center text-sm text-white/70">
                        No logo uploaded
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <h2 className="break-words text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
                      {selectedItem.sponsor_name}
                    </h2>
                    <p className="mt-1 break-words text-base text-white/80 sm:text-lg">
                      {selectedItem.contact_name}
                    </p>
                    <p className="mt-1 break-all text-base text-white/80 sm:text-lg">
                      {selectedItem.email}
                    </p>
                    <p className="mt-2 text-sm text-white/70">
                      Submitted on {formatDate(selectedItem.created_at)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                    <p className="text-sm font-semibold text-white/70">Phone</p>
                    <p className="mt-2 break-words text-base text-white sm:text-lg">
                      {selectedItem.phone || "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                    <p className="text-sm font-semibold text-white/70">Sponsorship type</p>
                    <p className="mt-2 break-words text-base text-white sm:text-lg">
                      {selectedItem.sponsorship_type || "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4 sm:col-span-2">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
                        <span>📍</span>
                        <span>Business address</span>
                      </p>

                      {googleMapsUrl ? (
                        <a
                          href={googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          Open in Google Maps
                        </a>
                      ) : null}
                    </div>

                    {selectedAddressFields.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {selectedAddressFields.map((field) => (
                          <div
                            key={field.label}
                            className="rounded-2xl border border-white/10 bg-white/5 p-4"
                          >
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                              {field.label}
                            </p>
                            <p className="mt-2 break-words text-base leading-relaxed text-white sm:text-lg">
                              {field.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-base text-white sm:text-lg">-</p>
                    )}
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-sm font-semibold text-white/70">Message / requirements</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-white/95">
                    {selectedItem.message || "-"}
                  </p>
                </div>

                {disableStatusButtons ? (
                  <p className="mt-6 text-sm text-white/70">
                    Status buttons are disabled for applications in Read Sponsors.
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