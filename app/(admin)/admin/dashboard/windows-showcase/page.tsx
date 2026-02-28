"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type WindowStatus = "pending" | "approved" | "rejected";

type WindowEntry = {
  id: string;
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  status: WindowStatus;
  featured?: boolean;
  imageUrl?: string;
  submittedAt: string;
  paymentStatus?: string;
};

type ApiEntry = {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  image_url: string | null;
  payment_status: string | null;
  status: WindowStatus;
  featured: boolean;
  created_at: string;
};

function formatDate(d: string) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WindowShowcaseAdminPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<WindowStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<WindowEntry[]>([]);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/windows/list", { cache: "no-store" });
    const data = await res.json();

    if (!data?.ok) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const mapped: WindowEntry[] = (data.entries as ApiEntry[]).map((e) => ({
      id: e.id,
      businessName: e.business_name,
      contactName: e.contact_name || undefined,
      email: e.email || undefined,
      phone: e.phone || undefined,
      address: e.address || undefined,
      website: e.website || undefined,
      status: e.status,
      featured: e.featured,
      imageUrl: e.image_url || undefined,
      submittedAt: formatDate(e.created_at),
      paymentStatus: e.payment_status || undefined,
    }));

    setEntries(mapped);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        e.businessName.toLowerCase().includes(q) ||
        (e.address || "").toLowerCase().includes(q) ||
        (e.email || "").toLowerCase().includes(q);

      const matchesStatus = status === "all" ? true : e.status === status;

      return matchesQuery && matchesStatus;
    });
  }, [entries, query, status]);

  async function updateEntry(
    id: string,
    patch: Partial<Pick<WindowEntry, "status" | "featured">>
  ) {
    await fetch(`/api/windows/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    await load();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">
            Window Showcase
          </h1>
          <p className="text-white/80">
            Review and manage Windows of Hope submissions.
          </p>
        </div>

        <div className="text-sm text-white/70">
          Total:{" "}
          <span className="font-semibold text-white">
            {loading ? "…" : filtered.length}
          </span>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="grid gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search business name, address, email..."
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/40 focus:border-white/25"
          />
        </div>

        <div className="lg:col-span-4">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/25"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 text-white/80">
          Loading submissions...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 text-white/80">
          No submissions match your filters.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <WindowCard
              key={e.id}
              entry={e}
              onApprove={() => updateEntry(e.id, { status: "approved" })}
              onReject={() => updateEntry(e.id, { status: "rejected" })}
              onToggleFeature={() =>
                updateEntry(e.id, { featured: !e.featured })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WindowCard({
  entry,
  onApprove,
  onReject,
  onToggleFeature,
}: {
  entry: WindowEntry;
  onApprove: () => void;
  onReject: () => void;
  onToggleFeature: () => void;
}) {
  const hideActions = entry.status === "approved";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-xl overflow-hidden">
      <div className="aspect-[16/10] bg-black/30">
        {entry.imageUrl ? (
          <img
            src={entry.imageUrl}
            alt={entry.businessName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-white/60 text-sm">
            No image uploaded
          </div>
        )}
      </div>

      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-extrabold">{entry.businessName}</div>
            <div className="text-xs text-white/70 mt-1">
              {entry.address || "—"}
            </div>
          </div>

          <StatusPill status={entry.status} featured={!!entry.featured} />
        </div>

        <div className="text-xs text-white/60">
          Submitted:{" "}
          <span className="text-white/80">{entry.submittedAt}</span>
          {entry.paymentStatus && (
            <>
              {" "}
              • Payment:{" "}
              <span className="text-white/80">
                {entry.paymentStatus}
              </span>
            </>
          )}
        </div>

        {!hideActions && (
          <div className="grid grid-cols-3 gap-2 pt-2">
            <button
              onClick={onApprove}
              className="rounded-xl bg-black/20 border border-white/10 py-2 text-xs font-semibold hover:bg-black/30 transition"
            >
              Approve
            </button>

            <button
              onClick={onReject}
              className="rounded-xl bg-black/20 border border-white/10 py-2 text-xs font-semibold hover:bg-black/30 transition"
            >
              Reject
            </button>

            <button
              onClick={onToggleFeature}
              className="rounded-xl bg-black/20 border border-white/10 py-2 text-xs font-semibold hover:bg-black/30 transition"
            >
              {entry.featured ? "Unfeature" : "Feature"}
            </button>
          </div>
        )}

        <Link
          href="/Competition"
          className="block text-xs text-white/70 hover:text-white transition pt-1"
        >
          View Competition Page →
        </Link>
      </div>
    </div>
  );
}

function StatusPill({
  status,
  featured,
}: {
  status: WindowStatus;
  featured: boolean;
}) {
  const label =
    status === "pending"
      ? "Pending"
      : status === "approved"
      ? "Approved"
      : "Rejected";

  return (
    <div className="flex flex-col items-end gap-2">
      <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1 text-[11px] font-semibold text-white/85">
        {label}
      </span>
      {featured && (
        <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1 text-[11px] font-semibold text-white/85">
          Featured
        </span>
      )}
    </div>
  );
}