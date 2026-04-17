"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

type SponsorStatus = "pending" | "approved" | "rejected";

type SponsorRow = {
  id: string;
  created_at: string;
  sponsor_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  sponsorship_type: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  country: string | null;
  logo_link: string | null;
  message: string | null;
  story: string | null;
  status: SponsorStatus;
  is_read: boolean;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  stats?: {
    totalApplications: number;
    pendingApplications: number;
    approvedApplications: number;
    rejectedApplications: number;
  };
  sponsors?: SponsorRow[];
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
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

function statusBadgeClass(status: SponsorStatus) {
  if (status === "approved") {
    return "border-green-400/20 bg-green-500/15 text-green-100";
  }
  if (status === "rejected") {
    return "border-red-400/20 bg-red-500/15 text-red-100";
  }
  return "border-yellow-400/20 bg-yellow-500/15 text-yellow-100";
}

function sponsorshipTypeLabel(type: string | null) {
  if (!type) return "—";
  if (type === "sponsorship_in_kind") return "Sponsorship in Kind";
  if (type === "normal_sponsorship") return "Normal Sponsorship";
  return type;
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

function getAddressParts(item: SponsorRow) {
  return [
    { label: "Address line 1", value: item.address_line1 || "" },
    { label: "Address line 2", value: item.address_line2 || "" },
    { label: "City / Town", value: item.city || "" },
    { label: "County", value: item.county || "" },
    { label: "Postcode", value: item.postcode || "" },
    { label: "Country", value: item.country || "" },
  ].filter((part) => String(part.value || "").trim());
}

function getAddressText(item: SponsorRow) {
  return [
    item.address_line1,
    item.address_line2,
    item.city,
    item.county,
    item.postcode,
    item.country,
  ]
    .map((v) => (v || "").trim())
    .filter(Boolean)
    .join(", ");
}

function getGoogleMapsUrl(item: SponsorRow) {
  const address = getAddressText(item);
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function getStoryText(item: SponsorRow) {
  if (item.sponsorship_type === "Story") {
    return item.story?.trim() || item.message?.trim() || "";
  }
  return item.story?.trim() || "";
}

export default function SponsorAdminListPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<ApiResponse["stats"] | null>(null);
  const [sponsors, setSponsors] = useState<SponsorRow[]>([]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SponsorStatus>("all");
  const [readFilter, setReadFilter] = useState<"all" | "read" | "unread">("all");

  function goToReply(s: SponsorRow) {
    const params = new URLSearchParams();
    params.set("to", s.email);
    params.set("subject", `Re: ${s.sponsor_name} sponsorship application`);
    router.push(`/Admin/Email/Sending?${params.toString()}`);
  }

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/sponsors", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      const text = await res.text();

      let json: ApiResponse | null = null;

      try {
        json = JSON.parse(text);
      } catch {
        setError(`API did not return JSON. Response started with: ${text.slice(0, 120)}`);
        setStats(null);
        setSponsors([]);
        return;
      }

      if (!res.ok || !json?.ok) {
        setError(json?.error || `Request failed with ${res.status}`);
        setStats(null);
        setSponsors([]);
        return;
      }

      setSponsors(Array.isArray(json.sponsors) ? json.sponsors : []);
      setStats(json.stats || null);
    } catch (e: any) {
      setError(e?.message || "Failed to load sponsor applications");
      setStats(null);
      setSponsors([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredSponsors = useMemo(() => {
    const q = query.trim().toLowerCase();

    return sponsors.filter((s) => {
      const matchesStatus = statusFilter === "all" ? true : s.status === statusFilter;
      const matchesRead =
        readFilter === "all" ? true : readFilter === "read" ? s.is_read : !s.is_read;

      if (!matchesStatus || !matchesRead) return false;
      if (!q) return true;

      const sponsorName = (s.sponsor_name || "").toLowerCase();
      const contactName = (s.contact_name || "").toLowerCase();
      const email = (s.email || "").toLowerCase();
      const phone = (s.phone || "").toLowerCase();
      const sponsorshipType = (s.sponsorship_type || "").toLowerCase();
      const address1 = (s.address_line1 || "").toLowerCase();
      const address2 = (s.address_line2 || "").toLowerCase();
      const city = (s.city || "").toLowerCase();
      const county = (s.county || "").toLowerCase();
      const postcode = (s.postcode || "").toLowerCase();
      const country = (s.country || "").toLowerCase();
      const message = (s.message || "").toLowerCase();
      const story = (s.story || "").toLowerCase();

      return (
        sponsorName.includes(q) ||
        contactName.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        sponsorshipType.includes(q) ||
        address1.includes(q) ||
        address2.includes(q) ||
        city.includes(q) ||
        county.includes(q) ||
        postcode.includes(q) ||
        country.includes(q) ||
        message.includes(q) ||
        story.includes(q)
      );
    });
  }, [sponsors, query, statusFilter, readFilter]);

  const calculatedStats = useMemo(() => {
    return {
      totalApplications: sponsors.length,
      pendingApplications: sponsors.filter((s) => s.status === "pending").length,
      approvedApplications: sponsors.filter((s) => s.status === "approved").length,
      rejectedApplications: sponsors.filter((s) => s.status === "rejected").length,
    };
  }, [sponsors]);

  const displayStats = useMemo(() => {
    const apiHasRealStats =
      stats &&
      typeof stats.totalApplications === "number" &&
      typeof stats.pendingApplications === "number" &&
      typeof stats.approvedApplications === "number" &&
      typeof stats.rejectedApplications === "number";

    if (!apiHasRealStats) return calculatedStats;

    const apiLooksWrong =
      sponsors.length > 0 &&
      stats.totalApplications === 0 &&
      calculatedStats.totalApplications > 0;

    return apiLooksWrong ? calculatedStats : stats;
  }, [stats, calculatedStats, sponsors.length]);

  async function exportToExcelStyled() {
    if (!filteredSponsors.length) return;

    try {
      setExporting(true);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Burton Pride Admin Portal";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Sponsors", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      worksheet.columns = [
        { header: "Submitted At", key: "submitted_at", width: 22 },
        { header: "Sponsor Name", key: "sponsor_name", width: 26 },
        { header: "Contact Name", key: "contact_name", width: 24 },
        { header: "Email", key: "email", width: 30 },
        { header: "Phone", key: "phone", width: 18 },
        { header: "Sponsorship Type", key: "sponsorship_type", width: 22 },
        { header: "Story", key: "story", width: 40 },
        { header: "Address Line 1", key: "address_line1", width: 24 },
        { header: "Address Line 2", key: "address_line2", width: 24 },
        { header: "City / Town", key: "city", width: 18 },
        { header: "County", key: "county", width: 18 },
        { header: "Postcode", key: "postcode", width: 14 },
        { header: "Country", key: "country", width: 18 },
        { header: "Google Maps", key: "google_maps", width: 40 },
        { header: "Logo Link", key: "logo_link", width: 40 },
        { header: "Message / Requirements", key: "message", width: 36 },
        { header: "Status", key: "status", width: 14 },
        { header: "Is Read", key: "is_read", width: 12 },
      ];

      filteredSponsors.forEach((s) => {
        worksheet.addRow({
          submitted_at: formatDate(s.created_at),
          sponsor_name: s.sponsor_name || "",
          contact_name: s.contact_name || "",
          email: s.email || "",
          phone: s.phone || "",
          sponsorship_type: sponsorshipTypeLabel(s.sponsorship_type),
          story: getStoryText(s) || "",
          address_line1: s.address_line1 || "",
          address_line2: s.address_line2 || "",
          city: s.city || "",
          county: s.county || "",
          postcode: s.postcode || "",
          country: s.country || "",
          google_maps: getGoogleMapsUrl(s) || "",
          logo_link: s.logo_link || "",
          message: s.message || "",
          status: statusLabel(s.status),
          is_read: s.is_read ? "Yes" : "No",
        });
      });

      const headerRow = worksheet.getRow(1);
      headerRow.height = 24;

      headerRow.eachCell((cell) => {
        cell.font = {
          bold: true,
          color: { argb: "FFFFFFFF" },
          size: 12,
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF7C3AED" },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFD1D5DB" } },
          left: { style: "thin", color: { argb: "FFD1D5DB" } },
          bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
          right: { style: "thin", color: { argb: "FFD1D5DB" } },
        };
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        row.height = 24;

        row.eachCell((cell, colNumber) => {
          cell.alignment = {
            vertical: "top",
            horizontal: colNumber === 17 || colNumber === 18 ? "center" : "left",
            wrapText: true,
          };

          cell.border = {
            top: { style: "thin", color: { argb: "FFE5E7EB" } },
            left: { style: "thin", color: { argb: "FFE5E7EB" } },
            bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
            right: { style: "thin", color: { argb: "FFE5E7EB" } },
          };

          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: rowNumber % 2 === 0 ? "FFF9FAFB" : "FFFFFFFF",
            },
          };

          if (colNumber === 17) {
            const value = String(cell.value || "");

            if (value === "Approved") {
              cell.font = { bold: true, color: { argb: "FF166534" } };
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFDCFCE7" },
              };
            } else if (value === "Rejected") {
              cell.font = { bold: true, color: { argb: "FF991B1B" } };
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFEE2E2" },
              };
            } else if (value === "Pending") {
              cell.font = { bold: true, color: { argb: "FF92400E" } };
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFEF3C7" },
              };
            }
          }

          if (colNumber === 18) {
            const value = String(cell.value || "");
            if (value === "Yes") {
              cell.font = { bold: true, color: { argb: "FF166534" } };
            } else {
              cell.font = { bold: true, color: { argb: "FFBE185D" } };
            }
          }
        });
      });

      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: 18 },
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(blob, `sponsor-applications-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) {
      setError(err?.message || "Failed to export Excel file");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-6 text-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Sponsor Applications</h1>
          <p className="mt-1 text-white/70">
            View sponsor applications, story submissions, business details, address, and status.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Pill>API: /api/admin/sponsors</Pill>
            <Pill>Max rows: 5000</Pill>
            {loading ? <Pill>Loading…</Pill> : <Pill>Loaded</Pill>}
            {exporting ? <Pill>Exporting…</Pill> : null}
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
            onClick={exportToExcelStyled}
            disabled={loading || exporting || filteredSponsors.length === 0}
            className="cursor-pointer rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "⭳ Export Styled Excel"}
          </button>

          <Link
            href="/Admin/Dashboard/Forms/Sponsors"
            className="inline-flex items-center rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white backdrop-blur hover:bg-white/20"
          >
            ← Message Version
          </Link>

          <Link
            href="/Admin/Dashboard"
            className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Stat
          label="Total applications"
          value={loading ? "…" : displayStats.totalApplications}
        />
        <Stat
          label="Pending"
          value={loading ? "…" : displayStats.pendingApplications}
        />
        <Stat
          label="Approved"
          value={loading ? "…" : displayStats.approvedApplications}
        />
        <Stat
          label="Rejected"
          value={loading ? "…" : displayStats.rejectedApplications}
        />
      </div>

      {error ? (
        <div className="mt-6 rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/10 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-extrabold">Search applications</div>
            <div className="text-sm text-white/60">
              Search by sponsor name, contact, email, address, phone, story, or message
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sponsor applications..."
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/40 focus:border-white/25 sm:w-80"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | SponsorStatus)}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/25"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              value={readFilter}
              onChange={(e) => setReadFilter(e.target.value as "all" | "read" | "unread")}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/25"
            >
              <option value="all">All read states</option>
              <option value="unread">Unread only</option>
              <option value="read">Read only</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-xl backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <div className="text-lg font-extrabold">All sponsor applications</div>
            <div className="text-sm text-white/60">
              Showing {loading ? "…" : filteredSponsors.length} applications
            </div>
          </div>

          <div className="text-xs text-white/50">Tip: search by sponsor name, story, or postcode</div>
        </div>

        {loading ? (
          <div className="p-6 text-white/80">Loading sponsor applications...</div>
        ) : filteredSponsors.length === 0 ? (
          <div className="p-6 text-white/80">No sponsor applications found.</div>
        ) : (
          <div className="space-y-4 p-4 sm:p-5">
            {filteredSponsors.map((s) => {
              const mapsUrl = getGoogleMapsUrl(s);
              const addressParts = getAddressParts(s);
              const storyText = getStoryText(s);

              return (
                <div
                  key={s.id}
                  className="rounded-3xl border border-white/10 bg-black/20 p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="break-words text-lg font-extrabold">{s.sponsor_name}</h2>

                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${statusBadgeClass(
                            s.status
                          )}`}
                        >
                          {statusLabel(s.status)}
                        </span>

                        {!s.is_read ? (
                          <span className="inline-flex items-center rounded-full border border-pink-400/20 bg-pink-500/15 px-3 py-1 text-[11px] font-semibold text-pink-100">
                            Unread
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-green-400/20 bg-green-500/15 px-3 py-1 text-[11px] font-semibold text-green-100">
                            Read
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-sm text-white/60">
                        Submitted on {formatDate(s.created_at)}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {mapsUrl ? (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-xl border border-blue-400/20 bg-blue-500/15 px-3 py-2 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/25"
                        >
                          Open in Google Maps
                        </a>
                      ) : null}

                      {s.email ? (
                        <button
                          type="button"
                          onClick={() => goToReply(s)}
                          className="inline-flex items-center rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
                        >
                          Reply
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-wider text-white/50">
                        Contact name
                      </div>
                      <div className="mt-1 break-words font-semibold">
                        {s.contact_name || "—"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-wider text-white/50">Email</div>
                      <div className="mt-1 break-words font-semibold">{s.email || "—"}</div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-wider text-white/50">Phone</div>
                      <div className="mt-1 font-semibold">{s.phone || "—"}</div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2 xl:col-span-3">
                      <div className="text-xs uppercase tracking-wider text-white/50">
                        Sponsorship type
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-white/90">
                        {sponsorshipTypeLabel(s.sponsorship_type)}
                      </div>
                    </div>

                    {s.sponsorship_type === "Story" && (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2 xl:col-span-3">
                        <div className="text-xs uppercase tracking-wider text-white/50">
                          Story
                        </div>
                        <div className="mt-1 whitespace-pre-wrap text-white/90">
                          {storyText || "No story was provided."}
                        </div>
                      </div>
                    )}

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2 xl:col-span-3">
                      <div className="mb-3 text-sm font-bold text-white/85">Business address</div>

                      {addressParts.length === 0 ? (
                        <div className="text-white/80">—</div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {addressParts.map((part) => (
                            <div
                              key={part.label}
                              className="rounded-2xl border border-white/10 bg-black/20 p-4"
                            >
                              <div className="text-xs uppercase tracking-wider text-white/50">
                                {part.label}
                              </div>
                              <div className="mt-1 break-words font-semibold">
                                {part.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2 xl:col-span-3">
                      <div className="text-xs uppercase tracking-wider text-white/50">
                        Message / requirements
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-white/90">
                        {s.message || "—"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2 xl:col-span-3">
                      <div className="text-xs uppercase tracking-wider text-white/50">
                        Full business address
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-white/90">
                        {getAddressText(s) || "—"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2 xl:col-span-3">
                      <div className="text-xs uppercase tracking-wider text-white/50">
                        Logo
                      </div>

                      {s.logo_link ? (
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                          <div className="relative h-28 w-28 overflow-hidden rounded-2xl bg-white">
                            <Image
                              src={s.logo_link}
                              alt={`${s.sponsor_name} logo`}
                              fill
                              className="object-contain p-2"
                              unoptimized
                            />
                          </div>

                          <div className="min-w-0">
                            <a
                              href={s.logo_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="break-all text-sm font-semibold text-blue-200 underline underline-offset-2"
                            >
                              {s.logo_link}
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 text-white/80">No logo uploaded</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 text-sm text-white/60">
        <Link href="/Sponsor" className="transition hover:text-white">
          View public sponsor page →
        </Link>
      </div>
    </div>
  );
}