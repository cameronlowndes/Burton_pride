"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx-js-style";
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
  docs_public_liability_insurance: boolean;
  docs_risk_assessment: boolean;
  food_hygiene_certificate: boolean;
  food_hygiene_rating_checked: boolean;
  gas_safety_certificate: boolean;
  generator_safety_certificate: boolean;
  pat_testing_certificate: boolean;
  fire_risk_assessment: boolean;
  first_aid_arrangements: boolean;
  dbs_checked: boolean;
  food_registration_verified: boolean;
  hand_washing_facilities: boolean;
  waste_disposal_plan: boolean;
  temperature_control: boolean;
  allergen_information: boolean;
  fire_extinguisher: boolean;
  fire_blanket: boolean;
  gas_bottle_secured: boolean;
  electrical_outdoor_leads: boolean;
  rcd_protection: boolean;
  generator_fuel_safe: boolean;
  generator_positioned_safe: boolean;
  cable_ramps: boolean;
  vehicle_registration_received: boolean;
  vehicle_pass_issued: boolean;
  loading_instructions_sent: boolean;
  arrival_completed: boolean;
  vehicle_removed: boolean;
  invoice_sent: boolean;
  payment_received: boolean;
  terms_accepted: boolean;
  privacy_policy_accepted: boolean;
  emergency_contact_recorded: boolean;
  signed_in: boolean;
  pitch_inspected: boolean;
  trading_started: boolean;
  safety_inspection_completed: boolean;
  trading_finished: boolean;
  site_left_clean: boolean;
  signed_out: boolean;
  committee_pli_verified: boolean;
  committee_risk_assessment_approved: boolean;
  committee_food_hygiene_verified: boolean;
  committee_gas_certificate_verified: boolean;
  committee_generator_certificate_verified: boolean;
  committee_pat_verified: boolean;
  committee_fire_equipment_checked: boolean;
  committee_pitch_inspected: boolean;
  committee_compliance_passed: boolean;
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
  docs_public_liability_insurance: false,
  docs_risk_assessment: false,
  food_hygiene_certificate: false,
  food_hygiene_rating_checked: false,
  gas_safety_certificate: false,
  generator_safety_certificate: false,
  pat_testing_certificate: false,
  fire_risk_assessment: false,
  first_aid_arrangements: false,
  dbs_checked: false,
  food_registration_verified: false,
  hand_washing_facilities: false,
  waste_disposal_plan: false,
  temperature_control: false,
  allergen_information: false,
  fire_extinguisher: false,
  fire_blanket: false,
  gas_bottle_secured: false,
  electrical_outdoor_leads: false,
  rcd_protection: false,
  generator_fuel_safe: false,
  generator_positioned_safe: false,
  cable_ramps: false,
  vehicle_registration_received: false,
  vehicle_pass_issued: false,
  loading_instructions_sent: false,
  arrival_completed: false,
  vehicle_removed: false,
  invoice_sent: false,
  payment_received: false,
  terms_accepted: false,
  privacy_policy_accepted: false,
  emergency_contact_recorded: false,
  signed_in: false,
  pitch_inspected: false,
  trading_started: false,
  safety_inspection_completed: false,
  trading_finished: false,
  site_left_clean: false,
  signed_out: false,
  committee_pli_verified: false,
  committee_risk_assessment_approved: false,
  committee_food_hygiene_verified: false,
  committee_gas_certificate_verified: false,
  committee_generator_certificate_verified: false,
  committee_pat_verified: false,
  committee_fire_equipment_checked: false,
  committee_pitch_inspected: false,
  committee_compliance_passed: false,
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

type ChecklistSection = {
  title: string;
  description: string;
  items: Array<{ key: keyof FormState; label: string }>;
};

const safetyChecklistSections: ChecklistSection[] = [
  {
    title: "Required documents",
    description: "Use this for legal, insurance, and safety paperwork before the event.",
    items: [
      { key: "docs_public_liability_insurance", label: "Public Liability Insurance received" },
      { key: "docs_risk_assessment", label: "Risk Assessment received" },
      { key: "food_hygiene_certificate", label: "Food Hygiene Certificate received" },
      { key: "food_hygiene_rating_checked", label: "Food Hygiene Rating checked" },
      { key: "gas_safety_certificate", label: "Gas Safety Certificate received, if using LPG" },
      { key: "generator_safety_certificate", label: "Generator safety certificate received, if using generator" },
      { key: "pat_testing_certificate", label: "PAT testing / electrical certificate received" },
      { key: "fire_risk_assessment", label: "Fire Risk Assessment received, where required" },
      { key: "first_aid_arrangements", label: "First aid arrangements confirmed, if applicable" },
      { key: "dbs_checked", label: "DBS checked, where applicable" },
    ],
  },
  {
    title: "Food vendor safety",
    description: "Use this for food, drink, cakes, ice cream, and any stall handling consumables.",
    items: [
      { key: "food_registration_verified", label: "Food business registration verified" },
      { key: "hand_washing_facilities", label: "Hand washing facilities confirmed" },
      { key: "waste_disposal_plan", label: "Waste disposal plan confirmed" },
      { key: "temperature_control", label: "Temperature control equipment confirmed" },
      { key: "allergen_information", label: "Allergen information available" },
      { key: "fire_extinguisher", label: "Fire extinguisher confirmed" },
      { key: "fire_blanket", label: "Fire blanket confirmed" },
      { key: "gas_bottle_secured", label: "Gas bottle secured correctly" },
    ],
  },
  {
    title: "Electrical, gas & generators",
    description: "Use this for any power, LPG, electrical kit, lights, fridges, generators, or cables.",
    items: [
      { key: "electrical_outdoor_leads", label: "Outdoor-safe extension leads confirmed" },
      { key: "rcd_protection", label: "RCD protection confirmed" },
      { key: "generator_fuel_safe", label: "Generator fuel storage confirmed safe" },
      { key: "generator_positioned_safe", label: "Generator position confirmed safe" },
      { key: "cable_ramps", label: "Cable ramps / cable protection confirmed" },
    ],
  },
  {
    title: "Vehicle and arrival checks",
    description: "Use this to manage arrival, unloading, vehicle movement, and safe setup.",
    items: [
      { key: "vehicle_registration_received", label: "Vehicle registration received" },
      { key: "vehicle_pass_issued", label: "Vehicle pass issued" },
      { key: "loading_instructions_sent", label: "Loading / unloading instructions sent" },
      { key: "arrival_completed", label: "Arrival completed" },
      { key: "vehicle_removed", label: "Vehicle removed from site" },
    ],
  },
  {
    title: "Administration",
    description: "Use this for finance, consent, terms, and emergency contact information.",
    items: [
      { key: "invoice_sent", label: "Invoice sent" },
      { key: "payment_received", label: "Payment received" },
      { key: "terms_accepted", label: "Terms and Conditions accepted" },
      { key: "privacy_policy_accepted", label: "Privacy Policy accepted" },
      { key: "emergency_contact_recorded", label: "Emergency contact recorded" },
    ],
  },
  {
    title: "Event day",
    description: "Use this on the day for sign in, pitch checks, trading, and leaving site clean.",
    items: [
      { key: "signed_in", label: "Signed in" },
      { key: "pitch_inspected", label: "Pitch inspected" },
      { key: "trading_started", label: "Trading / setup started" },
      { key: "safety_inspection_completed", label: "Safety inspection completed" },
      { key: "trading_finished", label: "Trading finished" },
      { key: "site_left_clean", label: "Site left clean" },
      { key: "signed_out", label: "Signed out" },
    ],
  },
  {
    title: "Burton Pride committee verification",
    description: "These are the final committee checks before they are marked as compliant.",
    items: [
      { key: "committee_pli_verified", label: "PLI verified by committee" },
      { key: "committee_risk_assessment_approved", label: "Risk Assessment approved by committee" },
      { key: "committee_food_hygiene_verified", label: "Food Hygiene verified by committee" },
      { key: "committee_gas_certificate_verified", label: "Gas certificate verified by committee" },
      { key: "committee_generator_certificate_verified", label: "Generator certificate verified by committee" },
      { key: "committee_pat_verified", label: "PAT / electrical certificates verified by committee" },
      { key: "committee_fire_equipment_checked", label: "Fire equipment checked by committee" },
      { key: "committee_pitch_inspected", label: "Pitch inspected by committee" },
      { key: "committee_compliance_passed", label: "Compliance passed" },
    ],
  },
];

