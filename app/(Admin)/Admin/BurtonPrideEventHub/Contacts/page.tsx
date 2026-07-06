"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
  Edit,
} from "lucide-react";

type Contact = {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  service_type: string | null;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  contacts?: Contact[];
  contact?: Contact;
};

type FormState = {
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  service_type: string;
  notes: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  business_name: "",
  contact_name: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  service_type: "",
  notes: "",
  is_active: true,
};

const serviceTypes = [
  "Supplier",
  "Vendor",
  "Sponsor",
  "Venue",
  "Contractor",
  "Entertainer",
  "Charity",
  "Community Partner",
  "Food Vendor",
  "Security",
  "Medical / First Aid",
  "Toilets",
  "Waste / Bins",
  "Marketing",
  "Other",
];

export default function EventHubContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("");
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function readJson(res: Response): Promise<ApiResponse> {
    const text = await res.text();

    try {
      return text ? JSON.parse(text) : { ok: false };
    } catch {
      return {
        ok: false,
        error: text || "Server returned invalid JSON.",
      };
    }
  }

  async function loadContacts() {
    try {
      setLoading(true);
      setNotice(null);

      const res = await fetch("/api/admin/burton-pride-event-hub/contacts", {
        cache: "no-store",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load contacts.");
      }

      setContacts(data.contacts || []);
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to load contacts.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContacts();
  }, []);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const selectedType = serviceTypeFilter.trim().toLowerCase();

    return contacts.filter((contact) => {
      const serviceType = (contact.service_type || "").trim().toLowerCase();

      const matchesServiceType =
        !selectedType || serviceType === selectedType;

      const matchesSearch =
        !q ||
        contact.business_name.toLowerCase().includes(q) ||
        (contact.contact_name || "").toLowerCase().includes(q) ||
        (contact.email || "").toLowerCase().includes(q) ||
        (contact.phone || "").toLowerCase().includes(q) ||
        (contact.website || "").toLowerCase().includes(q) ||
        (contact.address || "").toLowerCase().includes(q) ||
        serviceType.includes(q) ||
        (contact.notes || "").toLowerCase().includes(q);

      return matchesServiceType && matchesSearch;
    });
  }, [contacts, search, serviceTypeFilter]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(contact: Contact) {
    setEditingId(contact.id);

    setForm({
      business_name: contact.business_name || "",
      contact_name: contact.contact_name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      website: contact.website || "",
      address: contact.address || "",
      service_type: contact.service_type || "",
      notes: contact.notes || "",
      is_active: Boolean(contact.is_active),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveContact() {
    try {
      setSaving(true);
      setNotice(null);

      if (!form.business_name.trim()) {
        throw new Error("Please enter the business name.");
      }

      const payload = {
        id: editingId || undefined,
        ...form,
      };

      const res = await fetch("/api/admin/burton-pride-event-hub/contacts", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save contact.");
      }

      setNotice({
        type: "success",
        message: editingId
          ? "Business contact updated successfully."
          : "Business contact added successfully.",
      });

      resetForm();
      await loadContacts();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to save contact.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;

    try {
      setSaving(true);
      setNotice(null);

      const res = await fetch("/api/admin/burton-pride-event-hub/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteId }),
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete contact.");
      }

      setNotice({
        type: "success",
        message: "Business contact deleted successfully.",
      });

      if (editingId === deleteId) {
        resetForm();
      }

      setDeleteId(null);
      await loadContacts();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to delete contact.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.22),_transparent_32%),linear-gradient(180deg,#12091f_0%,#24113a_48%,#111827_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-6 rounded-[32px] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-pink-400/30 bg-pink-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-pink-100">
                <Building2 className="h-4 w-4" />
                Event Hub
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight">
                Business Contacts
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-white/70">
                Store suppliers, vendors, sponsors, venues, entertainers,
                charities, contractors, and community partners for Burton Pride
                event planning.
              </p>
            </div>

            <button
              type="button"
              onClick={loadContacts}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {notice && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-semibold ${
              notice.type === "success"
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                : "border-red-400/30 bg-red-500/10 text-red-100"
            }`}
          >
            {notice.message}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <div className="rounded-[32px] border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
            <h2 className="mb-4 text-xl font-bold">
              {editingId ? "Edit business contact" : "Add business contact"}
            </h2>

            <div className="grid gap-4">
              <input
                value={form.business_name}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    business_name: e.target.value,
                  }))
                }
                placeholder="Business name"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
              />

              <input
                value={form.contact_name}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    contact_name: e.target.value,
                  }))
                }
                placeholder="Contact person"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
              />

              <input
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                placeholder="Email address"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
              />

              <input
                value={form.phone}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    phone: e.target.value,
                  }))
                }
                placeholder="Phone number"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
              />

              <input
                value={form.website}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    website: e.target.value,
                  }))
                }
                placeholder="Website"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
              />

              <input
                value={form.address}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    address: e.target.value,
                  }))
                }
                placeholder="Address"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
              />

              <select
                value={form.service_type}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    service_type: e.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
              >
                <option value="">Select service type</option>
                {serviceTypes.map((type) => (
                  <option key={type} value={type} className="bg-[#1f1030]">
                    {type}
                  </option>
                ))}
              </select>

              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder="Notes about this business"
                rows={5}
                className="resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
              />

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                />
                Active contact
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={saveContact}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update contact"
                    : "Add contact"}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold">Saved contacts</h2>
                <p className="mt-1 text-sm text-white/60">
                  {filteredContacts.length} contact
                  {filteredContacts.length === 1 ? "" : "s"} found.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, email, notes, or service..."
                    className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm outline-none placeholder:text-white/35 md:w-72"
                  />
                </div>

                <select
                  value={serviceTypeFilter}
                  onChange={(e) => setServiceTypeFilter(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none md:w-56"
                >
                  <option value="" className="bg-[#1f1030]">
                    All service types
                  </option>
                  {serviceTypes.map((type) => (
                    <option key={type} value={type} className="bg-[#1f1030]">
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                Loading contacts...
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-center text-white/60">
                No business contacts found yet.
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="rounded-3xl border border-white/10 bg-black/20 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-extrabold text-white">
                            {contact.business_name}
                          </h3>

                          {contact.service_type && (
                            <span className="rounded-full border border-pink-400/20 bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-100">
                              {contact.service_type}
                            </span>
                          )}

                          {contact.is_active ? (
                            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                              Active
                            </span>
                          ) : (
                            <span className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-100">
                              Inactive
                            </span>
                          )}
                        </div>

                        {contact.contact_name && (
                          <p className="mt-1 text-sm text-white/70">
                            Contact: {contact.contact_name}
                          </p>
                        )}

                        <div className="mt-4 grid gap-2 text-sm text-white/70">
                          {contact.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-white/40" />
                              <a
                                href={`mailto:${contact.email}`}
                                className="break-all hover:text-white"
                              >
                                {contact.email}
                              </a>
                            </div>
                          )}

                          {contact.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-white/40" />
                              <a
                                href={`tel:${contact.phone}`}
                                className="hover:text-white"
                              >
                                {contact.phone}
                              </a>
                            </div>
                          )}

                          {contact.website && (
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-white/40" />
                              <a
                                href={contact.website}
                                target="_blank"
                                rel="noreferrer"
                                className="break-all hover:text-white"
                              >
                                {contact.website}
                              </a>
                            </div>
                          )}

                          {contact.address && (
                            <div className="flex items-start gap-2">
                              <MapPin className="mt-0.5 h-4 w-4 text-white/40" />
                              <span>{contact.address}</span>
                            </div>
                          )}
                        </div>

                        {contact.notes && (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                            {contact.notes}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(contact)}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteId(contact.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100 transition hover:bg-red-500/20"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {deleteId && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-[32px] border border-red-500/20 bg-[#1b1028] shadow-2xl">
              <div className="border-b border-white/10 p-6">
                <h2 className="text-xl font-extrabold text-white">
                  Delete business contact?
                </h2>

                <p className="mt-2 text-sm text-white/60">
                  This will permanently remove this contact from the Event Hub.
                </p>
              </div>

              <div className="p-6">
                <p className="text-sm text-white/75">
                  Are you sure you want to delete this business contact? This
                  action cannot be undone.
                </p>
              </div>

              <div className="flex justify-end gap-3 border-t border-white/10 p-6">
                <button
                  type="button"
                  onClick={() => setDeleteId(null)}
                  disabled={saving}
                  className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={saving}
                  className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  {saving ? "Deleting..." : "Delete contact"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}