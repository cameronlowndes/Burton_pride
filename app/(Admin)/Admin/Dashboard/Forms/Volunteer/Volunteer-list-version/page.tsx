"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

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

type VolunteerForm = {
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  availability: string[];
  experience: string;
  why_volunteer: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
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
  volunteer?: VolunteerRow;
};

type DeleteModalState = {
  open: boolean;
  mode: "single" | "bulk";
  id?: string;
  name?: string;
};

const API_URL = "/api/admin/volunteers";

const emptyForm: VolunteerForm = {
  full_name: "",
  email: "",
  phone: "",
  date_of_birth: "",
  availability: [],
  experience: "",
  why_volunteer: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contact_relationship: "",
  status: "new",
  is_read: true,
};

const dayOptions = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const timeOptions = ["Morning", "Afternoon", "Evening", "Flexible"];

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
    month: "2-digit",
    year: "numeric",
  });
}

function toDateInputValue(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return "";
  }
  return d.toISOString().slice(0, 10);
}

function parseAvailability(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/60">
      {children}
    </label>
  );
}

function AvailabilityButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border-fuchsia-400/30 bg-fuchsia-500/20 text-white shadow-[0_0_0_1px_rgba(232,121,249,0.12)]"
          : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

export default function VolunteerAdminPage() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingVolunteerId, setEditingVolunteerId] = useState<string | null>(null);

  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    open: false,
    mode: "single",
  });
  const [confirmDeleting, setConfirmDeleting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [stats, setStats] = useState<ApiResponse["stats"] | null>(null);
  const [volunteers, setVolunteers] = useState<VolunteerRow[]>([]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | VolunteerStatus>("all");

  const [form, setForm] = useState<VolunteerForm>(emptyForm);

  const isEditing = Boolean(editingVolunteerId);

  function updateForm<K extends keyof VolunteerForm>(key: K, value: VolunteerForm[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function toggleAvailability(option: string) {
    setForm((prev) => {
      const exists = prev.availability.includes(option);

      return {
        ...prev,
        availability: exists
          ? prev.availability.filter((item) => item !== option)
          : [...prev.availability, option],
      };
    });
  }

  function resetForm() {
    setForm(emptyForm);
    setFormError(null);
    setEditingVolunteerId(null);
  }

  function openCreateModal() {
    resetForm();
    setShowFormModal(true);
  }

  function openEditModal(volunteer: VolunteerRow) {
    setForm({
      full_name: volunteer.full_name || "",
      email: volunteer.email || "",
      phone: volunteer.phone || "",
      date_of_birth: toDateInputValue(volunteer.date_of_birth),
      availability: parseAvailability(volunteer.availability),
      experience: volunteer.experience || "",
      why_volunteer: volunteer.why_volunteer || "",
      emergency_contact_name: volunteer.emergency_contact_name || "",
      emergency_contact_phone: volunteer.emergency_contact_phone || "",
      emergency_contact_relationship: volunteer.emergency_contact_relationship || "",
      status: volunteer.status,
      is_read: volunteer.is_read,
    });
    setEditingVolunteerId(volunteer.id);
    setFormError(null);
    setShowFormModal(true);
  }

  function closeFormModal() {
    if (saving) return;
    setShowFormModal(false);
    setFormError(null);
  }

  function openDeleteSingle(id: string, name: string) {
    setDeleteModal({
      open: true,
      mode: "single",
      id,
      name,
    });
  }

  function openDeleteBulk() {
    setDeleteModal({
      open: true,
      mode: "bulk",
    });
  }

  function closeDeleteModal() {
    if (confirmDeleting) return;
    setDeleteModal({
      open: false,
      mode: "single",
    });
  }

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(API_URL, { cache: "no-store" });
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

  async function saveVolunteer() {
    setFormError(null);

    if (!form.full_name.trim()) {
      setFormError("Full name is required.");
      return;
    }

    if (!form.email.trim()) {
      setFormError("Email is required.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        id: editingVolunteerId,
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        date_of_birth: form.date_of_birth || null,
        availability: form.availability.length > 0 ? form.availability.join(", ") : null,
        experience: form.experience.trim() || null,
        why_volunteer: form.why_volunteer.trim() || null,
        emergency_contact_name: form.emergency_contact_name.trim() || null,
        emergency_contact_phone: form.emergency_contact_phone.trim() || null,
        emergency_contact_relationship: form.emergency_contact_relationship.trim() || null,
        status: form.status,
        is_read: form.is_read,
      };

      const res = await fetch(API_URL, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();

      let json: ApiResponse | null = null;

      try {
        json = JSON.parse(text);
      } catch {
        setFormError(`API did not return JSON. Response started with: ${text.slice(0, 120)}`);
        return;
      }

      if (!res.ok || !json?.ok) {
        setFormError(json?.error || `Failed with ${res.status}`);
        return;
      }

      setShowFormModal(false);
      resetForm();
      await load();
    } catch (e: any) {
      setFormError(e?.message || `Failed to ${isEditing ? "update" : "create"} volunteer`);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    try {
      setConfirmDeleting(true);
      setError(null);

      let res: Response;

      if (deleteModal.mode === "single") {
        res = await fetch(API_URL, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: deleteModal.id }),
        });
      } else {
        const ids = filteredVolunteers.map((v) => v.id);

        res = await fetch(API_URL, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids }),
        });
      }

      const text = await res.text();

      let json: { ok: boolean; error?: string } | null = null;

      try {
        json = JSON.parse(text);
      } catch {
        setError(`API did not return JSON. Response started with: ${text.slice(0, 120)}`);
        return;
      }

      if (!res.ok || !json?.ok) {
        setError(json?.error || "Delete failed");
        return;
      }

      setDeleteModal({
        open: false,
        mode: "single",
      });

      await load();
    } catch (e: any) {
      setError(e?.message || "Delete failed");
    } finally {
      setConfirmDeleting(false);
    }
  }

  async function exportToExcelStyled() {
    if (!filteredVolunteers.length) return;

    try {
      setExporting(true);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Burton Pride Admin Portal";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Volunteers", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      worksheet.columns = [
        { header: "Applied At", key: "applied_at", width: 22 },
        { header: "Full Name", key: "full_name", width: 24 },
        { header: "Email", key: "email", width: 30 },
        { header: "Phone", key: "phone", width: 16 },
        { header: "Date Of Birth", key: "date_of_birth", width: 16 },
        { header: "Availability", key: "availability", width: 28 },
        { header: "Experience", key: "experience", width: 28 },
        { header: "Why Volunteer", key: "why_volunteer", width: 30 },
        { header: "Emergency Contact Name", key: "emergency_contact_name", width: 24 },
        { header: "Emergency Contact Phone", key: "emergency_contact_phone", width: 22 },
        {
          header: "Emergency Contact Relationship",
          key: "emergency_contact_relationship",
          width: 26,
        },
        { header: "Status", key: "status", width: 14 },
        { header: "Is Read", key: "is_read", width: 12 },
      ];

      filteredVolunteers.forEach((v) => {
        worksheet.addRow({
          applied_at: formatDate(v.created_at),
          full_name: v.full_name || "",
          email: v.email || "",
          phone: v.phone || "",
          date_of_birth: formatDob(v.date_of_birth),
          availability: v.availability || "",
          experience: v.experience || "",
          why_volunteer: v.why_volunteer || "",
          emergency_contact_name: v.emergency_contact_name || "",
          emergency_contact_phone: v.emergency_contact_phone || "",
          emergency_contact_relationship: v.emergency_contact_relationship || "",
          status: statusLabel(v.status),
          is_read: v.is_read ? "Yes" : "No",
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

        row.height = 22;

        row.eachCell((cell, colNumber) => {
          cell.alignment = {
            vertical: "top",
            horizontal: colNumber === 12 || colNumber === 13 ? "center" : "left",
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

          if (colNumber === 12) {
            const value = String(cell.value || "");

            if (value === "Done") {
              cell.font = { bold: true, color: { argb: "FF166534" } };
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFDCFCE7" },
              };
            } else if (value === "In Progress") {
              cell.font = { bold: true, color: { argb: "FF92400E" } };
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFEF3C7" },
              };
            } else if (value === "New") {
              cell.font = { bold: true, color: { argb: "FF1D4ED8" } };
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFDBEAFE" },
              };
            }
          }

          if (colNumber === 13) {
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
        to: { row: 1, column: 13 },
      };

      worksheet.addTable({
        name: "VolunteerApplicationsTable",
        ref: "A1",
        headerRow: true,
        style: {
          theme: "TableStyleMedium9",
          showRowStripes: true,
        },
        columns: [
          { name: "Applied At" },
          { name: "Full Name" },
          { name: "Email" },
          { name: "Phone" },
          { name: "Date Of Birth" },
          { name: "Availability" },
          { name: "Experience" },
          { name: "Why Volunteer" },
          { name: "Emergency Contact Name" },
          { name: "Emergency Contact Phone" },
          { name: "Emergency Contact Relationship" },
          { name: "Status" },
          { name: "Is Read" },
        ],
        rows: filteredVolunteers.map((v) => [
          formatDate(v.created_at),
          v.full_name || "",
          v.email || "",
          v.phone || "",
          formatDob(v.date_of_birth),
          v.availability || "",
          v.experience || "",
          v.why_volunteer || "",
          v.emergency_contact_name || "",
          v.emergency_contact_phone || "",
          v.emergency_contact_relationship || "",
          statusLabel(v.status),
          v.is_read ? "Yes" : "No",
        ]),
      });

      worksheet.getCell("A1").note = "Volunteer applications export";
      worksheet.getRow(1).font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
      };

      for (let i = 2; i <= filteredVolunteers.length + 1; i += 1) {
        const row = worksheet.getRow(i);

        const longestText = Math.max(
          String(row.getCell(6).value || "").length,
          String(row.getCell(7).value || "").length,
          String(row.getCell(8).value || "").length
        );

        if (longestText > 80) row.height = 54;
        else if (longestText > 40) row.height = 38;
        else row.height = 24;
      }

      worksheet.getColumn(1).alignment = { horizontal: "left", vertical: "top" };
      worksheet.getColumn(2).alignment = { horizontal: "left", vertical: "top" };
      worksheet.getColumn(3).alignment = { horizontal: "left", vertical: "top" };
      worksheet.getColumn(4).alignment = { horizontal: "left", vertical: "top" };
      worksheet.getColumn(5).alignment = { horizontal: "left", vertical: "top" };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(
        blob,
        `volunteer-applications-${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (err: any) {
      setError(err?.message || "Failed to export Excel file");
    } finally {
      setExporting(false);
    }
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
            <Pill>API: {API_URL}</Pill>
            <Pill>Max rows: 5000</Pill>
            {loading ? <Pill>Loading…</Pill> : <Pill>Loaded</Pill>}
            {exporting ? <Pill>Exporting…</Pill> : null}
            {saving ? <Pill>Saving…</Pill> : null}
            {confirmDeleting ? <Pill>Deleting…</Pill> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            className="cursor-pointer rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-500/30"
          >
            + New Volunteer
          </button>

          <button
            type="button"
            onClick={load}
            className="cursor-pointer rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/15"
          >
            ⟳ Refresh
          </button>

          <button
            type="button"
            onClick={openDeleteBulk}
            disabled={loading || confirmDeleting || filteredVolunteers.length === 0}
            className="cursor-pointer rounded-xl border border-red-400/20 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete All Filtered
          </button>

          <button
            type="button"
            onClick={exportToExcelStyled}
            disabled={loading || exporting || filteredVolunteers.length === 0}
            className="cursor-pointer rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "⭳ Export Styled Excel"}
          </button>

          <Link
            href="/Admin/Dashboard/Forms/Volunteer"
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

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(v)}
                      disabled={confirmDeleting}
                      className="rounded-xl border border-amber-400/20 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => openDeleteSingle(v.id, v.full_name)}
                      disabled={confirmDeleting}
                      className="rounded-xl border border-red-400/20 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/25 disabled:opacity-50"
                    >
                      Delete
                    </button>
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
                    <div className="text-xs uppercase tracking-wider text-white/50">
                      Date of birth
                    </div>
                    <div className="mt-1 font-semibold">{formatDob(v.date_of_birth)}</div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2 xl:col-span-3">
                    <div className="text-xs uppercase tracking-wider text-white/50">
                      Availability
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-white/90">
                      {v.availability || "—"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2 xl:col-span-3">
                    <div className="text-xs uppercase tracking-wider text-white/50">
                      Experience
                    </div>
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

      {showFormModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/10 bg-[#050816] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#050816]/95 px-6 py-4 backdrop-blur">
              <div>
                <h2 className="text-xl font-extrabold sm:text-2xl">
                  {isEditing ? "Edit Volunteer" : "Create New Volunteer"}
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  {isEditing
                    ? "Update this volunteer application from the admin portal."
                    : "Add a volunteer application manually from the admin portal."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeFormModal}
                disabled={saving}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-50"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-6">
              {formError ? (
                <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                  {formError}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <FieldLabel>Full name *</FieldLabel>
                  <input
                    value={form.full_name}
                    onChange={(e) => updateForm("full_name", e.target.value)}
                    placeholder="Enter full name"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/25"
                  />
                </div>

                <div>
                  <FieldLabel>Email *</FieldLabel>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateForm("email", e.target.value)}
                    placeholder="Enter email address"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/25"
                  />
                </div>

                <div>
                  <FieldLabel>Phone</FieldLabel>
                  <input
                    value={form.phone}
                    onChange={(e) => updateForm("phone", e.target.value)}
                    placeholder="Enter phone number"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/25"
                  />
                </div>

                <div>
                  <FieldLabel>Date of birth</FieldLabel>
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => updateForm("date_of_birth", e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/25"
                  />
                </div>

                <div>
                  <FieldLabel>Status</FieldLabel>
                  <select
                    value={form.status}
                    onChange={(e) => updateForm("status", e.target.value as VolunteerStatus)}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/25"
                  >
                    <option value="new">New</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>

                <div>
                  <FieldLabel>Marked as read</FieldLabel>
                  <select
                    value={form.is_read ? "yes" : "no"}
                    onChange={(e) => updateForm("is_read", e.target.value === "yes")}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/25"
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Availability</FieldLabel>

                  <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div>
                      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">
                        Days
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {dayOptions.map((option) => (
                          <AvailabilityButton
                            key={option}
                            label={option}
                            active={form.availability.includes(option)}
                            onClick={() => toggleAvailability(option)}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">
                        Time
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {timeOptions.map((option) => (
                          <AvailabilityButton
                            key={option}
                            label={option}
                            active={form.availability.includes(option)}
                            onClick={() => toggleAvailability(option)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Experience</FieldLabel>
                  <textarea
                    rows={4}
                    value={form.experience}
                    onChange={(e) => updateForm("experience", e.target.value)}
                    placeholder="Enter experience"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/25"
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Why volunteer</FieldLabel>
                  <textarea
                    rows={4}
                    value={form.why_volunteer}
                    onChange={(e) => updateForm("why_volunteer", e.target.value)}
                    placeholder="Why does this person want to volunteer?"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/25"
                  />
                </div>

                <div>
                  <FieldLabel>Emergency contact name</FieldLabel>
                  <input
                    value={form.emergency_contact_name}
                    onChange={(e) => updateForm("emergency_contact_name", e.target.value)}
                    placeholder="Enter emergency contact name"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/25"
                  />
                </div>

                <div>
                  <FieldLabel>Emergency contact phone</FieldLabel>
                  <input
                    value={form.emergency_contact_phone}
                    onChange={(e) => updateForm("emergency_contact_phone", e.target.value)}
                    placeholder="Enter emergency contact phone"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/25"
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Emergency contact relationship</FieldLabel>
                  <input
                    value={form.emergency_contact_relationship}
                    onChange={(e) =>
                      updateForm("emergency_contact_relationship", e.target.value)
                    }
                    placeholder="Parent, partner, sibling, friend..."
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/25"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-white/10 pt-6">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-50"
                >
                  Reset
                </button>

                <button
                  type="button"
                  onClick={closeFormModal}
                  disabled={saving}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={saveVolunteer}
                  disabled={saving}
                  className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/20 px-5 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-500/30 disabled:opacity-50"
                >
                  {saving
                    ? isEditing
                      ? "Updating..."
                      : "Saving..."
                    : isEditing
                    ? "Update Volunteer"
                    : "Save Volunteer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteModal.open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-red-500/20 bg-[#050816] shadow-2xl">
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-xl font-extrabold text-white sm:text-2xl">
                {deleteModal.mode === "single" ? "Delete Volunteer" : "Delete Filtered Volunteers"}
              </h2>
              <p className="mt-2 text-sm text-white/60">
                {deleteModal.mode === "single"
                  ? "This action will permanently remove this volunteer application."
                  : `This action will permanently remove ${filteredVolunteers.length} filtered volunteer application${
                      filteredVolunteers.length === 1 ? "" : "s"
                    }.`}
              </p>
            </div>

            <div className="px-6 py-6">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                <div className="text-sm font-semibold text-red-100">
                  {deleteModal.mode === "single" ? "You are deleting:" : "You are about to delete:"}
                </div>

                <div className="mt-2 text-sm text-white/80">
                  {deleteModal.mode === "single" ? (
                    <span>
                      <span className="font-bold text-white">{deleteModal.name || "Volunteer"}</span>
                    </span>
                  ) : (
                    <span>
                      <span className="font-bold text-white">{filteredVolunteers.length}</span>{" "}
                      currently filtered volunteer application
                      {filteredVolunteers.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                <div className="mt-3 text-sm text-red-200/90">
                  This cannot be undone.
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={confirmDeleting}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={confirmDeleting}
                  className="rounded-xl border border-red-400/20 bg-red-500/20 px-5 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/30 disabled:opacity-50"
                >
                  {confirmDeleting
                    ? deleteModal.mode === "single"
                      ? "Deleting..."
                      : "Deleting All..."
                    : deleteModal.mode === "single"
                    ? "Delete Volunteer"
                    : "Delete All Filtered"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}