const requiredByType: Record<string, Array<keyof FormState>> = {
  Stallholder: ["docs_public_liability_insurance"],
  Charity: ["docs_public_liability_insurance"],
  Vendor: ["docs_public_liability_insurance"],
  "Food Vendor": ["docs_public_liability_insurance"],
  Entertainment: ["docs_public_liability_insurance"],
  "Service Provider": ["docs_public_liability_insurance"],
  "Community Group": ["docs_public_liability_insurance"],
  Sponsor: ["docs_public_liability_insurance"],
  Partner: ["docs_public_liability_insurance"],
  Other: ["docs_public_liability_insurance"],
};

function getLabelForChecklistKey(key: keyof FormState) {
  for (const section of safetyChecklistSections) {
    const found = section.items.find((item) => item.key === key);
    if (found) return found.label;
  }
  const bringFound = bringChecklist.find((item) => item.key === key);
  return bringFound?.label || String(key).replace(/_/g, " ");
}

function getRequiredKeysForType(type: string | null | undefined) {
  return requiredByType[String(type || "")] || requiredByType.Stallholder;
}

const reminderChecklist: Array<{ key: keyof FormState; label: string }> = [
  { key: "reminder_no_tables_chairs", label: "Burton Pride does not provide tables or chairs." },
  { key: "reminder_no_gazebos", label: "Burton Pride does not provide gazebos." },
  { key: "reminder_no_weights", label: "Burton Pride does not provide gazebo weights." },
  { key: "reminder_no_power", label: "Burton Pride does not provide power unless separately agreed in writing." },
  { key: "reminder_fit_pitch", label: "Everything must fit inside their allocated pitch." },
];

function valueToBool(value: unknown) {
  const clean = String(value ?? "").trim().toLowerCase();
  return ["yes", "true", "1", "y", "sent", "confirmed", "active", "completed", "done"].includes(clean);
}

const booleanChecklistKeys = Object.keys(emptyForm).filter(
  (key) => typeof emptyForm[key as keyof FormState] === "boolean"
) as Array<keyof FormState>;

const booleanChecklistKeySet = new Set<keyof FormState>(booleanChecklistKeys);

