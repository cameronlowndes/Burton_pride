"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type VolunteerStatus = "new" | "in_progress" | "done";

type VolunteerRow = {
  id: string;
  created_at: string;
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
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  stats?: {
    totalApplications: number;
    newApplications: number;
    inProgressApplications: number;
    doneApplications: number;
  };
  volunteers?: VolunteerRow[];
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
  if (!value) return "—";
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
    return "border-green-400/20 bg-green-500/15 text-green-100";
  }
  if (status === "in_progress") {
    return "border-amber-400/20 bg-amber-500/15 text-amber-100";
  }
  return "border-sky-400/20 bg-sky-500/15 text-sky-100";
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wider text-white/60">{label}</div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-semibold text-white/80">
      {children}
    </span>
  );
}

export default function VolunteerAdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<ApiResponse["stats"] | null>(null);
  const [volunteers, setVolunteers] = useState<VolunteerRow[]>([]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | VolunteerStatus>("all");

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/volunteers", { cache: "no-store" });
      const text = await res.text();

      let json: ApiResponse | null = null;

      try {
        json = JSON.parse(text);
      } catch {
        setError(`API did not return JSON. Response started with: ${text.slice(0, 120)}`);
        setStats(null);
        setVolunteers([]);
        return;
      }

      if (!res.ok || !json?.ok) {
        setError(json?.error || `Request failed with ${res.status}`);
        setStats(null);
        setVolunteers([]);
        return;
      }

      setStats(json.stats || null);
      setVolunteers(json.volunteers || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load volunteer applications");
      setStats(null);
      setVolunteers([]);
    } finally {
      setLoading(false);
    }
  }

  function escapeCsv(value: string | null | undefined) {
    const text = String(value ?? "");
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function exportToCsv() {
    const headers = [
      "Applied At",
      "Full Name",
      "Email",
      "Phone",
      "Date Of Birth",
      "Availability",
      "Experience",
      "Why Volunteer",
      "Emergency Contact Name",
      "Emergency Contact Phone",
      "Emergency Contact Relationship",
      "Status",
      "Is Read",
    ];

    const rows = filteredVolunteers.map((v) => [
      v.created_at,
      v.full_name,
      v.email,
      v.phone,
      v.date_of_birth,
      v.availability,
      v.experience,
      v.why_volunteer,
      v.emergency_contact_name,
      v.emergency_contact_phone,
      v.emergency_contact_relationship,
      v.status,
      v.is_read ? "Yes" : "No",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => escapeCsv(cell)).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `volunteer-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    load();
  }, []);

  const filteredVolunteers = useMemo(() => {
    const q = query.trim().toLowerCase();

    return volunteers.filter((v) => {
      const matchesStatus = statusFilter === "all" ? true : v.status === statusFilter;

      if (!matchesStatus) return false;
      if (!q) return true;

      const fullName = (v.full_name || "").toLowerCase();
      const email = (v.email || "").toLowerCase();
      const phone = (v.phone || "").toLowerCase();
      const availability = (v.availability || "").toLowerCase();
      const experience = (v.experience || "").toLowerCase();
      const whyVolunteer = (v.why_volunteer || "").toLowerCase();
      const emergencyName = (v.emergency_contact_name || "").toLowerCase();
      const emergencyPhone = (v.emergency_contact_phone || "").toLowerCase();
      const emergencyRelationship = (v.emergency_contact_relationship || "").toLowerCase();

      return (
        fullName.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        availability.includes(q) ||
        experience.includes(q) ||
        whyVolunteer.includes(q) ||
        emergencyName.includes(q) ||
        emergencyPhone.includes(q) ||
        emergencyRelationship.includes(q)
      );
    });
  }, [volunteers, query, statusFilter]);

  return (
    <div className="p-6 text-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Volunteer Applications</h1>
          <p className="mt-1 text-white/70">
            View volunteer applications, contact details, availability, and status.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Pill>API: /api/admin/volunteers</Pill>
            <Pill>Max rows: 5000</Pill>
            {loading ? <Pill>Loading…</Pill> : <Pill>Loaded</Pill>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="cursor-pointer rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/15"
          >
            ⟳ Refresh
          </button>

          <button
            type="button"
            onClick={exportToCsv}
            disabled={loading || filteredVolunteers.length === 0}
            className="cursor-pointer rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ⭳ Export CSV
          </button>

          <Link
              href="/admin/dashboard/forms/Volunteer"
              className="inline-flex items-center rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white backdrop-blur hover:bg-white/20"
            >
              ← message version
            </Link>

          <Link
            href="/admin/dashboard"
            className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Stat label="Total applications" value={loading ? "…" : stats?.totalApplications ?? 0} />
        <Stat label="New" value={loading ? "…" : stats?.newApplications ?? 0} />
        <Stat label="In progress" value={loading ? "…" : stats?.inProgressApplications ?? 0} />
        <Stat label="Done" value={loading ? "…" : stats?.doneApplications ?? 0} />
      </div>

      {error ? (
        <div className="mt-6 rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-xl">
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-extrabold">Search applications</div>
            <div className="text-sm text-white/60">
              Search by name, email, phone, availability, or emergency contact
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search volunteer applications..."
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/40 focus:border-white/25 sm:w-80"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | VolunteerStatus)}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/25"
            >
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-xl backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <div className="text-lg font-extrabold">All volunteer applications</div>
            <div className="text-sm text-white/60">
              Showing {loading ? "…" : filteredVolunteers.length} applications
            </div>
          </div>

          <div className="text-xs text-white/50">Tip: search by volunteer name or email</div>
        </div>

        {loading ? (
          <div className="p-6 text-white/80">Loading volunteer applications...</div>
        ) : filteredVolunteers.length === 0 ? (
          <div className="p-6 text-white/80">No volunteer applications found.</div>
        ) : (
          <div className="space-y-4 p-4 sm:p-5">
            {filteredVolunteers.map((v) => (
              <div
                key={v.id}
                className="rounded-3xl border border-white/10 bg-black/20 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-words text-lg font-extrabold">{v.full_name}</h2>
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${statusBadgeClass(
                          v.status
                        )}`}
                      >
                        {statusLabel(v.status)}
                      </span>
                      {!v.is_read ? (
                        <span className="inline-flex items-center rounded-full border border-pink-400/20 bg-pink-500/15 px-3 py-1 text-[11px] font-semibold text-pink-100">
                          Unread
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 text-sm text-white/60">
                      Applied on {formatDate(v.created_at)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-wider text-white/50">Email</div>
                    <div className="mt-1 break-words font-semibold">{v.email || "—"}</div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-wider text-white/50">Phone</div>
                    <div className="mt-1 font-semibold">{v.phone || "—"}</div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-wider text-white/50">Date of birth</div>
                    <div className="mt-1 font-semibold">{formatDob(v.date_of_birth)}</div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2 xl:col-span-3">
                    <div className="text-xs uppercase tracking-wider text-white/50">Availability</div>
                    <div className="mt-1 whitespace-pre-wrap text-white/90">
                      {v.availability || "—"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2 xl:col-span-3">
                    <div className="text-xs uppercase tracking-wider text-white/50">Experience</div>
                    <div className="mt-1 whitespace-pre-wrap text-white/90">
                      {v.experience || "—"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2 xl:col-span-3">
                    <div className="text-xs uppercase tracking-wider text-white/50">
                      Why volunteer
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-white/90">
                      {v.why_volunteer || "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-3 text-sm font-bold text-white/85">Emergency contact</div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-wider text-white/50">Name</div>
                      <div className="mt-1 font-semibold">
                        {v.emergency_contact_name || "—"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-wider text-white/50">Phone</div>
                      <div className="mt-1 font-semibold">
                        {v.emergency_contact_phone || "—"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-wider text-white/50">
                        Relationship
                      </div>
                      <div className="mt-1 font-semibold">
                        {v.emergency_contact_relationship || "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 text-sm text-white/60">
        <Link href="/JoinUS/Volunteer" className="transition hover:text-white">
          View public volunteer page →
        </Link>
      </div>
    </div>
  );
}