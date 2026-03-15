"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type WindowStatus = "pending" | "approved" | "rejected";

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
  votes?: number | null;
};

type WindowEntry = {
  id: string;
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  status: WindowStatus;
  featured: boolean;
  imageUrl?: string;
  submittedAtISO: string;
  submittedAtNice: string;
  paymentStatus?: string;
  votes?: number;
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

/** Small helper so buttons are consistent everywhere */
function ActionButton({
  onClick,
  children,
  tone = "neutral",
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: "primary" | "neutral";
}) {
  const cls =
    tone === "primary"
      ? "bg-white text-black hover:bg-white/90"
      : "bg-black/20 text-white hover:bg-black/30";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold transition ${cls}`}
    >
      {children}
    </button>
  );
}

export default function WindowsShowcaseEntriesAdminPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<WindowStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<WindowEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Drawer
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = useMemo(
    () => entries.find((e) => e.id === activeId) || null,
    [entries, activeId]
  );

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/windows/list", { cache: "no-store" });
      const data = await res.json();

      if (!data?.ok) {
        setEntries([]);
        setError(data?.error || "Failed to load submissions");
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
        featured: !!e.featured,
        imageUrl: e.image_url || undefined,
        submittedAtISO: e.created_at,
        submittedAtNice: formatDate(e.created_at),
        paymentStatus: e.payment_status || undefined,
        votes: typeof e.votes === "number" ? e.votes : undefined,
      }));

      setEntries(mapped);

      if (activeId && !mapped.some((m) => m.id === activeId)) {
        setOpen(false);
        setActiveId(null);
      }
    } catch (e: any) {
      setEntries([]);
      setError(e?.message || "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => {
        const matchesQuery =
          !q ||
          e.businessName.toLowerCase().includes(q) ||
          (e.address || "").toLowerCase().includes(q) ||
          (e.email || "").toLowerCase().includes(q);

        const matchesStatus = status === "all" ? true : e.status === status;

        return matchesQuery && matchesStatus;
      })
      .sort(
        (a, b) =>
          new Date(b.submittedAtISO).getTime() -
          new Date(a.submittedAtISO).getTime()
      );
  }, [entries, query, status]);

  const stats = useMemo(() => {
    const total = entries.length;
    const pending = entries.filter((e) => e.status === "pending").length;
    const approved = entries.filter((e) => e.status === "approved").length;
    const rejected = entries.filter((e) => e.status === "rejected").length;
    const featured = entries.filter((e) => e.featured).length;
    return { total, pending, approved, rejected, featured };
  }, [entries]);

  async function updateEntry(
    id: string,
    patch: Partial<Pick<WindowEntry, "status" | "featured">>
  ) {
    // optimistic UI
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status: (patch.status ?? e.status) as WindowStatus,
              featured: patch.featured ?? e.featured,
            }
          : e
      )
    );

    const res = await fetch(`/api/windows/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (!res.ok) await load();
  }

  const openEntry = (id: string) => {
    setActiveId(id);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setActiveId(null);
  };

  return (
    <div className="p-6 text-white">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">
            Windows of Hope • Entries
          </h1>
          <p className="text-white/70 mt-1">
            Review submissions, check pictures, and approve or reject.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold bg-white/10 hover:bg-white/15 transition border border-white/10"
          >
            ⟳ Refresh
          </button>

          <Link
            href="/admin/dashboard/windows-showcase"
            className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold bg-white/5 hover:bg-white/10 transition border border-white/10 text-white/85"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Total" value={loading ? "…" : stats.total} />
        <Stat label="Pending" value={loading ? "…" : stats.pending} />
        <Stat label="Approved" value={loading ? "…" : stats.approved} />
        <Stat label="Rejected" value={loading ? "…" : stats.rejected} />
        <Stat label="Featured" value={loading ? "…" : stats.featured} />
      </div>

      {/* Search + Filter */}
      <div className="mt-6 grid gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search business name, address, email…"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/40 focus:border-white/25"
          />
        </div>

        <div className="lg:col-span-4">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/25 cursor-pointer"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/10 p-6 text-white/80">
          Loading submissions…
        </div>
      ) : error ? (
        <div className="mt-6 rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/10 p-6 text-white/80">
          No submissions match your filters.
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <WindowCard
              key={e.id}
              entry={e}
              onOpen={() => openEntry(e.id)}
              onSetStatus={(s) => updateEntry(e.id, { status: s })}
              onToggleFeature={() => updateEntry(e.id, { featured: !e.featured })}
            />
          ))}
        </div>
      )}

      {/* Drawer */}
      <Drawer open={open} onClose={close}>
        {!active ? (
          <div className="text-white/70">Select an entry…</div>
        ) : (
          <EntryDetail
            entry={active}
            onSetStatus={(s) => updateEntry(active.id, { status: s })}
            onToggleFeature={() =>
              updateEntry(active.id, { featured: !active.featured })
            }
          />
        )}
      </Drawer>
    </div>
  );
}