const excelColumns: Array<{ key: keyof FormState; header: string; example?: string }> = [
  { key: "organisation_name", header: "Organisation name", example: "Example Charity" },
  { key: "contact_name", header: "Contact person", example: "Jane Smith" },
  { key: "email", header: "Email", example: "jane@example.org" },
  { key: "phone", header: "Phone", example: "07123456789" },
  { key: "organisation_type", header: "Organisation type", example: "Charity" },
  { key: "pitch_number", header: "Pitch number", example: "C4" },
  { key: "arrival_time", header: "Arrival time", example: "10:40" },
  { key: "checklist_sent", header: "Checklist sent", example: "no" },
  { key: "checklist_confirmed", header: "Checklist confirmed", example: "no" },
  { key: "notes", header: "Notes", example: "Bring raffle table display" },
  { key: "bring_gazebo", header: "Bring gazebo" },
  { key: "bring_gazebo_weights", header: "Bring gazebo weights" },
  { key: "bring_table", header: "Bring table" },
  { key: "bring_chairs", header: "Bring chairs" },
  { key: "bring_display_materials", header: "Bring display materials" },
  { key: "bring_leaflets", header: "Bring leaflets" },
  { key: "bring_stock", header: "Bring stock" },
  { key: "bring_donation_bucket", header: "Bring donation bucket" },
  { key: "bring_card_reader", header: "Bring card reader" },
  { key: "bring_cash_float", header: "Bring cash float" },
  { key: "bring_tablecloth", header: "Bring tablecloth" },
  { key: "bring_signage", header: "Bring signage" },
  { key: "bring_weather_protection", header: "Bring weather protection" },
  { key: "bring_waste_bags", header: "Bring waste bags" },
  { key: "bring_activity_equipment", header: "Bring activity equipment" },
  { key: "bring_pli_documents", header: "Bring PLI documents" },
  { key: "bring_approved_electricals", header: "Bring approved electricals" },
  { key: "docs_public_liability_insurance", header: "Public Liability Insurance received" },
  { key: "docs_risk_assessment", header: "Risk Assessment received" },
  { key: "food_hygiene_certificate", header: "Food Hygiene Certificate received" },
  { key: "food_hygiene_rating_checked", header: "Food Hygiene Rating checked" },
  { key: "gas_safety_certificate", header: "Gas Safety Certificate received" },
  { key: "generator_safety_certificate", header: "Generator safety certificate received" },
  { key: "pat_testing_certificate", header: "PAT testing certificate received" },
  { key: "fire_risk_assessment", header: "Fire Risk Assessment received" },
  { key: "first_aid_arrangements", header: "First aid arrangements confirmed" },
  { key: "dbs_checked", header: "DBS checked" },
  { key: "food_registration_verified", header: "Food registration verified" },
  { key: "hand_washing_facilities", header: "Hand washing facilities confirmed" },
  { key: "waste_disposal_plan", header: "Waste disposal plan confirmed" },
  { key: "temperature_control", header: "Temperature control confirmed" },
  { key: "allergen_information", header: "Allergen information available" },
  { key: "fire_extinguisher", header: "Fire extinguisher confirmed" },
  { key: "fire_blanket", header: "Fire blanket confirmed" },
  { key: "gas_bottle_secured", header: "Gas bottle secured" },
  { key: "electrical_outdoor_leads", header: "Outdoor electrical leads confirmed" },
  { key: "rcd_protection", header: "RCD protection confirmed" },
  { key: "generator_fuel_safe", header: "Generator fuel safe" },
  { key: "generator_positioned_safe", header: "Generator positioned safely" },
  { key: "cable_ramps", header: "Cable ramps confirmed" },
  { key: "vehicle_registration_received", header: "Vehicle registration received" },
  { key: "vehicle_pass_issued", header: "Vehicle pass issued" },
  { key: "loading_instructions_sent", header: "Loading instructions sent" },
  { key: "arrival_completed", header: "Arrival completed" },
  { key: "vehicle_removed", header: "Vehicle removed from site" },
  { key: "invoice_sent", header: "Invoice sent" },
  { key: "payment_received", header: "Payment received" },
  { key: "terms_accepted", header: "Terms accepted" },
  { key: "privacy_policy_accepted", header: "Privacy Policy accepted" },
  { key: "emergency_contact_recorded", header: "Emergency contact recorded" },
  { key: "signed_in", header: "Signed in" },
  { key: "pitch_inspected", header: "Pitch inspected" },
  { key: "trading_started", header: "Trading started" },
  { key: "safety_inspection_completed", header: "Safety inspection completed" },
  { key: "trading_finished", header: "Trading finished" },
  { key: "site_left_clean", header: "Site left clean" },
  { key: "signed_out", header: "Signed out" },
  { key: "committee_pli_verified", header: "Committee PLI verified" },
  { key: "committee_risk_assessment_approved", header: "Committee Risk Assessment approved" },
  { key: "committee_food_hygiene_verified", header: "Committee Food Hygiene verified" },
  { key: "committee_gas_certificate_verified", header: "Committee gas certificate verified" },
  { key: "committee_generator_certificate_verified", header: "Committee generator certificate verified" },
  { key: "committee_pat_verified", header: "Committee PAT verified" },
  { key: "committee_fire_equipment_checked", header: "Committee fire equipment checked" },
  { key: "committee_pitch_inspected", header: "Committee pitch inspected" },
  { key: "committee_compliance_passed", header: "Committee compliance passed" },
  { key: "reminder_no_tables_chairs", header: "Reminder no tables/chairs" },
  { key: "reminder_no_gazebos", header: "Reminder no gazebos" },
  { key: "reminder_no_weights", header: "Reminder no weights" },
  { key: "reminder_no_power", header: "Reminder no power" },
  { key: "reminder_fit_pitch", header: "Reminder fit inside pitch" },
  { key: "is_active", header: "Active / attending", example: "yes" },
];

function toExcelCell(value: unknown) {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (value === null || value === undefined) return "";
  return String(value);
}

function getExcelColumnLetter(index: number) {
  let letter = "";
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    current = Math.floor((current - 1) / 26);
  }

  return letter;
}

function styleWorksheet(worksheet: XLSX.WorkSheet, rows: unknown[][]) {
  const headerCount = rows[0]?.length || 0;
  const rowCount = rows.length;

  worksheet["!cols"] = rows[0]?.map((header, index) => {
    const maxCellLength = rows.reduce((max, row) => {
      const value = String(row[index] ?? "");
      return Math.max(max, value.length);
    }, String(header || "").length);

    return {
      wch: Math.max(14, Math.min(48, maxCellLength + 4)),
    };
  });

  if (headerCount > 0 && rowCount > 0) {
    worksheet["!autofilter"] = {
      ref: `A1:${getExcelColumnLetter(headerCount - 1)}${rowCount}`,
    };
  }

  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 } as never;

  for (let columnIndex = 0; columnIndex < headerCount; columnIndex += 1) {
    const address = `${getExcelColumnLetter(columnIndex)}1`;
    const cell = worksheet[address] as XLSX.CellObject & { s?: unknown } | undefined;
    if (!cell) continue;

    cell.s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "7C2D6F" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "C084FC" } },
        bottom: { style: "thin", color: { rgb: "C084FC" } },
        left: { style: "thin", color: { rgb: "C084FC" } },
        right: { style: "thin", color: { rgb: "C084FC" } },
      },
    };
  }

  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
  for (let rowIndex = 1; rowIndex <= range.e.r; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex <= range.e.c; columnIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = worksheet[address] as XLSX.CellObject & { s?: unknown } | undefined;
      if (!cell) continue;

      cell.s = {
        alignment: { vertical: "top", wrapText: true },
        fill: { fgColor: { rgb: rowIndex % 2 === 0 ? "F8E8F5" : "FFFFFF" } },
        border: {
          bottom: { style: "thin", color: { rgb: "E9D5FF" } },
        },
      };
    }
  }
}

function downloadXlsx(filename: string, rows: unknown[][], sheetName = "Checklist") {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  styleWorksheet(worksheet, rows);

  workbook.Props = {
    Title: "Burton Pride Event Hub Checklist",
    Subject: "Stallholders and charities checklist",
    Author: "Burton Pride C.I.C.",
    Company: "Burton Pride C.I.C.",
    CreatedDate: new Date(),
  };

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, filename, { compression: true });
}

function getXlsxRowsFromWorksheet(worksheet: XLSX.WorkSheet) {
  return (XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][])
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => row.some(Boolean));
}

