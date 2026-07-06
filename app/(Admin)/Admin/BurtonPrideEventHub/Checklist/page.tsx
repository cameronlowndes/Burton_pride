"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CalendarDays,
  ClipboardCheck,
  Download,
  Edit,
  FileUp,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  Lock,
  Unlock,
} from "lucide-react";

type Contact = {
  id: string;
  organisation_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  organisation_type: string | null;
  pitch_number: string | null;
  arrival_time: string | null;
  checklist_sent: boolean;
  checklist_confirmed: boolean;
  notes: string | null;
  bring_gazebo: boolean;
  bring_gazebo_weights: boolean;
  bring_table: boolean;
  bring_chairs: boolean;
  bring_display_materials: boolean;
  bring_leaflets: boolean;
  bring_stock: boolean;
  bring_donation_bucket: boolean;
  bring_card_reader: boolean;
  bring_cash_float: boolean;
  bring_tablecloth: boolean;
  bring_signage: boolean;
  bring_weather_protection: boolean;
  bring_waste_bags: boolean;
  bring_activity_equipment: boolean;
  bring_pli_documents: boolean;
  bring_approved_electricals: boolean;
  reminder_no_tables_chairs: boolean;
  reminder_no_gazebos: boolean;
  reminder_no_weights: boolean;
  reminder_no_power: boolean;
  reminder_fit_pitch: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  event_year?: number;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  contacts?: Contact[];
  contact?: Contact;
};

type EventYear = {
  id: string;
  event_year: number;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  unlocked_at: string | null;
  unlocked_by: string | null;
  created_at?: string;
};

type YearsResponse = {
  ok: boolean;
  error?: string;
  years?: EventYear[];
  year?: EventYear;
};


type BusinessContact = {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website?: string | null;
  address?: string | null;
  service_type: string | null;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type BusinessContactsResponse = {
  ok: boolean;
  error?: string;
  contacts?: BusinessContact[];
  contact?: BusinessContact;
};

type FormState = Omit<Contact, "id" | "created_at" | "updated_at">;

const API_ROUTE = "/api/admin/burton-pride-event-hub/checklist";
const YEARS_API_ROUTE = "/api/admin/burton-pride-event-hub/years";
const CONTACTS_API_ROUTE = "/api/admin/burton-pride-event-hub/contacts";

const emptyForm: FormState = {
  organisation_name: "",
  contact_name: "",
  email: "",
  phone: "",
  organisation_type: "Stallholder",
  pitch_number: "",
  arrival_time: "",
  checklist_sent: false,
  checklist_confirmed: false,
  notes: "",
  bring_gazebo: false,
  bring_gazebo_weights: false,
  bring_table: false,
  bring_chairs: false,
  bring_display_materials: false,
  bring_leaflets: false,
  bring_stock: false,
  bring_donation_bucket: false,
  bring_card_reader: false,
  bring_cash_float: false,
  bring_tablecloth: false,
  bring_signage: false,
  bring_weather_protection: false,
  bring_waste_bags: false,
  bring_activity_equipment: false,
  bring_pli_documents: false,
  bring_approved_electricals: false,
  reminder_no_tables_chairs: true,
  reminder_no_gazebos: true,
  reminder_no_weights: true,
  reminder_no_power: true,
  reminder_fit_pitch: true,
  is_active: true,
};

const organisationTypes = [
  "Stallholder",
  "Charity",
  "Vendor",
  "Food Vendor",
  "Community Group",
  "Sponsor",
  "Partner",
  "Entertainment",
  "Service Provider",
  "Other",
];

const bringChecklist: Array<{ key: keyof FormState; label: string }> = [
  { key: "bring_gazebo", label: "Gazebo, if using one" },
  { key: "bring_gazebo_weights", label: "Gazebo weights" },
  { key: "bring_table", label: "Table" },
  { key: "bring_chairs", label: "Chairs" },
  { key: "bring_display_materials", label: "Display materials" },
  { key: "bring_leaflets", label: "Leaflets" },
  { key: "bring_stock", label: "Stock" },
  { key: "bring_donation_bucket", label: "Donation bucket, if applicable" },
  { key: "bring_card_reader", label: "Card reader, if applicable" },
  { key: "bring_cash_float", label: "Cash float, if applicable" },
  { key: "bring_tablecloth", label: "Tablecloth" },
  { key: "bring_signage", label: "Signage" },
  { key: "bring_weather_protection", label: "Weather protection" },
  { key: "bring_waste_bags", label: "Waste bags" },
  { key: "bring_activity_equipment", label: "Games, raffles, or activity equipment" },
  { key: "bring_pli_documents", label: "Public Liability Insurance documents" },
  { key: "bring_approved_electricals", label: "Approved electrical items, if applicable" },
];

const reminderChecklist: Array<{ key: keyof FormState; label: string }> = [
  { key: "reminder_no_tables_chairs", label: "Burton Pride does not provide tables or chairs." },
  { key: "reminder_no_gazebos", label: "Burton Pride does not provide gazebos." },
  { key: "reminder_no_weights", label: "Burton Pride does not provide gazebo weights." },
  { key: "reminder_no_power", label: "Burton Pride does not provide power unless separately agreed in writing." },
  { key: "reminder_fit_pitch", label: "Everything must fit inside their allocated pitch." },
];

function valueToBool(value: string) {
  const clean = value.trim().toLowerCase();
  return ["yes", "true", "1", "y", "sent", "confirmed", "active"].includes(clean);
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current.trim());
      current = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}