function WindowCard({
  entry,
  onOpen,
  onSetStatus,
  onToggleFeature,
}: {
  entry: WindowEntry;
  onOpen: () => void;
  onSetStatus: (s: WindowStatus) => void;
  onToggleFeature: () => void;
}) {
  const approveLabel = entry.status === "approved" ? "↩ Undo" : "✓ Approve";
  const approveClick =
    entry.status === "approved"
      ? () => onSetStatus("pending")
      : () => onSetStatus("approved");

  const showReject = entry.status !== "approved";
  const rejectLabel = entry.status === "rejected" ? "↩ Undo" : "✕ Reject";
  const rejectClick =
    entry.status === "rejected"
      ? () => onSetStatus("pending")
      : () => onSetStatus("rejected");

  const featureLabel = entry.featured ? "☆ Unfeature" : "★ Feature";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-xl overflow-hidden">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left cursor-pointer"
      >
        <div className="aspect-[16/10] bg-black/30">
          {entry.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
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
      </button>

      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-extrabold truncate">{entry.businessName}</div>
            <div className="text-xs text-white/70 mt-1 truncate">
              {entry.address || "—"}
            </div>
          </div>

          <StatusPill status={entry.status} featured={!!entry.featured} />
        </div>

        <div className="text-xs text-white/60">
          Submitted: <span className="text-white/80">{entry.submittedAtNice}</span>
          {entry.paymentStatus ? (
            <>
              {" "}
              • Payment: <span className="text-white/80">{entry.paymentStatus}</span>
            </>
          ) : null}
          {typeof entry.votes === "number" ? (
            <>
              {" "}
              • Votes: <span className="text-white/80">{entry.votes}</span>
            </>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={onOpen}
            className="cursor-pointer rounded-xl bg-white/10 border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15 transition"
          >
            View →
          </button>

          <div className="flex gap-2">
            {/* ✅ Hide Approve when REJECTED */}
            {entry.status !== "rejected" && (
              <button
                type="button"
                onClick={approveClick}
                className="cursor-pointer rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-black/30 transition"
              >
                {approveLabel}
              </button>
            )}

            {showReject && (
              <button
                type="button"
                onClick={rejectClick}
                className="cursor-pointer rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-black/30 transition"
              >
                {rejectLabel}
              </button>
            )}

            <button
              type="button"
              onClick={onToggleFeature}
              className="cursor-pointer rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-black/30 transition"
            >
              {featureLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntryDetail({
  entry,
  onSetStatus,
  onToggleFeature,
}: {
  entry: WindowEntry;
  onSetStatus: (s: WindowStatus) => void;
  onToggleFeature: () => void;
}) {
  const approveLabel =
    entry.status === "approved" ? "↩ Undo approval" : "✓ Approve";
  const approveClick =
    entry.status === "approved"
      ? () => onSetStatus("pending")
      : () => onSetStatus("approved");

  const showReject = entry.status !== "approved";
  const rejectLabel = entry.status === "rejected" ? "↩ Undo reject" : "✕ Reject";
  const rejectClick =
    entry.status === "rejected"
      ? () => onSetStatus("pending")
      : () => onSetStatus("rejected");

  const featureLabel = entry.featured ? "☆ Unfeature" : "★ Feature";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-extrabold">{entry.businessName}</div>
          <div className="text-sm text-white/70 mt-1">{entry.address || "—"}</div>
        </div>
        <StatusPill status={entry.status} featured={!!entry.featured} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
        <div className="aspect-[16/10] bg-black/30">
          {entry.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Info label="Contact" value={entry.contactName || "—"} />
        <Info label="Email" value={entry.email || "—"} />
        <Info label="Phone" value={entry.phone || "—"} />
        <Info label="Website" value={entry.website || "—"} />
        <Info label="Submitted" value={entry.submittedAtNice} />
        <Info label="Payment" value={entry.paymentStatus || "—"} />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <ActionButton onClick={onToggleFeature}>{featureLabel}</ActionButton>

        {showReject && (
          <ActionButton onClick={rejectClick}>{rejectLabel}</ActionButton>
        )}

        {/* ✅ Hide Approve when REJECTED */}
        {entry.status !== "rejected" && (
          <ActionButton onClick={approveClick} tone="primary">
            {approveLabel}
          </ActionButton>
        )}
      </div>

      <div className="pt-2">
        <Link
          href="/Competition"
          className="cursor-pointer text-sm text-white/70 hover:text-white transition"
        >
          View public competition page →
        </Link>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wider text-white/60">{label}</div>
      <div className="mt-1 text-sm text-white/85 break-words">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wider text-white/60">{label}</div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
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
      {featured ? (
        <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1 text-[11px] font-semibold text-white/85">
          Featured
        </span>
      ) : null}
    </div>
  );
}

function Drawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={[
        "fixed inset-0 z-50",
        open ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
    >
      <div
        onClick={onClose}
        className={[
          "absolute inset-0 bg-black/60 transition-opacity cursor-pointer",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />
      <div
        className={[
          "absolute right-0 top-0 h-full w-[560px] max-w-[92vw] bg-black/40 backdrop-blur-xl border-l border-white/10 shadow-2xl transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}