function getImportedValue(item: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const normalisedKey = normalizeHeader(key);
    const value = item[normalisedKey];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
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


type WorkbookStats = {
  total: number;
  sent: number;
  confirmed: number;
  missingPitch: number;
};

const BP_XLSX_COLOURS = {
  purple: "4C1D5B",
  darkPurple: "2A1238",
  pink: "DB2777",
  orange: "F97316",
  amber: "F59E0B",
  green: "16A34A",
  red: "DC2626",
  blue: "2563EB",
  grey: "374151",
  white: "FFFFFF",
  lightPink: "FCE7F3",
  lightAmber: "FEF3C7",
  lightGreen: "DCFCE7",
  lightBlue: "DBEAFE",
  lightGrey: "F3F4F6",
  lightPurple: "F3E8FF",
};

function bpText(value: unknown) {
  return String(value ?? "").trim();
}

function bpYesNo(value: unknown) {
  return value ? "✅ Yes" : "❌ No";
}

function bpSetCellStyle(ws: XLSX.WorkSheet, cellAddress: string, style: unknown) {
  const cell = ws[cellAddress] as (XLSX.CellObject & { s?: unknown }) | undefined;
  if (!cell) return;
  cell.s = { ...((cell.s as Record<string, unknown>) || {}), ...(style as Record<string, unknown>) };
}

function bpSheetRange(ws: XLSX.WorkSheet) {
  return XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
}

function bpStyleHeaderRow(ws: XLSX.WorkSheet, rowNumber = 1, colour = BP_XLSX_COLOURS.darkPurple) {
  const range = bpSheetRange(ws);
  const rowIndex = rowNumber - 1;

  for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
    const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });

    bpSetCellStyle(ws, address, {
      font: { bold: true, color: { rgb: BP_XLSX_COLOURS.white } },
      fill: { fgColor: { rgb: colour } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "C084FC" } },
        bottom: { style: "thin", color: { rgb: "C084FC" } },
        left: { style: "thin", color: { rgb: "C084FC" } },
        right: { style: "thin", color: { rgb: "C084FC" } },
      },
    });
  }
}

function bpFinishSheet(ws: XLSX.WorkSheet, columnWidths: number[], freezeRef = "A2") {
  ws["!cols"] = columnWidths.map((width) => ({ wch: width }));

  const ref = ws["!ref"];
  if (ref) ws["!autofilter"] = { ref };

  // Supported by xlsx-js-style/SheetJS-compatible writers where available.
  ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: freezeRef } as never;

  const range = bpSheetRange(ws);
  for (let rowIndex = 1; rowIndex <= range.e.r; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex <= range.e.c; columnIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const fill = rowIndex % 2 === 0 ? BP_XLSX_COLOURS.lightPurple : BP_XLSX_COLOURS.white;

      bpSetCellStyle(ws, address, {
        alignment: { vertical: "top", wrapText: true },
        fill: { fgColor: { rgb: fill } },
        border: {
          bottom: { style: "thin", color: { rgb: "E9D5FF" } },
        },
      });
    }
  }
}

function bpRequiredMissing(contact: Contact) {
  return getRequiredKeysForType(contact.organisation_type).filter((key) => !Boolean(contact[key as keyof Contact]));
}

function bpMissingRequiredLabels(contact: Contact) {
  return bpRequiredMissing(contact).map((key) => getLabelForChecklistKey(key));
}

function bpCompletionPercent(contact: Contact) {
  const keys = getRequiredKeysForType(contact.organisation_type);
  if (keys.length === 0) return 100;
  const complete = keys.filter((key) => Boolean(contact[key as keyof Contact])).length;
  return Math.round((complete / keys.length) * 100);
}

function bpStatus(contact: Contact) {
  const missing = bpMissingRequiredLabels(contact);
  if (missing.length === 0 && contact.committee_compliance_passed) return "🟢 Ready";
  if (missing.length === 0) return "🟡 Waiting committee sign-off";
  return "🔴 Missing PLI";
}

function bpGroupedContacts(contactsToUse: Contact[]) {
  const order = [
    "Food Vendor",
    "Vendor",
    "Charity",
    "Entertainment",
    "Community Group",
    "Sponsor",
    "Partner",
    "Service Provider",
    "Stallholder",
    "Other",
  ];

  return [...contactsToUse].sort((a, b) => {
    const aIndex = order.indexOf(bpText(a.organisation_type));
    const bIndex = order.indexOf(bpText(b.organisation_type));
    const safeA = aIndex === -1 ? 999 : aIndex;
    const safeB = bIndex === -1 ? 999 : bIndex;
    if (safeA !== safeB) return safeA - safeB;
    return bpText(a.organisation_name).localeCompare(bpText(b.organisation_name));
  });
}