function mapServiceTypeToOrganisationType(serviceType: string | null | undefined) {
  const clean = String(serviceType || "").trim().toLowerCase();

  if (!clean) return "Stallholder";
  if (clean.includes("charity")) return "Charity";
  if (clean.includes("food")) return "Food Vendor";
  if (clean.includes("vendor")) return "Vendor";
  if (clean.includes("sponsor")) return "Sponsor";
  if (clean.includes("community")) return "Community Group";
  if (clean.includes("partner")) return "Partner";
  if (clean.includes("entertain") || clean.includes("perform")) return "Entertainment";
  if (clean.includes("supplier") || clean.includes("contractor") || clean.includes("security") || clean.includes("medical") || clean.includes("first aid") || clean.includes("toilet") || clean.includes("waste")) return "Service Provider";

  return "Other";
}

async function readJson(res: Response): Promise<ApiResponse> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : { ok: false, error: "Server returned an empty response." };
  } catch {
    return { ok: false, error: text || "Server returned invalid JSON." };
  }
}

export default function StallholdersCharitiesChecklistPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [years, setYears] = useState<EventYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear() + 1);
  const [newYear, setNewYear] = useState<string>(String(new Date().getFullYear() + 1));
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingContacts, setImportingContacts] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [checklistFilter, setChecklistFilter] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState("");
  const [deletingAll, setDeletingAll] = useState(false);
  const [yearLockDialogOpen, setYearLockDialogOpen] = useState(false);
  const [yearLockAction, setYearLockAction] = useState<"lock" | "unlock">("lock");
  const [mainAdminPassword, setMainAdminPassword] = useState("");
  const [yearActionLoading, setYearActionLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const selectedYearRecord = useMemo(
    () => years.find((year) => year.event_year === selectedYear) || null,
    [years, selectedYear]
  );

  const isYearLocked = Boolean(selectedYearRecord?.is_locked);

  function requireUnlockedYear() {
    if (!isYearLocked) return false;

    setNotice({
      type: "error",
      message: `The ${selectedYear} event year is locked. Unlock it with the main admin password before making changes.`,
    });

    return true;
  }

  async function loadYears(preferredYear?: number) {
    try {
      const res = await fetch(YEARS_API_ROUTE, {
        cache: "no-store",
        credentials: "include",
      });

      const data = (await readJson(res)) as YearsResponse;

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load event years.");
      }

      const loadedYears = [...(data.years || [])].sort(
        (a, b) => b.event_year - a.event_year
      );

      setYears(loadedYears);

      if (loadedYears.length > 0) {
        const preferred = preferredYear
          ? loadedYears.find((year) => year.event_year === preferredYear)
          : null;

        setSelectedYear((current) => {
          if (preferred) return preferred.event_year;
          if (loadedYears.some((year) => year.event_year === current)) return current;
          return loadedYears[0].event_year;
        });
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to load event years.",
      });
    }
  }

  async function createEventYear() {
    const eventYear = Number(newYear);

    if (!Number.isInteger(eventYear) || eventYear < 2024 || eventYear > 2100) {
      setNotice({ type: "error", message: "Please enter a valid event year." });
      return;
    }

    try {
      setYearActionLoading(true);
      setNotice(null);

      const res = await fetch(YEARS_API_ROUTE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_year: eventYear }),
      });

      const data = (await readJson(res)) as YearsResponse;

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to create event year.");
      }

      setNotice({ type: "success", message: `${eventYear} event year added.` });
      await loadYears(eventYear);
      setSelectedYear(eventYear);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to create event year.",
      });
    } finally {
      setYearActionLoading(false);
    }
  }

  function openYearLockDialog(action: "lock" | "unlock") {
    setYearLockAction(action);
    setMainAdminPassword("");
    setYearLockDialogOpen(true);
  }

  async function confirmYearLockAction() {
    if (!mainAdminPassword.trim()) {
      setNotice({ type: "error", message: "Please enter the main admin password." });
      return;
    }

    try {
      setYearActionLoading(true);
      setNotice(null);

      const res = await fetch(YEARS_API_ROUTE, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_year: selectedYear,
          action: yearLockAction,
          main_admin_password: mainAdminPassword,
        }),
      });

      const data = (await readJson(res)) as YearsResponse;

      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Failed to ${yearLockAction} event year.`);
      }

      setNotice({
        type: "success",
        message:
          yearLockAction === "lock"
            ? `${selectedYear} has been locked.`
            : `${selectedYear} has been unlocked.`,
      });

      setYearLockDialogOpen(false);
      setMainAdminPassword("");
      await loadYears(selectedYear);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : `Failed to ${yearLockAction} event year.`,
      });
    } finally {
      setYearActionLoading(false);
    }
  }

  async function loadContacts() {
    try {
      setLoading(true);
      setNotice(null);

      const res = await fetch(`${API_ROUTE}?event_year=${encodeURIComponent(selectedYear)}`, { cache: "no-store", credentials: "include" });
      const data = await readJson(res);

      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load checklist contacts.");
      setContacts(data.contacts || []);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to load checklist contacts.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadYears();
  }, []);

  useEffect(() => {
    loadContacts();
  }, [selectedYear]);

  const stats = useMemo(() => {
    const total = contacts.length;
    const sent = contacts.filter((item) => item.checklist_sent).length;
    const confirmed = contacts.filter((item) => item.checklist_confirmed).length;
    const missingPitch = contacts.filter((item) => !item.pitch_number).length;
    return { total, sent, confirmed, missingPitch };
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return contacts.filter((contact) => {
      const matchesSearch = !q ||
        contact.organisation_name.toLowerCase().includes(q) ||
        (contact.contact_name || "").toLowerCase().includes(q) ||
        (contact.email || "").toLowerCase().includes(q) ||
        (contact.phone || "").toLowerCase().includes(q) ||
        (contact.organisation_type || "").toLowerCase().includes(q) ||
        (contact.pitch_number || "").toLowerCase().includes(q) ||
        (contact.arrival_time || "").toLowerCase().includes(q) ||
        (contact.notes || "").toLowerCase().includes(q);

      const matchesType = !typeFilter || contact.organisation_type === typeFilter;

      const matchesChecklist =
        !checklistFilter ||
        (checklistFilter === "sent" && contact.checklist_sent) ||
        (checklistFilter === "not_sent" && !contact.checklist_sent) ||
        (checklistFilter === "confirmed" && contact.checklist_confirmed) ||
        (checklistFilter === "not_confirmed" && !contact.checklist_confirmed);

      return matchesSearch && matchesType && matchesChecklist;
    });
  }, [contacts, search, typeFilter, checklistFilter]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(contact: Contact) {
    setEditingId(contact.id);
    setForm({
      organisation_name: contact.organisation_name || "",
      contact_name: contact.contact_name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      organisation_type: contact.organisation_type || "Stallholder",
      pitch_number: contact.pitch_number || "",
      arrival_time: contact.arrival_time || "",
      checklist_sent: Boolean(contact.checklist_sent),
      checklist_confirmed: Boolean(contact.checklist_confirmed),
      notes: contact.notes || "",
      bring_gazebo: Boolean(contact.bring_gazebo),
      bring_gazebo_weights: Boolean(contact.bring_gazebo_weights),
      bring_table: Boolean(contact.bring_table),
      bring_chairs: Boolean(contact.bring_chairs),
      bring_display_materials: Boolean(contact.bring_display_materials),
      bring_leaflets: Boolean(contact.bring_leaflets),
      bring_stock: Boolean(contact.bring_stock),
      bring_donation_bucket: Boolean(contact.bring_donation_bucket),
      bring_card_reader: Boolean(contact.bring_card_reader),
      bring_cash_float: Boolean(contact.bring_cash_float),
      bring_tablecloth: Boolean(contact.bring_tablecloth),
      bring_signage: Boolean(contact.bring_signage),
      bring_weather_protection: Boolean(contact.bring_weather_protection),
      bring_waste_bags: Boolean(contact.bring_waste_bags),
      bring_activity_equipment: Boolean(contact.bring_activity_equipment),
      bring_pli_documents: Boolean(contact.bring_pli_documents),
      bring_approved_electricals: Boolean(contact.bring_approved_electricals),
      reminder_no_tables_chairs: Boolean(contact.reminder_no_tables_chairs),
      reminder_no_gazebos: Boolean(contact.reminder_no_gazebos),
      reminder_no_weights: Boolean(contact.reminder_no_weights),
      reminder_no_power: Boolean(contact.reminder_no_power),
      reminder_fit_pitch: Boolean(contact.reminder_fit_pitch),
      is_active: Boolean(contact.is_active),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveContact() {
    if (requireUnlockedYear()) return;

    try {
      setSaving(true);
      setNotice(null);

      if (!form.organisation_name.trim()) throw new Error("Please enter the organisation name.");

      const res = await fetch(API_ROUTE, {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId || undefined, event_year: selectedYear, ...form }),
      });

      const data = await readJson(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to save checklist contact.");

      setNotice({
        type: "success",
        message: editingId ? "Checklist contact updated successfully." : "Checklist contact added successfully.",
      });

      resetForm();
      await loadContacts();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to save checklist contact.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    if (requireUnlockedYear()) return;

    try {
      setSaving(true);
      setNotice(null);

      const res = await fetch(API_ROUTE, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteId }),
      });

      const data = await readJson(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to delete checklist contact.");

      if (editingId === deleteId) resetForm();
      setDeleteId(null);
      setNotice({ type: "success", message: "Checklist contact deleted successfully." });
      await loadContacts();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to delete checklist contact.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteAll() {
    if (requireUnlockedYear()) return;

    if (deleteAllConfirmText.trim() !== "DELETE ALL") {
      setNotice({
        type: "error",
        message: "To delete all checklist contacts, you must type DELETE ALL exactly.",
      });
      return;
    }

    if (contacts.length === 0) {
      setDeleteAllOpen(false);
      setDeleteAllConfirmText("");
      setNotice({ type: "error", message: "There are no checklist contacts to delete." });
      return;
    }

    try {
      setDeletingAll(true);
      setSaving(true);
      setNotice(null);

      for (const contact of contacts) {
        const res = await fetch(API_ROUTE, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: contact.id }),
        });

        const data = await readJson(res);

        if (!res.ok || !data.ok) {
          throw new Error(
            data.error || `Failed to delete ${contact.organisation_name || "a checklist contact"}.`
          );
        }
      }

      resetForm();
      setDeleteId(null);
      setDeleteAllOpen(false);
      setDeleteAllConfirmText("");

      setNotice({
        type: "success",
        message: `${contacts.length} checklist contact${contacts.length === 1 ? "" : "s"} deleted successfully.`,
      });

      await loadContacts();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to delete all checklist contacts.",
      });
    } finally {
      setDeletingAll(false);
      setSaving(false);
    }
  }

  async function handleCsvUpload(file: File) {
    if (requireUnlockedYear()) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      setImporting(true);
      setNotice(null);

      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) throw new Error("CSV must include a header row and at least one contact.");

      const headers = rows[0].map(normalizeHeader);
      const contactsToImport = rows.slice(1).map((row) => {
        const item: Record<string, string> = {};
        headers.forEach((header, index) => {
          item[header] = row[index] || "";
        });

        return {
          organisation_name: item.organisation_name || item.business_name || item.name || "",
          contact_name: item.contact_name || item.contact_person || "",
          email: item.email || item.email_address || "",
          phone: item.phone || item.phone_number || "",
          organisation_type: item.organisation_type || item.type || "Stallholder",
          pitch_number: item.pitch_number || item.pitch || "",
          arrival_time: item.arrival_time || item.arrival || "",
          checklist_sent: valueToBool(item.checklist_sent || ""),
          checklist_confirmed: valueToBool(item.checklist_confirmed || ""),
          notes: item.notes || "",
          event_year: selectedYear,
        };
      });

      const missing = contactsToImport.findIndex((item) => !item.organisation_name.trim());
      if (missing >= 0) throw new Error(`CSV row ${missing + 2} is missing an organisation name.`);

      const res = await fetch(API_ROUTE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: contactsToImport }),
      });

      const data = await readJson(res);
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to import CSV contacts.");

      setNotice({ type: "success", message: `${contactsToImport.length} checklist contacts imported successfully.` });
      await loadContacts();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to import CSV contacts.",
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function importFromContactApi() {
    if (requireUnlockedYear()) return;

    try {
      setImportingContacts(true);
      setNotice(null);

      const res = await fetch(CONTACTS_API_ROUTE, {
        cache: "no-store",
        credentials: "include",
      });

      const data = (await readJson(res)) as BusinessContactsResponse;

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load contacts from the Contacts page.");
      }

      const businessContacts = data.contacts || [];

      if (businessContacts.length === 0) {
        throw new Error("No contacts were found in the Contacts page to import.");
      }

      const existingKeys = new Set(
        contacts.map((contact) =>
          `${contact.organisation_name.trim().toLowerCase()}|${String(contact.email || "").trim().toLowerCase()}`
        )
      );

      const contactsToImport = businessContacts
        .filter((contact) => contact.is_active !== false)
        .map((contact) => ({
          organisation_name: contact.business_name || "",
          contact_name: contact.contact_name || "",
          email: contact.email || "",
          phone: contact.phone || "",
          organisation_type: mapServiceTypeToOrganisationType(contact.service_type),
          pitch_number: "",
          arrival_time: "",
          checklist_sent: false,
          checklist_confirmed: false,
          notes: [
            contact.service_type ? `Service type from Contacts page: ${contact.service_type}` : "",
            contact.address ? `Address: ${contact.address}` : "",
            contact.website ? `Website: ${contact.website}` : "",
            contact.notes || "",
          ]
            .filter(Boolean)
            .join("\\n"),
          event_year: selectedYear,
        }))
        .filter((contact) => {
          const key = `${contact.organisation_name.trim().toLowerCase()}|${String(contact.email || "").trim().toLowerCase()}`;
          return contact.organisation_name.trim() && !existingKeys.has(key);
        });

      if (contactsToImport.length === 0) {
        throw new Error("All active Contacts page records are already on this checklist, or they are missing organisation names.");
      }

      const saveRes = await fetch(API_ROUTE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: contactsToImport }),
      });

      const saveData = await readJson(saveRes);

      if (!saveRes.ok || !saveData.ok) {
        throw new Error(saveData.error || "Failed to import contacts into the checklist.");
      }

      setNotice({
        type: "success",
        message: `${contactsToImport.length} contact${contactsToImport.length === 1 ? "" : "s"} imported from the Contacts page.`,
      });

      await loadContacts();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to import contacts from the Contacts page.",
      });
    } finally {
      setImportingContacts(false);
    }
  }

  function downloadTemplate() {
    const headers = [
      "organisation_name",
      "contact_name",
      "email",
      "phone",
      "organisation_type",
      "pitch_number",
      "arrival_time",
      "checklist_sent",
      "checklist_confirmed",
      "notes",
    ];

    const example = [
      "Example Charity",
      "Jane Smith",
      "jane@example.org",
      "07123456789",
      "Charity",
      "C4",
      "10:40",
      "yes",
      "no",
      "Bring raffle table display",
    ];

    const csv = [headers, example].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "burton-pride-stallholders-checklist-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportContacts() {
    const headers = [
      "organisation_name",
      "contact_name",
      "email",
      "phone",
      "organisation_type",
      "pitch_number",
      "arrival_time",
      "checklist_sent",
      "checklist_confirmed",
      "notes",
    ];

    const csv = [
      headers,
      ...filteredContacts.map((contact) => [
        contact.organisation_name,
        contact.contact_name || "",
        contact.email || "",
        contact.phone || "",
        contact.organisation_type || "",
        contact.pitch_number || "",
        contact.arrival_time || "",
        contact.checklist_sent ? "yes" : "no",
        contact.checklist_confirmed ? "yes" : "no",
        contact.notes || "",
      ]),
    ].map((row) => row.map(csvEscape).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "burton-pride-stallholders-checklist-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.22),_transparent_32%),linear-gradient(180deg,#12091f_0%,#24113a_48%,#111827_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-6 rounded-[32px] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-pink-400/30 bg-pink-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-pink-100">
                <ClipboardCheck className="h-4 w-4" />
                Burton Pride Event Hub
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">Stallholders & Charities Checklist</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/70">
                Upload or add every stallholder, charity, vendor, community group, sponsor, or organisation coming to Burton Pride. Track pitch numbers, arrival times, contact details, and whether the checklist has been sent and confirmed.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/15">
                <Download className="h-4 w-4" /> Template
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing || isYearLocked} className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-3 text-sm font-bold text-sky-100 hover:bg-sky-500/20 disabled:opacity-60">
                <Upload className="h-4 w-4" /> {importing ? "Importing..." : "Upload CSV"}
              </button>
              <button type="button" onClick={importFromContactApi} disabled={importingContacts || isYearLocked} className="inline-flex items-center gap-2 rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 py-3 text-sm font-bold text-violet-100 hover:bg-violet-500/20 disabled:opacity-60">
                <Building2 className="h-4 w-4" /> {importingContacts ? "Importing contacts..." : "Import from Contacts"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteAllOpen(true);
                  setDeleteAllConfirmText("");
                }}
                disabled={loading || deletingAll || contacts.length === 0 || isYearLocked}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-600/20 px-4 py-3 text-sm font-black text-red-100 hover:bg-red-600/30 disabled:cursor-not-allowed disabled:opacity-50"
                title={contacts.length === 0 ? "No checklist contacts to delete" : "Delete every checklist contact"}
              >
                <Trash2 className="h-4 w-4" /> DELETE ALL
              </button>
              <button type="button" onClick={exportContacts} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100 hover:bg-emerald-500/20">
                <Download className="h-4 w-4" /> Export
              </button>
              <button type="button" onClick={loadContacts} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/15 disabled:opacity-60">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleCsvUpload(file); }} />
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-[32px] border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-sky-100">
                <CalendarDays className="h-4 w-4" />
                Event year controls
              </div>

              <h2 className="text-xl font-extrabold">
                {selectedYear} checklist {isYearLocked ? "is locked" : "is open"}
              </h2>

              <p className="mt-1 text-sm text-white/65">
                Add new years, switch between years, and lock finished years with the main admin password.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-[160px_160px_auto_auto]">
              <select
                value={selectedYear}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold outline-none"
              >
                {years.length === 0 ? (
                  <option value={selectedYear} className="bg-[#1f1030]">
                    {selectedYear}
                  </option>
                ) : (
                  years.map((year) => (
                    <option key={year.id} value={year.event_year} className="bg-[#1f1030]">
                      {year.event_year} {year.is_locked ? "- locked" : "- open"}
                    </option>
                  ))
                )}
              </select>

              <input
                value={newYear}
                onChange={(event) => setNewYear(event.target.value)}
                placeholder="Add year"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold outline-none placeholder:text-white/35"
              />

              <button
                type="button"
                onClick={createEventYear}
                disabled={yearActionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Add year
              </button>

              {isYearLocked ? (
                <button
                  type="button"
                  onClick={() => openYearLockDialog("unlock")}
                  disabled={yearActionLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-100 hover:bg-amber-500/20 disabled:opacity-60"
                >
                  <Unlock className="h-4 w-4" />
                  Unlock year
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openYearLockDialog("lock")}
                  disabled={yearActionLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100 hover:bg-red-500/20 disabled:opacity-60"
                >
                  <Lock className="h-4 w-4" />
                  Lock year
                </button>
              )}
            </div>
          </div>

          {isYearLocked && (
            <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm font-semibold leading-6 text-red-100">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-black">{selectedYear} is locked.</p>
                  <p className="mt-1 text-red-100/80">
                    Adding, editing, deleting, CSV uploads, importing from Contacts, DELETE ALL, and document changes are disabled until the year is unlocked with the main admin password.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {notice && (
          <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-semibold ${notice.type === "success" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-red-400/30 bg-red-500/10 text-red-100"}`}>
            {notice.message}
          </div>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <StatCard label="Total attending" value={stats.total} />
          <StatCard label="Checklist sent" value={stats.sent} />
          <StatCard label="Confirmed" value={stats.confirmed} />
          <StatCard label="Missing pitch" value={stats.missingPitch} warning />
        </div>

        <div className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <div className="rounded-[32px] border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
            <h2 className="mb-4 text-xl font-bold">{editingId ? "Edit organisation" : "Add organisation"}</h2>

            <div className="grid gap-4">
              <Input label="Organisation name" value={form.organisation_name} onChange={(value) => updateForm("organisation_name", value)} required />
              <Input label="Contact person" value={form.contact_name || ""} onChange={(value) => updateForm("contact_name", value)} />
              <Input label="Email" value={form.email || ""} onChange={(value) => updateForm("email", value)} />
              <Input label="Phone" value={form.phone || ""} onChange={(value) => updateForm("phone", value)} />

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/75">Organisation type</label>
                <select value={form.organisation_type || ""} onChange={(e) => updateForm("organisation_type", e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none">
                  {organisationTypes.map((type) => <option key={type} value={type} className="bg-[#1f1030]">{type}</option>)}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Pitch number" value={form.pitch_number || ""} onChange={(value) => updateForm("pitch_number", value)} />
                <Input label="Arrival time" value={form.arrival_time || ""} onChange={(value) => updateForm("arrival_time", value)} placeholder="10:40" />
              </div>

              <textarea value={form.notes || ""} onChange={(e) => updateForm("notes", e.target.value)} placeholder="Notes for this organisation" rows={4} className="resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35" />

              <div className="grid gap-3 sm:grid-cols-2">
                <CheckBox label="Checklist sent" checked={form.checklist_sent} onChange={(checked) => updateForm("checklist_sent", checked)} />
                <CheckBox label="Checklist confirmed" checked={form.checklist_confirmed} onChange={(checked) => updateForm("checklist_confirmed", checked)} />
                <CheckBox label="Active / attending" checked={form.is_active} onChange={(checked) => updateForm("is_active", checked)} />
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <h3 className="font-bold">They need to bring</h3>
                <div className="mt-3 grid gap-2">
                  {bringChecklist.map((item) => (
                    <CheckBox key={String(item.key)} label={item.label} checked={Boolean(form[item.key])} onChange={(checked) => updateForm(item.key, checked as never)} compact />
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-4">
                <h3 className="font-bold text-amber-100">Important Burton Pride reminders</h3>
                <div className="mt-3 grid gap-2">
                  {reminderChecklist.map((item) => (
                    <CheckBox key={String(item.key)} label={item.label} checked={Boolean(form[item.key])} onChange={(checked) => updateForm(item.key, checked as never)} compact />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={saveContact} disabled={saving || isYearLocked} className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black hover:opacity-90 disabled:opacity-60">
                  <Save className="h-4 w-4" /> {saving ? "Saving..." : editingId ? "Update" : "Add"}
                </button>
                <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white/10">
                  <X className="h-4 w-4" /> Clear
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
            <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-xl font-bold">Attending organisations</h2>
                <p className="mt-1 text-sm text-white/60">{filteredContacts.length} result{filteredContacts.length === 1 ? "" : "s"} found.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, type, pitch..." className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm outline-none placeholder:text-white/35" />
                </div>

                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none">
                  <option value="" className="bg-[#1f1030]">All types</option>
                  {organisationTypes.map((type) => <option key={type} value={type} className="bg-[#1f1030]">{type}</option>)}
                </select>

                <select value={checklistFilter} onChange={(e) => setChecklistFilter(e.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none">
                  <option value="" className="bg-[#1f1030]">All checklist status</option>
                  <option value="sent" className="bg-[#1f1030]">Sent</option>
                  <option value="not_sent" className="bg-[#1f1030]">Not sent</option>
                  <option value="confirmed" className="bg-[#1f1030]">Confirmed</option>
                  <option value="not_confirmed" className="bg-[#1f1030]">Not confirmed</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">Loading checklist contacts...</div>
            ) : filteredContacts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-center text-white/60">No organisations found yet.</div>
            ) : (
              <div className="grid gap-4">
                {filteredContacts.map((contact) => (
                  <ContactCard key={contact.id} contact={contact} locked={isYearLocked} onEdit={() => startEdit(contact)} onDelete={() => setDeleteId(contact.id)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {deleteId && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-[32px] border border-red-500/20 bg-[#1b1028] shadow-2xl">
              <div className="border-b border-white/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-red-500/15 p-3 text-red-200"><AlertTriangle className="h-6 w-6" /></div>
                  <div>
                    <h2 className="text-xl font-extrabold text-white">Delete checklist contact?</h2>
                    <p className="mt-1 text-sm text-white/60">This will permanently remove this organisation from the checklist.</p>
                  </div>
                </div>
              </div>
              <div className="p-6 text-sm text-white/75">Are you sure you want to delete this stallholder, charity, vendor, or organisation? This action cannot be undone.</div>
              <div className="flex justify-end gap-3 border-t border-white/10 p-6">
                <button type="button" onClick={() => setDeleteId(null)} disabled={saving} className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white/10 disabled:opacity-60">Cancel</button>
                <button type="button" onClick={confirmDelete} disabled={saving} className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold hover:bg-red-700 disabled:opacity-60">{saving ? "Deleting..." : "Delete contact"}</button>
              </div>
            </div>
          </div>
        )}

        {deleteAllOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-[32px] border border-red-500/30 bg-[#1b1028] shadow-2xl">
              <div className="border-b border-red-500/20 p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-red-500/20 p-3 text-red-100">
                    <AlertTriangle className="h-7 w-7" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">DELETE ALL checklist contacts?</h2>
                    <p className="mt-1 text-sm text-red-100/75">This will permanently delete every organisation currently in this checklist.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-6">
                <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
                  You are about to delete <span className="font-black text-white">{contacts.length}</span> checklist contact{contacts.length === 1 ? "" : "s"}. This includes all stallholders, charities, vendors, sponsors, and organisations saved on this page. This action cannot be undone.
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-white/80">
                    Type <span className="text-red-200">DELETE ALL</span> to confirm
                  </label>
                  <input
                    value={deleteAllConfirmText}
                    onChange={(event) => setDeleteAllConfirmText(event.target.value)}
                    placeholder="DELETE ALL"
                    className="w-full rounded-2xl border border-red-400/25 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/35"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 p-6 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteAllOpen(false);
                    setDeleteAllConfirmText("");
                  }}
                  disabled={deletingAll}
                  className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white/10 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmDeleteAll}
                  disabled={deletingAll || deleteAllConfirmText.trim() !== "DELETE ALL"}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {deletingAll ? "Deleting all..." : "DELETE ALL"}
                </button>
              </div>
            </div>
          </div>
        )}

        {yearLockDialogOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-[#1b1028] shadow-2xl">
              <div className="border-b border-white/10 p-6">
                <div className="flex items-center gap-3">
                  <div className={yearLockAction === "lock" ? "rounded-2xl bg-red-500/20 p-3 text-red-100" : "rounded-2xl bg-amber-500/20 p-3 text-amber-100"}>
                    {yearLockAction === "lock" ? <Lock className="h-7 w-7" /> : <Unlock className="h-7 w-7" />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">
                      {yearLockAction === "lock" ? "Lock" : "Unlock"} {selectedYear} event year?
                    </h2>
                    <p className="mt-1 text-sm text-white/65">
                      This action requires the main admin password.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-6">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/75">
                  {yearLockAction === "lock"
                    ? "Locking this year will stop all changes for this year, including adding contacts, editing records, deleting records, uploads, imports, DELETE ALL, and document changes."
                    : "Unlocking this year will allow admins to make changes to contacts, checklist records, uploads, imports, and documents again."}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-white/80">
                    Main admin password
                  </label>
                  <input
                    type="password"
                    value={mainAdminPassword}
                    onChange={(event) => setMainAdminPassword(event.target.value)}
                    placeholder="Enter main admin password"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/35"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 p-6 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setYearLockDialogOpen(false);
                    setMainAdminPassword("");
                  }}
                  disabled={yearActionLoading}
                  className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white/10 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmYearLockAction}
                  disabled={yearActionLoading || !mainAdminPassword.trim()}
                  className={yearLockAction === "lock" ? "inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50" : "inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"}
                >
                  {yearLockAction === "lock" ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  {yearActionLoading
                    ? yearLockAction === "lock"
                      ? "Locking..."
                      : "Unlocking..."
                    : yearLockAction === "lock"
                    ? "Lock year"
                    : "Unlock year"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <div className={`rounded-3xl border p-5 ${warning ? "border-amber-400/20 bg-amber-500/10" : "border-white/10 bg-white/10"}`}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">{label}</p>
      <p className="mt-2 text-3xl font-extrabold">{value}</p>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-white/75">{label}{required ? <span className="text-red-300"> *</span> : null}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || label} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35" />
    </div>
  );
}

function CheckBox({ label, checked, onChange, compact = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; compact?: boolean }) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/20 ${compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-white/85">{label}</span>
    </label>
  );
}

function ContactCard({ contact, locked = false, onEdit, onDelete }: { contact: Contact; locked?: boolean; onEdit: () => void; onDelete: () => void }) {
  const completed = [contact.checklist_sent, contact.checklist_confirmed].filter(Boolean).length;

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold">{contact.organisation_name}</h3>
            {contact.organisation_type && <span className="rounded-full border border-pink-400/20 bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-100">{contact.organisation_type}</span>}
            {contact.pitch_number && <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-100">Pitch {contact.pitch_number}</span>}
            {contact.arrival_time && <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-100">Arrival {contact.arrival_time}</span>}
            {contact.checklist_sent ? <Status good label="Checklist sent" /> : <Status label="Not sent" />}
            {contact.checklist_confirmed ? <Status good label="Confirmed" /> : <Status label="Not confirmed" />}
          </div>

          <div className="mt-3 grid gap-2 text-sm text-white/70">
            {contact.contact_name && <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-white/40" />Contact: {contact.contact_name}</div>}
            {contact.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-white/40" /><a href={`mailto:${contact.email}`} className="break-all hover:text-white">{contact.email}</a></div>}
            {contact.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-white/40" /><a href={`tel:${contact.phone}`} className="hover:text-white">{contact.phone}</a></div>}
            {contact.pitch_number && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-white/40" />Pitch: {contact.pitch_number}</div>}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-bold">Checklist progress: {completed}/2</p>
            <p className="mt-1 text-xs text-white/60">Track whether the checklist has been sent and confirmed before event day.</p>
          </div>

          {contact.notes && <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">{contact.notes}</div>}
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onEdit} disabled={locked} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"><Edit className="h-4 w-4" /> Edit</button>
          <button type="button" onClick={onDelete} disabled={locked} className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="h-4 w-4" /> Delete</button>
        </div>
      </div>
    </div>
  );
}

function Status({ label, good = false }: { label: string; good?: boolean }) {
  return good ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100"><CheckCircle2 className="h-3.5 w-3.5" /> {label}</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100"><AlertTriangle className="h-3.5 w-3.5" /> {label}</span>
  );
}