function bpBuildDashboardSheet(eventYear: number | string, contactsToUse: Contact[], sheetStats: WorkbookStats) {
  const foodVendors = contactsToUse.filter((contact) => bpText(contact.organisation_type).toLowerCase().includes("food")).length;
  const missingDocs = contactsToUse.filter((contact) => bpMissingRequiredLabels(contact).length > 0).length;
  const ready = contactsToUse.filter((contact) => bpMissingRequiredLabels(contact).length === 0 && contact.committee_compliance_passed).length;
  const waiting = contactsToUse.filter((contact) => bpMissingRequiredLabels(contact).length === 0 && !contact.committee_compliance_passed).length;

  const rows: unknown[][] = [
    [`BURTON PRIDE ${eventYear} - EVENT CHECKLIST`],
    ["Generated", new Date().toLocaleString()],
    ["Confidential", "Generated automatically from Burton Pride Event Hub"],
    [],
    ["Dashboard", "Count"],
    ["Total organisations", sheetStats.total],
    ["Ready for event", ready],
    ["Waiting committee sign-off", waiting],
    ["Missing PLI", missingDocs],
    ["Food vendors", foodVendors],
    ["Checklist sent", sheetStats.sent],
    ["Checklist confirmed", sheetStats.confirmed],
    ["Missing pitch", sheetStats.missingPitch],
    [],
    ["Important", "This workbook is confidential and for Burton Pride C.I.C. committee use only."],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = [XLSX.utils.decode_range("A1:F1")];
  ws["!rows"] = [{ hpt: 34 }, {}, {}, {}, { hpt: 24 }];
  ws["!cols"] = [{ wch: 34 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];

  bpSetCellStyle(ws, "A1", {
    font: { bold: true, sz: 22, color: { rgb: BP_XLSX_COLOURS.white } },
    fill: { fgColor: { rgb: BP_XLSX_COLOURS.purple } },
    alignment: { horizontal: "center", vertical: "center" },
  });
  bpStyleHeaderRow(ws, 5, BP_XLSX_COLOURS.pink);

  [6, 7, 8, 9, 10, 11, 12, 13].forEach((row) => {
    const fill = row === 7 ? BP_XLSX_COLOURS.lightGreen : row === 9 || row === 13 ? BP_XLSX_COLOURS.lightAmber : BP_XLSX_COLOURS.lightGrey;
    bpSetCellStyle(ws, `A${row}`, { font: { bold: true }, fill: { fgColor: { rgb: fill } } });
    bpSetCellStyle(ws, `B${row}`, { font: { bold: true, sz: 14 }, fill: { fgColor: { rgb: fill } }, alignment: { horizontal: "center" } });
  });

  return ws;
}

function bpBuildOrganisationsSheet(contactsToUse: Contact[]) {
  const rows: unknown[][] = [
    ["✔", "Organisation", "Type", "Contact", "Email", "Phone", "Pitch", "Arrival", "Progress", "Status", "Missing PLI", "Notes"],
    ...bpGroupedContacts(contactsToUse).map((contact) => [
      contact.committee_compliance_passed ? "✅" : "",
      contact.organisation_name || "",
      contact.organisation_type || "",
      contact.contact_name || "",
      contact.email || "",
      contact.phone || "",
      contact.pitch_number || "",
      contact.arrival_time || "",
      `${bpCompletionPercent(contact)}%`,
      bpStatus(contact),
      bpMissingRequiredLabels(contact).join(", ") || "Complete",
      contact.notes || "",
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  bpStyleHeaderRow(ws, 1);
  bpFinishSheet(ws, [6, 30, 18, 22, 34, 16, 12, 12, 12, 28, 48, 45]);
  return ws;
}

function bpBuildFoodVendorsSheet(contactsToUse: Contact[]) {
  const foodVendors = contactsToUse.filter((contact) => bpText(contact.organisation_type).toLowerCase().includes("food"));
  const rows: unknown[][] = [
    ["Food Vendor", "Contact", "Email", "Phone", "Pitch", "Arrival", "Food Hygiene", "Rating", "Registration", "Hand Washing", "Allergens", "Gas", "Generator", "Fire Extinguisher", "Fire Blanket", "Ready"],
    ...foodVendors.map((contact) => [
      contact.organisation_name || "",
      contact.contact_name || "",
      contact.email || "",
      contact.phone || "",
      contact.pitch_number || "",
      contact.arrival_time || "",
      bpYesNo(contact.food_hygiene_certificate),
      bpYesNo(contact.food_hygiene_rating_checked),
      bpYesNo(contact.food_registration_verified),
      bpYesNo(contact.hand_washing_facilities),
      bpYesNo(contact.allergen_information),
      bpYesNo(contact.gas_safety_certificate),
      bpYesNo(contact.generator_safety_certificate),
      bpYesNo(contact.fire_extinguisher),
      bpYesNo(contact.fire_blanket),
      bpMissingRequiredLabels(contact).length === 0 ? "✅ Ready" : "❌ Missing",
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  bpStyleHeaderRow(ws, 1, BP_XLSX_COLOURS.orange);
  bpFinishSheet(ws, [28, 20, 32, 16, 12, 12, 18, 14, 18, 18, 16, 14, 16, 18, 16, 14]);
  return ws;
}

function bpBuildMissingDocumentsSheet(contactsToUse: Contact[]) {
  const rows: unknown[][] = [["Organisation", "Type", "Contact", "Email", "Missing", "Priority"]];

  contactsToUse.forEach((contact) => {
    const missing = bpMissingRequiredLabels(contact);
    missing.forEach((item) => {
      rows.push([
        contact.organisation_name || "",
        contact.organisation_type || "",
        contact.contact_name || "",
        contact.email || "",
        item,
        item.includes("Public Liability") || item.includes("Risk") ? "High" : "Medium",
      ]);
    });
  });

  if (rows.length === 1) {
    rows.push(["No missing required checks", "", "", "", "Complete", "Low"]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  bpStyleHeaderRow(ws, 1, BP_XLSX_COLOURS.red);
  bpFinishSheet(ws, [30, 18, 22, 34, 42, 14]);
  return ws;
}

function bpBuildEventDaySheet(contactsToUse: Contact[]) {
  const rows: unknown[][] = [
    ["Pitch", "Arrival", "Organisation", "Type", "Contact", "Phone", "Signed In", "Pitch Checked", "Trading Started", "Safety Checked", "Signed Out", "Committee Notes"],
    ...bpGroupedContacts(contactsToUse).map((contact) => [
      contact.pitch_number || "",
      contact.arrival_time || "",
      contact.organisation_name || "",
      contact.organisation_type || "",
      contact.contact_name || "",
      contact.phone || "",
      contact.signed_in ? "✅" : "",
      contact.pitch_inspected ? "✅" : "",
      contact.trading_started ? "✅" : "",
      contact.safety_inspection_completed ? "✅" : "",
      contact.signed_out ? "✅" : "",
      "",
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  bpStyleHeaderRow(ws, 1, BP_XLSX_COLOURS.blue);
  ws["!rows"] = [{ hpt: 28 }, ...contactsToUse.map(() => ({ hpt: 30 }))];
  bpFinishSheet(ws, [12, 12, 30, 18, 22, 16, 14, 16, 18, 18, 14, 42]);
  return ws;
}

function bpBuildStatisticsSheet(contactsToUse: Contact[]) {
  const typeCounts = new Map<string, number>();
  contactsToUse.forEach((contact) => {
    const type = bpText(contact.organisation_type) || "Unknown";
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
  });

  const rows: unknown[][] = [
    ["Organisation Type", "Count"],
    ...Array.from(typeCounts.entries()),
    [],
    ["Status", "Count"],
    ["Ready", contactsToUse.filter((contact) => bpStatus(contact).includes("Ready")).length],
    ["Waiting committee sign-off", contactsToUse.filter((contact) => bpStatus(contact).includes("Waiting")).length],
    ["Missing PLI", contactsToUse.filter((contact) => bpStatus(contact).includes("Missing")).length],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  bpStyleHeaderRow(ws, 1, BP_XLSX_COLOURS.grey);
  const secondHeaderRow = Array.from(typeCounts.entries()).length + 4;
  bpStyleHeaderRow(ws, secondHeaderRow, BP_XLSX_COLOURS.grey);
  ws["!cols"] = [{ wch: 34 }, { wch: 16 }];
  return ws;
}

function bpBuildFullDataSheet(contactsToUse: Contact[]) {
  const headers = excelColumns.map((column) => column.header);
  const rows = contactsToUse.map((contact) => excelColumns.map((column) => toExcelCell(contact[column.key as keyof Contact])));
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  bpStyleHeaderRow(ws, 1, BP_XLSX_COLOURS.purple);
  bpFinishSheet(ws, headers.map((header) => Math.max(14, Math.min(42, String(header).length + 4))));
  return ws;
}

function bpBuildTemplateSheet() {
  const headers = excelColumns.map((column) => column.header);
  const example = excelColumns.map((column) => {
    if (column.example !== undefined) return column.example;
    if (booleanChecklistKeySet.has(column.key)) return "no";
    return "";
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  bpStyleHeaderRow(ws, 1, BP_XLSX_COLOURS.purple);
  bpFinishSheet(ws, headers.map((header) => Math.max(14, Math.min(42, String(header).length + 4))));
  return ws;
}

function bpBuildTemplateInstructionsSheet() {
  const rows: unknown[][] = [
    ["BURTON PRIDE CHECKLIST TEMPLATE"],
    [],
    ["How to use this template"],
    ["1. Fill in the Checklist template sheet."],
    ["2. Use yes/no for checkbox columns."],
    ["3. Keep the column headers the same."],
    ["4. Save as .xlsx and upload it back into the Event Hub."],
    [],
    ["Organisation type examples", organisationTypes.join(", ")],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = [XLSX.utils.decode_range("A1:B1")];
  ws["!cols"] = [{ wch: 42 }, { wch: 90 }];
  bpSetCellStyle(ws, "A1", {
    font: { bold: true, sz: 20, color: { rgb: BP_XLSX_COLOURS.white } },
    fill: { fgColor: { rgb: BP_XLSX_COLOURS.purple } },
    alignment: { horizontal: "center" },
  });
  bpStyleHeaderRow(ws, 3, BP_XLSX_COLOURS.pink);
  return ws;
}

function bpDownloadStyledTemplateXlsx() {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, bpBuildTemplateSheet(), "Checklist template");
  XLSX.utils.book_append_sheet(workbook, bpBuildTemplateInstructionsSheet(), "Instructions");

  workbook.Props = {
    Title: "Burton Pride Event Hub Checklist Template",
    Subject: "Styled Excel import template",
    Author: "Burton Pride C.I.C.",
    Company: "Burton Pride C.I.C.",
    CreatedDate: new Date(),
  };

  XLSX.writeFile(workbook, "Burton-Pride-Checklist-Template.xlsx", {
    compression: true,
    cellStyles: true,
  });
}

function bpExportStyledChecklistWorkbook({
  eventYear,
  contactsToUse,
  filteredContactsToUse,
  sheetStats,
}: {
  eventYear: number | string;
  contactsToUse: Contact[];
  filteredContactsToUse: Contact[];
  sheetStats: WorkbookStats;
}) {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, bpBuildDashboardSheet(eventYear, contactsToUse, sheetStats), "Dashboard");
  XLSX.utils.book_append_sheet(workbook, bpBuildOrganisationsSheet(filteredContactsToUse), "Organisations");
  XLSX.utils.book_append_sheet(workbook, bpBuildFoodVendorsSheet(filteredContactsToUse), "Food Vendors");
  XLSX.utils.book_append_sheet(workbook, bpBuildMissingDocumentsSheet(filteredContactsToUse), "Missing PLI");
  XLSX.utils.book_append_sheet(workbook, bpBuildEventDaySheet(filteredContactsToUse), "Event Day");
  XLSX.utils.book_append_sheet(workbook, bpBuildStatisticsSheet(filteredContactsToUse), "Statistics");
  XLSX.utils.book_append_sheet(workbook, bpBuildFullDataSheet(filteredContactsToUse), "Full Checklist Data");

  workbook.Props = {
    Title: `Burton Pride ${eventYear} Event Checklist`,
    Subject: "Stallholders, charities, vendors and event-day checks",
    Author: "Burton Pride Event Hub",
    Company: "Burton Pride C.I.C.",
    CreatedDate: new Date(),
  };

  XLSX.writeFile(workbook, `Burton-Pride-${eventYear}-Professional-Checklist.xlsx`, {
    compression: true,
    cellStyles: true,
  });
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
      docs_public_liability_insurance: Boolean(contact.docs_public_liability_insurance),
      docs_risk_assessment: Boolean(contact.docs_risk_assessment),
      food_hygiene_certificate: Boolean(contact.food_hygiene_certificate),
      food_hygiene_rating_checked: Boolean(contact.food_hygiene_rating_checked),
      gas_safety_certificate: Boolean(contact.gas_safety_certificate),
      generator_safety_certificate: Boolean(contact.generator_safety_certificate),
      pat_testing_certificate: Boolean(contact.pat_testing_certificate),
      fire_risk_assessment: Boolean(contact.fire_risk_assessment),
      first_aid_arrangements: Boolean(contact.first_aid_arrangements),
      dbs_checked: Boolean(contact.dbs_checked),
      food_registration_verified: Boolean(contact.food_registration_verified),
      hand_washing_facilities: Boolean(contact.hand_washing_facilities),
      waste_disposal_plan: Boolean(contact.waste_disposal_plan),
      temperature_control: Boolean(contact.temperature_control),
      allergen_information: Boolean(contact.allergen_information),
      fire_extinguisher: Boolean(contact.fire_extinguisher),
      fire_blanket: Boolean(contact.fire_blanket),
      gas_bottle_secured: Boolean(contact.gas_bottle_secured),
      electrical_outdoor_leads: Boolean(contact.electrical_outdoor_leads),
      rcd_protection: Boolean(contact.rcd_protection),
      generator_fuel_safe: Boolean(contact.generator_fuel_safe),
      generator_positioned_safe: Boolean(contact.generator_positioned_safe),
      cable_ramps: Boolean(contact.cable_ramps),
      vehicle_registration_received: Boolean(contact.vehicle_registration_received),
      vehicle_pass_issued: Boolean(contact.vehicle_pass_issued),
      loading_instructions_sent: Boolean(contact.loading_instructions_sent),
      arrival_completed: Boolean(contact.arrival_completed),
      vehicle_removed: Boolean(contact.vehicle_removed),
      invoice_sent: Boolean(contact.invoice_sent),
      payment_received: Boolean(contact.payment_received),
      terms_accepted: Boolean(contact.terms_accepted),
      privacy_policy_accepted: Boolean(contact.privacy_policy_accepted),
      emergency_contact_recorded: Boolean(contact.emergency_contact_recorded),
      signed_in: Boolean(contact.signed_in),
      pitch_inspected: Boolean(contact.pitch_inspected),
      trading_started: Boolean(contact.trading_started),
      safety_inspection_completed: Boolean(contact.safety_inspection_completed),
      trading_finished: Boolean(contact.trading_finished),
      site_left_clean: Boolean(contact.site_left_clean),
      signed_out: Boolean(contact.signed_out),
      committee_pli_verified: Boolean(contact.committee_pli_verified),
      committee_risk_assessment_approved: Boolean(contact.committee_risk_assessment_approved),
      committee_food_hygiene_verified: Boolean(contact.committee_food_hygiene_verified),
      committee_gas_certificate_verified: Boolean(contact.committee_gas_certificate_verified),
      committee_generator_certificate_verified: Boolean(contact.committee_generator_certificate_verified),
      committee_pat_verified: Boolean(contact.committee_pat_verified),
      committee_fire_equipment_checked: Boolean(contact.committee_fire_equipment_checked),
      committee_pitch_inspected: Boolean(contact.committee_pitch_inspected),
      committee_compliance_passed: Boolean(contact.committee_compliance_passed),
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

      if (!editingId) throw new Error("Select an organisation from the checklist first. New organisations should be added from the Contacts page, then imported here.");
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

  async function handleXlsxUpload(file: File) {
    if (requireUnlockedYear()) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      setImporting(true);
      setNotice(null);

      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!extension || !["xlsx", "xls"].includes(extension)) {
        throw new Error("Please upload an Excel file only. Use .xlsx or .xls.");
      }

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;

      if (!firstSheet) {
        throw new Error("The Excel file does not contain any worksheets.");
      }

      const rows = getXlsxRowsFromWorksheet(firstSheet);
      if (rows.length < 2) {
        throw new Error("Excel file must include a header row and at least one organisation.");
      }

      const headers = rows[0].map(normalizeHeader);

      const contactsToImport = rows.slice(1).map((row) => {
        const item: Record<string, string> = {};
        headers.forEach((header, index) => {
          item[header] = String(row[index] || "").trim();
        });

        const imported: Partial<FormState> = {};

        for (const column of excelColumns) {
          const value = getImportedValue(item, column.header, String(column.key));
          if (booleanChecklistKeySet.has(column.key)) {
            imported[column.key] = valueToBool(value) as never;
          } else {
            imported[column.key] = value as never;
          }
        }

        return {
          ...emptyForm,
          ...imported,
          organisation_name:
            getImportedValue(item, "Organisation name", "organisation_name", "business_name", "name") || "",
          contact_name: getImportedValue(item, "Contact person", "contact_name", "contact_person"),
          email: getImportedValue(item, "Email", "email", "email_address"),
          phone: getImportedValue(item, "Phone", "phone", "phone_number"),
          organisation_type:
            getImportedValue(item, "Organisation type", "organisation_type", "type") || "Stallholder",
          pitch_number: getImportedValue(item, "Pitch number", "pitch_number", "pitch"),
          arrival_time: getImportedValue(item, "Arrival time", "arrival_time", "arrival"),
          checklist_sent: valueToBool(getImportedValue(item, "Checklist sent", "checklist_sent")),
          checklist_confirmed: valueToBool(getImportedValue(item, "Checklist confirmed", "checklist_confirmed")),
          notes: getImportedValue(item, "Notes", "notes"),
          event_year: selectedYear,
        };
      });

      const missing = contactsToImport.findIndex((item) => !item.organisation_name.trim());
      if (missing >= 0) {
        throw new Error(`Excel row ${missing + 2} is missing an organisation name.`);
      }

      const res = await fetch(API_ROUTE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: contactsToImport }),
      });

      const data = await readJson(res);
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to import Excel contacts.");
      }

      setNotice({
        type: "success",
        message: `${contactsToImport.length} checklist contact${contactsToImport.length === 1 ? "" : "s"} imported successfully from Excel.`,
      });
      await loadContacts();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to import Excel contacts.",
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

      const data = (await readJson(res)) as unknown as BusinessContactsResponse;

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
    bpDownloadStyledTemplateXlsx();
  }

  function exportContacts() {
    bpExportStyledChecklistWorkbook({
      eventYear: selectedYear,
      contactsToUse: contacts,
      filteredContactsToUse: filteredContacts,
      sheetStats: stats,
    });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.22),_transparent_32%),linear-gradient(180deg,#12091f_0%,#24113a_48%,#111827_100%)] text-white">
      <div className="w-full px-3 py-6 sm:px-4 lg:px-6 xl:px-8">
        <div className="mb-6 rounded-[32px] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-pink-400/30 bg-pink-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-pink-100">
                <ClipboardCheck className="h-4 w-4" />
                Burton Pride Event Hub
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">Stallholders & Charities Checklist</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/70">
                This page manages checklist, setup, document, safety, arrival, event-day, and committee sign-off records for organisations already imported from the Contacts page.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/15">
                <Download className="h-4 w-4" /> Excel template
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing || isYearLocked} className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-3 text-sm font-bold text-sky-100 hover:bg-sky-500/20 disabled:opacity-60">
                <Upload className="h-4 w-4" /> {importing ? "Importing..." : "Upload Excel"}
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
                <Download className="h-4 w-4" /> Export Excel
              </button>
              <button type="button" onClick={loadContacts} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/15 disabled:opacity-60">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleXlsxUpload(file); }} />
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
                    Adding, editing, deleting, Excel uploads, importing from Contacts, DELETE ALL, and document changes are disabled until the year is unlocked with the main admin password.
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

        <div className="grid gap-6 xl:grid-cols-[520px_minmax(0,1fr)]">
          <div className="rounded-[32px] border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
            {editingId ? (
              <>
                <div className="mb-4 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                  <h2 className="text-xl font-bold text-white">Edit checklist record</h2>
                  <p className="mt-1 text-sm leading-6 text-emerald-100/75">
                    Update the organisation details, required documents, electrical and gas checks, and administration checks.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-emerald-100/80">
                    New organisations are added on the Contacts page, then imported into this checklist.
                  </p>
                </div>
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

              <div className="rounded-[28px] border border-emerald-400/25 bg-emerald-500/10 p-5 shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-100">
                    <ShieldCheck className="h-6 w-6" />
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-emerald-100">
                      Personal document check
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-emerald-100/70">
                      Use this section to record whether the organisation's Public Liability Insurance has been received.
                    </p>
                  </div>
                </div>

                <label className="mt-5 flex cursor-pointer items-start gap-4 rounded-2xl border border-white/15 bg-black/20 p-5 transition hover:border-emerald-300/40 hover:bg-black/30">
                  <input
                    type="checkbox"
                    checked={Boolean(form.docs_public_liability_insurance)}
                    onChange={(event) =>
                      updateForm(
                        "docs_public_liability_insurance",
                        event.target.checked,
                      )
                    }
                    className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-400"
                  />

                  <span>
                    <span className="block font-black text-white">
                      Public Liability Insurance received
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-white/55">
                      Tick this after you have received and checked their current Public Liability Insurance document.
                    </span>
                  </span>
                </label>

                <div
                  className={`mt-4 rounded-2xl border p-4 text-sm font-bold ${
                    form.docs_public_liability_insurance
                      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                      : "border-amber-400/25 bg-amber-500/10 text-amber-100"
                  }`}
                >
                  {form.docs_public_liability_insurance
                    ? "Public Liability Insurance has been checked."
                    : "Public Liability Insurance still needs to be checked."}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-100">
                    <FileUp className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-white">
                      Required documents
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-white/55">
                      Record the documents received for legal, insurance and safety checks.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {[
                    {
                      key: "docs_risk_assessment",
                      label: "Risk Assessment received",
                    },
                    {
                      key: "food_hygiene_certificate",
                      label: "Food Hygiene Certificate received",
                    },
                    {
                      key: "food_hygiene_rating_checked",
                      label: "Food Hygiene Rating checked",
                    },
                    {
                      key: "gas_safety_certificate",
                      label: "Gas Safety Certificate received, if using LPG",
                    },
                    {
                      key: "generator_safety_certificate",
                      label: "Generator safety certificate received, if using a generator",
                    },
                    {
                      key: "pat_testing_certificate",
                      label: "PAT testing or electrical certificate received",
                    },
                    {
                      key: "fire_risk_assessment",
                      label: "Fire Risk Assessment received, where required",
                    },
                    {
                      key: "first_aid_arrangements",
                      label: "First aid arrangements confirmed, if applicable",
                    },
                    {
                      key: "dbs_checked",
                      label: "DBS checked, where applicable",
                    },
                  ].map((item) => (
                    <CheckBox
                      key={item.key}
                      label={item.label}
                      checked={Boolean(
                        form[item.key as keyof FormState],
                      )}
                      onChange={(checked) =>
                        updateForm(
                          item.key as keyof FormState,
                          checked as never,
                        )
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-100">
                    <ShieldCheck className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-white">
                      Electrical, gas and generators
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-white/55">
                      Use these checks when the organisation is using power, LPG, electrical equipment or a generator.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {[
                    {
                      key: "electrical_outdoor_leads",
                      label: "Outdoor-safe extension leads confirmed",
                    },
                    {
                      key: "rcd_protection",
                      label: "RCD protection confirmed",
                    },
                    {
                      key: "generator_fuel_safe",
                      label: "Generator fuel storage confirmed safe",
                    },
                    {
                      key: "generator_positioned_safe",
                      label: "Generator position confirmed safe",
                    },
                    {
                      key: "cable_ramps",
                      label: "Cable ramps or cable protection confirmed",
                    },
                  ].map((item) => (
                    <CheckBox
                      key={item.key}
                      label={item.label}
                      checked={Boolean(
                        form[item.key as keyof FormState],
                      )}
                      onChange={(checked) =>
                        updateForm(
                          item.key as keyof FormState,
                          checked as never,
                        )
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-100">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-white">
                      Administration checks
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-white/55">
                      Record the main finance, consent and emergency contact checks.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {[
                    {
                      key: "invoice_sent",
                      label: "Invoice sent",
                    },
                    {
                      key: "payment_received",
                      label: "Payment received",
                    },
                    {
                      key: "terms_accepted",
                      label: "Terms and Conditions accepted",
                    },
                    {
                      key: "privacy_policy_accepted",
                      label: "Privacy Policy accepted",
                    },
                    {
                      key: "emergency_contact_recorded",
                      label: "Emergency contact recorded",
                    },
                  ].map((item) => (
                    <CheckBox
                      key={item.key}
                      label={item.label}
                      checked={Boolean(
                        form[item.key as keyof FormState],
                      )}
                      onChange={(checked) =>
                        updateForm(
                          item.key as keyof FormState,
                          checked as never,
                        )
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={saveContact} disabled={saving || isYearLocked} className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black hover:opacity-90 disabled:opacity-60">
                  <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save checklist"}
                </button>
                <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white/10">
                  <X className="h-4 w-4" /> Close
                </button>
              </div>
            </div>

              </>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/15 bg-black/20 p-8 text-center">
                <ClipboardCheck className="mx-auto h-10 w-10 text-pink-100/70" />
                <h2 className="mt-4 text-xl font-extrabold text-white">Select an organisation</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/65">
                  This checklist page does not create organisations. Add businesses, vendors, charities and partners on the Contacts page, then use Import from Contacts to bring them here.
                </p>
                <p className="mx-auto mt-3 max-w-sm text-xs leading-5 text-white/50">
                  Click Edit on a saved organisation to update its checklist, safety documents, pitch, arrival and event-day checks.
                </p>
              </div>
            )}
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
  const requiredKeys = getRequiredKeysForType(contact.organisation_type);
  const requiredCompleted = requiredKeys.filter((key) => Boolean(contact[key])).length;
  const missingRequired = requiredKeys.filter((key) => !contact[key]);
  const compliancePassed = Boolean(contact.committee_compliance_passed);

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

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-bold">Checklist progress: {completed}/2</p>
              <p className="mt-1 text-xs text-white/60">Track whether the checklist has been sent and confirmed before event day.</p>
            </div>

            <div className={compliancePassed ? "rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4" : "rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4"}>
              <p className="text-sm font-bold">Safety checks: {requiredCompleted}/{requiredKeys.length}</p>
              <p className="mt-1 text-xs text-white/60">
                {compliancePassed ? "Committee compliance passed." : missingRequired.length === 0 ? "Ready for committee verification." : `${missingRequired.length} required check${missingRequired.length === 1 ? "" : "s"} still missing.`}
              </p>
            </div>
          </div>

          {missingRequired.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="font-bold">Missing PLI</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-amber-100/85">
                {missingRequired.map((key) => (
                  <li key={String(key)}>{getLabelForChecklistKey(key)}</li>
                ))}
              </ul>
            </div>
          )}

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
