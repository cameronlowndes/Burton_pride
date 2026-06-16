"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  PiggyBank,
  Plus,
  Save,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";

import type { Transaction } from "@/lib/money/types";

type BudgetItem = {
  id?: string | null;
  year: string;
  category_key: string;
  category_label: string;
  planned_amount_pence: number;
  /**
   * Manual actual spending overrides are saved inside the notes column as
   * hidden metadata, so this works even if your Supabase budget table has no
   * extra manual-actual columns yet.
   */
  manual_actual_enabled?: boolean | null;
  manual_actual_pence?: number | null;
  actual_amount_pence?: number | null;
  actual_override_pence?: number | null;
  notes?: string | null;
  updated_by?: string | null;
  updated_by_email?: string | null;
  updated_by_user_id?: string | null;
};

type BudgetRow = BudgetItem & {
  autoActualPence: number;
  actualPence: number;
  manualActualEnabled: boolean;
  manualActualPence: number | null;
  remainingPence: number;
  percentUsed: number;
};

type SavingTargetState = {
  id: string;
  name: string;
  targetAmount: string;
  currentSaved: string;
  months: string;
  note: string;
};

function createEmptySavingTarget(
  name = "New saving target",
): SavingTargetState {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `saving-target-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    name,
    targetAmount: "",
    currentSaved: "",
    months: "",
    note: "",
  };
}

const DEFAULT_SAVING_TARGET_NAME = "General savings";

type Props = {
  selectedYear: string;
  budgetItems: BudgetItem[];
  transactions: Transaction[];
  savingBudget: boolean;
  onSaveBudget: (items: BudgetItem[]) => void | Promise<void>;

  /**
   * Optional: pass these from the parent page if you already have the signed-in admin.
   * The audit route should still verify the Clerk user server-side, but this lets the
   * Budget Planning UI show who is editing before Save is pressed.
   */
  currentAdminName?: string | null;
  currentAdminEmail?: string | null;
};

const DEFAULT_BUDGET_KEYS = [
  "venue",
  "insurance",
  "printing",
  "security",
  "performers",
  "equipment",
  "accessibility",
  "other",
];

const KEYWORDS: Record<string, string[]> = {
  venue: ["venue", "pitch", "field", "hire", "shobnall"],
  insurance: ["insurance", "public liability", "liability"],
  printing: ["print", "printing", "poster", "banner", "flyer", "leaflet"],
  security: ["security", "steward", "first aid", "safety"],
  performers: ["performer", "drag", "queen", "artist", "dj", "entertainment"],
  equipment: ["equipment", "gazebo", "table", "stage", "pa", "speaker", "mic"],
  accessibility: [
    "accessibility",
    "accessible",
    "disabled",
    "bsl",
    "quiet space",
    "sensory",
  ],
  other: [],
};

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((Number(value) || 0) / 100);
}

function penceToInput(value: number) {
  return ((Number(value) || 0) / 100).toFixed(2);
}

function inputToPence(value: string) {
  const amount = Number(String(value || "0").replace(/,/g, ""));
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

function cleanMoneyInput(value: string) {
  return value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
}

const BUDGET_META_START = "<!--BURTON_BUDGET_META:";
const BUDGET_META_END = "-->";

type BudgetHiddenMeta = {
  manualActualEnabled?: boolean;
  manualActualPence?: number | null;
};

function parseBudgetHiddenMeta(notes?: string | null): BudgetHiddenMeta {
  const raw = String(notes || "");
  const startIndex = raw.indexOf(BUDGET_META_START);

  if (startIndex === -1) return {};

  const payloadStart = startIndex + BUDGET_META_START.length;
  const endIndex = raw.indexOf(BUDGET_META_END, payloadStart);

  if (endIndex === -1) return {};

  try {
    const parsed = JSON.parse(raw.slice(payloadStart, endIndex));
    const manualActualPence = Number(parsed.manualActualPence ?? 0);

    return {
      manualActualEnabled: Boolean(parsed.manualActualEnabled),
      manualActualPence: Number.isFinite(manualActualPence)
        ? manualActualPence
        : null,
    };
  } catch {
    return {};
  }
}

function stripBudgetHiddenMeta(notes?: string | null) {
  const raw = String(notes || "");
  const startIndex = raw.indexOf(BUDGET_META_START);

  if (startIndex === -1) return raw.trim();

  const endIndex = raw.indexOf(BUDGET_META_END, startIndex);

  if (endIndex === -1) return raw.slice(0, startIndex).trim();

  return `${raw.slice(0, startIndex)}${raw.slice(endIndex + BUDGET_META_END.length)}`.trim();
}

function getBudgetPublicNotes(item: BudgetItem) {
  return stripBudgetHiddenMeta(item.notes);
}

function getBudgetManualActualEnabled(item: BudgetItem) {
  const meta = parseBudgetHiddenMeta(item.notes);

  return Boolean(
    item.manual_actual_enabled ||
      meta.manualActualEnabled ||
      item.manual_actual_pence !== undefined ||
      item.actual_amount_pence !== undefined ||
      item.actual_override_pence !== undefined,
  );
}

function getBudgetManualActualPence(item: BudgetItem) {
  const meta = parseBudgetHiddenMeta(item.notes);

  const rawValue =
    item.manual_actual_pence ??
    item.actual_override_pence ??
    item.actual_amount_pence ??
    meta.manualActualPence ??
    null;

  if (rawValue === null || rawValue === undefined) return null;

  const next = Number(rawValue || 0);

  return Number.isFinite(next) ? next : null;
}

function buildBudgetNotesWithMeta(
  publicNotes: string | null | undefined,
  meta: BudgetHiddenMeta,
) {
  const cleanNotes = String(publicNotes || "").trim();

  if (!meta.manualActualEnabled) {
    return cleanNotes;
  }

  const cleanMeta = JSON.stringify({
    manualActualEnabled: true,
    manualActualPence: Math.max(0, Number(meta.manualActualPence || 0)),
  });

  return `${cleanNotes}${cleanNotes ? "\n\n" : ""}${BUDGET_META_START}${cleanMeta}${BUDGET_META_END}`;
}

function setBudgetPublicNotesOnItem(item: BudgetItem, publicNotes: string) {
  const manualActualEnabled = getBudgetManualActualEnabled(item);
  const manualActualPence = getBudgetManualActualPence(item);

  return {
    ...item,
    notes: buildBudgetNotesWithMeta(publicNotes, {
      manualActualEnabled,
      manualActualPence,
    }),
  };
}

function setBudgetManualActualOnItem(
  item: BudgetItem,
  manualActualEnabled: boolean,
  manualActualPence: number | null,
) {
  const publicNotes = getBudgetPublicNotes(item);
  const cleanManualActualPence = manualActualEnabled
    ? Math.max(0, Number(manualActualPence || 0))
    : null;

  return {
    ...item,
    manual_actual_enabled: manualActualEnabled,
    manual_actual_pence: cleanManualActualPence,
    actual_amount_pence: cleanManualActualPence,
    actual_override_pence: cleanManualActualPence,
    notes: buildBudgetNotesWithMeta(publicNotes, {
      manualActualEnabled,
      manualActualPence: cleanManualActualPence,
    }),
  };
}


function cleanWholeNumberInput(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function normaliseSavingTarget(
  value: Partial<SavingTargetState> | null | undefined,
  fallbackName = DEFAULT_SAVING_TARGET_NAME,
): SavingTargetState {
  const blank = createEmptySavingTarget(fallbackName);

  return {
    id: String(value?.id || blank.id),
    name: String(value?.name || fallbackName),
    targetAmount: String(value?.targetAmount || ""),
    currentSaved: String(value?.currentSaved || ""),
    months: String(value?.months || ""),
    note: String(value?.note || ""),
  };
}

function safeParseSavingTargets(value: string | null): SavingTargetState[] {
  if (!value) return [normaliseSavingTarget(null)];

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      const targets = parsed
        .map((item, index) =>
          normaliseSavingTarget(
            item as Partial<SavingTargetState>,
            index === 0
              ? DEFAULT_SAVING_TARGET_NAME
              : `Saving target ${index + 1}`,
          ),
        )
        .filter((item) => item.id);

      return targets.length > 0 ? targets : [normaliseSavingTarget(null)];
    }

    // Keeps old single-target localStorage data working after this update.
    return [normaliseSavingTarget(parsed as Partial<SavingTargetState>)];
  } catch {
    return [normaliseSavingTarget(null)];
  }
}

function buildBudgetAmountInputs(items: BudgetItem[]) {
  return items.reduce<Record<string, string>>((acc, item) => {
    acc[item.category_key] =
      Number(item.planned_amount_pence || 0) > 0
        ? penceToInput(item.planned_amount_pence)
        : "";

    return acc;
  }, {});
}

function buildBudgetActualInputs(items: BudgetItem[]) {
  return items.reduce<Record<string, string>>((acc, item) => {
    const manualActualPence = getBudgetManualActualPence(item);

    acc[item.category_key] =
      manualActualPence !== null && Number(manualActualPence || 0) > 0
        ? penceToInput(manualActualPence)
        : "";

    return acc;
  }, {});
}

function slugifyBudgetKey(value: string) {
  const clean = value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return clean || "custom_budget_area";
}

function isDefaultBudgetKey(categoryKey: string) {
  return DEFAULT_BUDGET_KEYS.includes(categoryKey);
}

function isItemDonation(transaction: Transaction) {
  return (
    String(transaction.payment_method || "")
      .trim()
      .toLowerCase() === "item donation"
  );
}

function getTransactionBudgetKey(transaction: Transaction) {
  const item = transaction as Transaction & {
    budget_category?: string | null;
    budget_category_key?: string | null;
    budgetCategory?: string | null;
    budgetCategoryKey?: string | null;
    cost_area?: string | null;
    costArea?: string | null;
  };

  return (
    item.budget_category_key ||
    item.budgetCategoryKey ||
    item.budget_category ||
    item.budgetCategory ||
    item.cost_area ||
    item.costArea ||
    null
  );
}

function transactionHaystack(transaction: Transaction) {
  const linkedBudgetKey = getTransactionBudgetKey(transaction);

  return [
    transaction.title,
    transaction.description,
    transaction.category,
    transaction.payment_method,
    transaction.sponsorship_note,
    linkedBudgetKey,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesBudgetItem(transaction: Transaction, item: BudgetItem) {
  const linkedBudgetKey = getTransactionBudgetKey(transaction);

  if (linkedBudgetKey) {
    const linked = linkedBudgetKey.toLowerCase();
    const categoryKey = item.category_key.toLowerCase();
    const categoryLabel = item.category_label.toLowerCase();

    if (linked === categoryKey || linked === categoryLabel) {
      return true;
    }
  }

  const haystack = transactionHaystack(transaction);

  const words = [
    item.category_key,
    item.category_label,
    ...(KEYWORDS[item.category_key] || []),
  ]
    .map((word) => word.toLowerCase().trim())
    .filter(Boolean);

  return words.some((word) => haystack.includes(word));
}

function buildActualSpendByCategory(
  items: BudgetItem[],
  transactions: Transaction[],
) {
  const actuals: Record<string, number> = {};

  items.forEach((item) => {
    actuals[item.category_key] = 0;
  });

  const otherItem = items.find((item) => item.category_key === "other") || null;

  const customItems = items.filter(
    (item) =>
      item.category_key !== "other" && !isDefaultBudgetKey(item.category_key),
  );

  const defaultItems = items.filter(
    (item) =>
      item.category_key !== "other" && isDefaultBudgetKey(item.category_key),
  );

  transactions
    .filter((item) => item.type === "expense")
    .filter((item) => !isItemDonation(item))
    .forEach((transaction) => {
      const linkedBudgetKey = getTransactionBudgetKey(transaction);

      if (linkedBudgetKey) {
        const linkedMatch = items.find((item) => {
          const linked = linkedBudgetKey.toLowerCase();
          return (
            item.category_key.toLowerCase() === linked ||
            item.category_label.toLowerCase() === linked
          );
        });

        if (linkedMatch) {
          actuals[linkedMatch.category_key] =
            (actuals[linkedMatch.category_key] || 0) +
            (transaction.amount_pence || 0);
          return;
        }
      }

      const customMatch = customItems.find((item) =>
        matchesBudgetItem(transaction, item),
      );

      if (customMatch) {
        actuals[customMatch.category_key] =
          (actuals[customMatch.category_key] || 0) +
          (transaction.amount_pence || 0);
        return;
      }

      const defaultMatch = defaultItems.find((item) =>
        matchesBudgetItem(transaction, item),
      );

      if (defaultMatch) {
        actuals[defaultMatch.category_key] =
          (actuals[defaultMatch.category_key] || 0) +
          (transaction.amount_pence || 0);
        return;
      }

      if (otherItem) {
        actuals[otherItem.category_key] =
          (actuals[otherItem.category_key] || 0) +
          (transaction.amount_pence || 0);
      }
    });

  return actuals;
}

type BudgetAuditChangedField = {
  category_key: string;
  before: Partial<BudgetItem>;
  after: Partial<BudgetItem>;
  changed_fields: string[];
};

type BudgetAuditPayload = {
  beforeItems: BudgetItem[];
  afterItems: BudgetItem[];
  addedBudgetAreas: BudgetItem[];
  removedBudgetAreas: BudgetItem[];
  changedBudgetAreas: BudgetAuditChangedField[];
};

function normaliseBudgetNote(value: string | null | undefined) {
  return getBudgetPublicNotes({
    year: "",
    category_key: "",
    category_label: "",
    planned_amount_pence: 0,
    notes: value || "",
  });
}

function buildBudgetAuditPayload(
  beforeItems: BudgetItem[],
  afterItems: BudgetItem[],
): BudgetAuditPayload {
  const beforeKeys = new Set(beforeItems.map((item) => item.category_key));
  const afterKeys = new Set(afterItems.map((item) => item.category_key));

  const addedBudgetAreas = afterItems.filter(
    (item) => !beforeKeys.has(item.category_key),
  );

  const removedBudgetAreas = beforeItems.filter(
    (item) => !afterKeys.has(item.category_key),
  );

  const changedBudgetAreas = afterItems
    .map((afterItem) => {
      const beforeItem = beforeItems.find(
        (item) => item.category_key === afterItem.category_key,
      );

      if (!beforeItem) return null;

      const changedFields: string[] = [];

      if (beforeItem.category_label !== afterItem.category_label) {
        changedFields.push("category_label");
      }

      if (
        Number(beforeItem.planned_amount_pence || 0) !==
        Number(afterItem.planned_amount_pence || 0)
      ) {
        changedFields.push("planned_amount_pence");
      }

      if (
        normaliseBudgetNote(beforeItem.notes) !==
        normaliseBudgetNote(afterItem.notes)
      ) {
        changedFields.push("notes");
      }


      if (
        getBudgetManualActualEnabled(beforeItem) !==
          getBudgetManualActualEnabled(afterItem) ||
        Number(getBudgetManualActualPence(beforeItem) || 0) !==
          Number(getBudgetManualActualPence(afterItem) || 0)
      ) {
        changedFields.push("manual_actual_spending");
      }

      if (changedFields.length === 0) return null;

      return {
        category_key: afterItem.category_key,
        before: beforeItem,
        after: afterItem,
        changed_fields: changedFields,
      };
    })
    .filter(Boolean) as BudgetAuditChangedField[];

  return {
    beforeItems,
    afterItems,
    addedBudgetAreas,
    removedBudgetAreas,
    changedBudgetAreas,
  };
}

function hasBudgetAuditChanges(payload: BudgetAuditPayload) {
  return (
    payload.addedBudgetAreas.length > 0 ||
    payload.removedBudgetAreas.length > 0 ||
    payload.changedBudgetAreas.length > 0
  );
}

function cleanBudgetItemsForSave(items: BudgetItem[]) {
  return items.map((item) => {
    const cleaned: BudgetItem = {
      year: item.year,
      category_key: item.category_key,
      category_label: item.category_label,
      planned_amount_pence: Number(item.planned_amount_pence || 0),
      notes: buildBudgetNotesWithMeta(getBudgetPublicNotes(item), {
        manualActualEnabled: getBudgetManualActualEnabled(item),
        manualActualPence: getBudgetManualActualPence(item),
      }),
    };

    if (item.id) {
      cleaned.id = item.id;
    }

    if (item.updated_by) {
      cleaned.updated_by = item.updated_by;
    }

    if (item.updated_by_email) {
      cleaned.updated_by_email = item.updated_by_email;
    }

    if (item.updated_by_user_id) {
      cleaned.updated_by_user_id = item.updated_by_user_id;
    }

    return cleaned;
  });
}

type BudgetEditor = {
  name: string | null;
  email: string | null;
};

function cleanEditorValue(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

function nameFromEmail(email: string | null | undefined) {
  if (!email) return null;

  const username = email.split("@")[0] || "";

  const cleaned = username
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();

  return cleaned || null;
}

function getBudgetItemEditor(
  item: BudgetItem,
  currentEditor: BudgetEditor | null,
) {
  const savedName = cleanEditorValue(item.updated_by);
  const savedEmail = cleanEditorValue(item.updated_by_email);
  const currentName = cleanEditorValue(currentEditor?.name);
  const currentEmail = cleanEditorValue(currentEditor?.email);

  const name =
    savedName ||
    nameFromEmail(savedEmail) ||
    currentName ||
    nameFromEmail(currentEmail);
  const email = savedEmail || currentEmail;

  return {
    name: name || null,
    email: email || null,
  };
}

function budgetEditorDisplayName(
  item: BudgetItem,
  currentEditor: BudgetEditor | null,
) {
  const editor = getBudgetItemEditor(item, currentEditor);

  return editor.name || editor.email || "Not recorded yet";
}

function budgetEditorDisplayEmail(
  item: BudgetItem,
  currentEditor: BudgetEditor | null,
) {
  return getBudgetItemEditor(item, currentEditor).email;
}

function getEditorFromPayload(payload: any): BudgetEditor | null {
  if (!payload) return null;

  const user =
    payload.user ||
    payload.currentUser ||
    payload.admin ||
    payload.profile ||
    payload.me ||
    payload;

  const email =
    cleanEditorValue(user.email) ||
    cleanEditorValue(user.emailAddress) ||
    cleanEditorValue(user.primaryEmailAddress?.emailAddress) ||
    cleanEditorValue(user.emailAddresses?.[0]?.emailAddress) ||
    cleanEditorValue(payload.email) ||
    cleanEditorValue(payload.emailAddress);

  const firstName =
    cleanEditorValue(user.firstName) ||
    cleanEditorValue(user.first_name) ||
    cleanEditorValue(payload.firstName) ||
    cleanEditorValue(payload.first_name) ||
    "";

  const lastName =
    cleanEditorValue(user.lastName) ||
    cleanEditorValue(user.last_name) ||
    cleanEditorValue(payload.lastName) ||
    cleanEditorValue(payload.last_name) ||
    "";

  const fullName = `${firstName || ""} ${lastName || ""}`
    .replace(/\s+/g, " ")
    .trim();

  const name =
    cleanEditorValue(user.name) ||
    cleanEditorValue(user.fullName) ||
    cleanEditorValue(user.full_name) ||
    cleanEditorValue(payload.name) ||
    cleanEditorValue(payload.fullName) ||
    fullName ||
    nameFromEmail(email);

  if (!name && !email) return null;

  return {
    name: name || nameFromEmail(email) || null,
    email,
  };
}

async function fetchBudgetEditor(): Promise<BudgetEditor | null> {
  const endpoints = ["/api/admin/me/permissions"];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
      });

      if (!response.ok) continue;

      const payload = await response.json().catch(() => null);
      const editor = getEditorFromPayload(payload);

      if (editor?.name || editor?.email) {
        return editor;
      }
    } catch {
      // Try the next possible current-admin endpoint.
    }
  }

  return null;
}

type BudgetAuditLogResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  status?: number;
  details?: string;
};

function getAuditLogErrorMessage(status: number, details: string) {
  if (status === 405) {
    return [
      "Audit log failed with 405 Method Not Allowed.",
      "Your route app/api/admin/money/audit-logs/route.ts exists, but it does not have an export async function POST(request: Request).",
      details,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (status === 401 || status === 403) {
    return [
      "Audit log failed because the current admin is not allowed to create audit logs.",
      details,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (status >= 500) {
    return ["Audit log failed because the server returned an error.", details]
      .filter(Boolean)
      .join(" ");
  }

  return [`Audit log failed with status ${status}.`, details]
    .filter(Boolean)
    .join(" ");
}

async function createBudgetAuditLog(
  selectedYear: string,
  payload: BudgetAuditPayload,
  editor: BudgetEditor | null,
): Promise<BudgetAuditLogResult> {
  if (!hasBudgetAuditChanges(payload)) {
    return {
      ok: true,
      skipped: true,
    };
  }

  try {
    const response = await fetch("/api/admin/money/audit-logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "budget_update",
        transactionId: null,
        transaction_id: null,
        transactionTitle: `Budget Planning ${selectedYear}`,
        transaction_title: `Budget Planning ${selectedYear}`,
        createdBy: editor?.name || null,
        created_by: editor?.name || null,
        createdByEmail: editor?.email || null,
        created_by_email: editor?.email || null,
        beforeData: payload.beforeItems,
        before_data: payload.beforeItems,
        afterData: payload.afterItems,
        after_data: payload.afterItems,
        changedFields: {
          addedBudgetAreas: payload.addedBudgetAreas,
          removedBudgetAreas: payload.removedBudgetAreas,
          changedBudgetAreas: payload.changedBudgetAreas,
        },
        changed_fields: {
          added_budget_areas: payload.addedBudgetAreas,
          removed_budget_areas: payload.removedBudgetAreas,
          changed_budget_areas: payload.changedBudgetAreas,
        },
        metadata: {
          area: "budget_planning",
          year: selectedYear,
          source: "money_budget_planning_component",
          actor_name: editor?.name || null,
          actor_email: editor?.email || null,
          created_by: editor?.name || null,
          created_by_email: editor?.email || null,
          added_budget_area_count: payload.addedBudgetAreas.length,
          removed_budget_area_count: payload.removedBudgetAreas.length,
          changed_budget_area_count: payload.changedBudgetAreas.length,
          added_budget_areas: payload.addedBudgetAreas.map(
            (item) => item.category_label,
          ),
          removed_budget_areas: payload.removedBudgetAreas.map(
            (item) => item.category_label,
          ),
          changed_budget_areas: payload.changedBudgetAreas.map((item) => ({
            category_key: item.category_key,
            before_label: item.before.category_label,
            after_label: item.after.category_label,
            changed_fields: item.changed_fields,
          })),
        },
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      const error = getAuditLogErrorMessage(response.status, details);

      console.error(
        "Failed to save budget audit log:",
        response.status,
        details,
      );

      return {
        ok: false,
        error,
        status: response.status,
        details,
      };
    }

    return {
      ok: true,
    };
  } catch (error: any) {
    const message =
      error?.message ||
      "Audit log failed because the request could not be completed.";

    console.error("Failed to save budget audit log:", error);

    return {
      ok: false,
      error: message,
      details: message,
    };
  }
}


type SavingTargetAuditAction =
  | "saving_target_create"
  | "saving_target_update"
  | "saving_target_clear"
  | "saving_target_monthly_saved"
  | "saving_target_soft_delete"
  | "saving_target_draft_remove";

type SavingTargetAuditLogResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  status?: number;
  details?: string;
};

function savingTargetAuditSnapshot(target: SavingTargetState | null) {
  if (!target) return null;

  return {
    id: target.id,
    name: target.name,
    target_amount_pence: inputToPence(target.targetAmount),
    saved_amount_pence: inputToPence(target.currentSaved),
    months_to_save: Math.max(1, Number(target.months || 1) || 1),
    notes: target.note || "",
  };
}

function getSavingTargetAuditTitle(
  target: SavingTargetState | null | undefined,
  selectedYear: string,
) {
  const name = String(target?.name || DEFAULT_SAVING_TARGET_NAME).trim();

  return `Saving Target - ${name} (${selectedYear})`;
}

function buildSavingTargetChangedFields(
  beforeTarget: SavingTargetState | null,
  afterTarget: SavingTargetState | null,
) {
  const beforeData = savingTargetAuditSnapshot(beforeTarget);
  const afterData = savingTargetAuditSnapshot(afterTarget);

  const fieldLabels: Record<string, string> = {
    id: "ID",
    name: "Target name",
    target_amount_pence: "Target amount",
    saved_amount_pence: "Already saved",
    months_to_save: "Months to save",
    notes: "Notes",
  };

  const allFields = new Set([
    ...Object.keys(beforeData || {}),
    ...Object.keys(afterData || {}),
  ]);

  const changed: Record<
    string,
    {
      label: string;
      before: any;
      after: any;
    }
  > = {};

  allFields.forEach((field) => {
    const beforeValue = beforeData?.[field as keyof typeof beforeData] ?? null;
    const afterValue = afterData?.[field as keyof typeof afterData] ?? null;

    if (String(beforeValue ?? "") !== String(afterValue ?? "")) {
      changed[field] = {
        label: fieldLabels[field] || field,
        before: beforeValue,
        after: afterValue,
      };
    }
  });

  return changed;
}

function getSavingTargetAuditLabel(action: SavingTargetAuditAction) {
  if (action === "saving_target_create") return "Saving target created";
  if (action === "saving_target_update") return "Saving target updated";
  if (action === "saving_target_clear") return "Saving target cleared";
  if (action === "saving_target_monthly_saved") {
    return "Saving target monthly amount added";
  }
  if (action === "saving_target_soft_delete") return "Saving target soft deleted";
  if (action === "saving_target_draft_remove") return "Saving target draft removed";

  return String(action).replace(/_/g, " ");
}

async function createSavingTargetAuditLog({
  action,
  selectedYear,
  beforeTarget,
  afterTarget,
  editor,
  metadata = {},
}: {
  action: SavingTargetAuditAction;
  selectedYear: string;
  beforeTarget: SavingTargetState | null;
  afterTarget: SavingTargetState | null;
  editor: BudgetEditor | null;
  metadata?: Record<string, any>;
}): Promise<SavingTargetAuditLogResult> {
  const beforeData = savingTargetAuditSnapshot(beforeTarget);
  const afterData = savingTargetAuditSnapshot(afterTarget);
  const changedFields = buildSavingTargetChangedFields(beforeTarget, afterTarget);

  const targetForTitle = afterTarget || beforeTarget;
  const targetId = afterTarget?.id || beforeTarget?.id || null;
  const targetName = targetForTitle?.name || DEFAULT_SAVING_TARGET_NAME;

  try {
    const response = await fetch("/api/admin/money/audit-logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        transactionId: targetId,
        transaction_id: targetId,
        transactionTitle: getSavingTargetAuditTitle(targetForTitle, selectedYear),
        transaction_title: getSavingTargetAuditTitle(targetForTitle, selectedYear),

        actorName: editor?.name || null,
        actor_name: editor?.name || null,
        actorEmail: editor?.email || null,
        actor_email: editor?.email || null,

        createdBy: editor?.name || null,
        created_by: editor?.name || null,
        createdByEmail: editor?.email || null,
        created_by_email: editor?.email || null,

        beforeData,
        before_data: beforeData,
        afterData,
        after_data: afterData,

        changedFields,
        changed_fields: changedFields,

        metadata: {
          area: "saving_targets",
          year: selectedYear,
          source: "money_budget_planning_saving_target_ui",
          audit_event: action,
          audit_label: getSavingTargetAuditLabel(action),
          target_id: targetId,
          target_name: targetName,
          actor_name: editor?.name || null,
          actor_email: editor?.email || null,
          created_by: editor?.name || null,
          created_by_email: editor?.email || null,
          changed_field_count: Object.keys(changedFields).length,
          ...metadata,
        },
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      const error = getAuditLogErrorMessage(response.status, details);

      console.error(
        "Failed to save saving target audit log:",
        response.status,
        details,
      );

      return {
        ok: false,
        error,
        status: response.status,
        details,
      };
    }

    return {
      ok: true,
    };
  } catch (error: any) {
    const message =
      error?.message ||
      "Saving target audit log failed because the request could not be completed.";

    console.error("Failed to save saving target audit log:", error);

    return {
      ok: false,
      error: message,
      details: message,
    };
  }
}

function getSavingTargetAuditErrorMessage(result: SavingTargetAuditLogResult) {
  return (
    result.error ||
    result.details ||
    "Saving target was saved, but the audit log could not be created."
  );
}


type SavingTargetApiRow = {
  id: string;
  year: string;
  target_name: string;
  target_amount_pence: number;
  saved_amount_pence: number;
  months_to_save: number;
  notes?: string | null;
  created_by?: string | null;
  created_by_email?: string | null;
  updated_by?: string | null;
  updated_by_email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function apiRowToSavingTarget(row: SavingTargetApiRow): SavingTargetState {
  return {
    id: row.id,
    name: row.target_name || DEFAULT_SAVING_TARGET_NAME,
    targetAmount:
      Number(row.target_amount_pence || 0) > 0
        ? penceToInput(row.target_amount_pence)
        : "",
    currentSaved:
      Number(row.saved_amount_pence || 0) > 0
        ? penceToInput(row.saved_amount_pence)
        : "",
    months:
      Number(row.months_to_save || 0) > 0 ? String(row.months_to_save) : "",
    note: row.notes || "",
  };
}

function savingTargetToApiPayload(
  target: SavingTargetState,
  selectedYear: string,
) {
  return {
    id: target.id,
    year: selectedYear,
    target_name: target.name || DEFAULT_SAVING_TARGET_NAME,
    target_amount_pence: inputToPence(target.targetAmount),
    saved_amount_pence: inputToPence(target.currentSaved),
    months_to_save: Math.max(1, Number(target.months || 1) || 1),
    notes: target.note || "",
  };
}

async function parseSavingTargetResponse(response: Response) {
  const rawText = await response.text().catch(() => "");

  let payload: any = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const serverError =
      payload?.error ||
      payload?.message ||
      "Saving target request failed.";

    const serverDetails =
      payload?.details ||
      payload?.hint ||
      payload?.code ||
      rawText ||
      "No extra server details were returned.";

    const helpLines = [
      `Saving target error (${response.status} ${response.statusText || "Request failed"})`,
      "",
      `Main error: ${serverError}`,
      `Details: ${serverDetails}`,
      `API route: ${response.url || "/api/admin/money/saving-targets"}`,
    ];

    if (response.status === 404) {
      helpLines.push(
        "",
        "What to check:",
        "• Make sure app/api/admin/money/saving-targets/route.ts exists.",
        "• Make sure the route exports GET, POST, PATCH and DELETE.",
      );
    }

    if (response.status === 405) {
      helpLines.push(
        "",
        "What to check:",
        "• The API route exists, but the HTTP method is missing.",
        "• Add the matching export function, for example export async function POST(request: Request).",
      );
    }

    if (response.status === 401 || response.status === 403) {
      helpLines.push(
        "",
        "What to check:",
        "• Make sure you are signed in as an admin.",
        "• Check Clerk/admin permissions for this route.",
      );
    }

    if (response.status >= 500) {
      helpLines.push(
        "",
        "What to check:",
        "• Check the Vercel/server logs for the full database error.",
        "• Make sure the money_saving_targets Supabase table exists.",
        "• Make sure columns such as deleted_at, target_name and target_amount_pence exist.",
      );
    }

    const error = new Error(helpLines.join("\n")) as Error & {
      status?: number;
      payload?: any;
    };

    error.status = response.status;
    error.payload = payload;

    throw error;
  }

  return payload || {};
}


async function parseDeletedItemsResponse(response: Response) {
  const rawText = await response.text().catch(() => "");

  let payload: any = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const serverError =
      payload?.error ||
      payload?.message ||
      "Deleted items request failed.";

    const serverDetails =
      payload?.details ||
      payload?.hint ||
      payload?.code ||
      rawText ||
      "No extra server details were returned.";

    const helpLines = [
      `Deleted items error (${response.status} ${response.statusText || "Request failed"})`,
      "",
      `Main error: ${serverError}`,
      `Details: ${serverDetails}`,
      `API route: ${response.url || "/api/admin/money/deleted-items"}`,
    ];

    if (response.status === 404) {
      helpLines.push(
        "",
        "What to check:",
        "• Make sure app/api/admin/money/deleted-items/route.ts exists.",
        "• Make sure the route exports DELETE for soft deleting budget tracker items.",
        "• Make sure the selected budget row still exists in Supabase.",
      );
    }

    if (response.status === 405) {
      helpLines.push(
        "",
        "What to check:",
        "• The deleted-items route exists but the DELETE method is missing.",
        "• Add export async function DELETE(request: Request) to app/api/admin/money/deleted-items/route.ts.",
      );
    }

    if (response.status >= 500) {
      helpLines.push(
        "",
        "What to check:",
        "• Check the terminal/Vercel logs.",
        "• Make sure your budget tracker table name is listed in POSSIBLE_BUDGET_TABLES.",
        "• Make sure the budget tracker table has deleted_at, deleted_by, deleted_by_email and deleted_by_user_id columns.",
      );
    }

    throw new Error(helpLines.join("\n"));
  }

  return payload || {};
}

function isSavedSavingTargetId(id: string | null | undefined) {
  return Boolean(id && !String(id).startsWith("saving-target-"));
}

async function saveSavingTargetToDatabase(
  target: SavingTargetState,
  selectedYear: string,
) {
  const creating = !isSavedSavingTargetId(target.id);

  try {
    const response = await fetch("/api/admin/money/saving-targets", {
      method: creating ? "POST" : "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        creating
          ? {
              ...savingTargetToApiPayload(target, selectedYear),
              id: undefined,
            }
          : savingTargetToApiPayload(target, selectedYear),
      ),
    });

    const payload = await parseSavingTargetResponse(response);

    return payload?.target ? apiRowToSavingTarget(payload.target) : target;
  } catch (error: any) {
    /**
     * If this target ID came from old browser/local data, Supabase will not
     * have that row. Instead of showing a red 404 forever, save it again as a
     * new database target.
     */
    if (!creating && error?.status === 404) {
      const response = await fetch("/api/admin/money/saving-targets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...savingTargetToApiPayload(target, selectedYear),
          id: undefined,
        }),
      });

      const payload = await parseSavingTargetResponse(response);

      return payload?.target ? apiRowToSavingTarget(payload.target) : target;
    }

    throw error;
  }
}

export default function MoneyBudgetPlanning({
  selectedYear,
  budgetItems,
  transactions,
  savingBudget,
  onSaveBudget,
  currentAdminName = null,
  currentAdminEmail = null,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [superEasyMode, setSuperEasyMode] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draftItems, setDraftItems] = useState<BudgetItem[]>(budgetItems);
  const [draftAmountInputs, setDraftAmountInputs] = useState<
    Record<string, string>
  >(() => buildBudgetAmountInputs(budgetItems));
  const [draftActualInputs, setDraftActualInputs] = useState<
    Record<string, string>
  >(() => buildBudgetActualInputs(budgetItems));
  const [newBudgetName, setNewBudgetName] = useState("");
  const [newBudgetError, setNewBudgetError] = useState<string | null>(null);
  const [auditLogError, setAuditLogError] = useState<string | null>(null);
  const [editorDetails, setEditorDetails] = useState<BudgetEditor | null>(
    () => {
      const name =
        cleanEditorValue(currentAdminName) || nameFromEmail(currentAdminEmail);
      const email = cleanEditorValue(currentAdminEmail);

      return name || email
        ? {
            name,
            email,
          }
        : null;
    },
  );
  const [savingTargets, setSavingTargets] = useState<SavingTargetState[]>(
    () => [normaliseSavingTarget(null)],
  );
  const [selectedSavingTargetId, setSelectedSavingTargetId] = useState("");
  const [newSavingTargetName, setNewSavingTargetName] = useState("");
  const [savingTargetError, setSavingTargetError] = useState<string | null>(
    null,
  );
  const [savingTargetLoading, setSavingTargetLoading] = useState(false);
  const [savingTargetSaving, setSavingTargetSaving] = useState(false);
  const [deleteSavingTargetPopup, setDeleteSavingTargetPopup] =
    useState<SavingTargetState | null>(null);
  const [deleteBudgetAreaPopup, setDeleteBudgetAreaPopup] =
    useState<BudgetItem | null>(null);
  const [deletingBudgetArea, setDeletingBudgetArea] = useState(false);

  useEffect(() => {
    setDraftItems(budgetItems);
    setDraftAmountInputs(buildBudgetAmountInputs(budgetItems));
    setDraftActualInputs(buildBudgetActualInputs(budgetItems));
  }, [budgetItems]);

  useEffect(() => {
    let cancelled = false;

    async function loadSavingTargets() {
      setSavingTargetLoading(true);
      setSavingTargetError(null);

      try {
        const response = await fetch(
          `/api/admin/money/saving-targets?year=${encodeURIComponent(
            selectedYear,
          )}`,
          { cache: "no-store" },
        );

        const payload = await parseSavingTargetResponse(response);
        const targets = Array.isArray(payload?.targets)
          ? payload.targets.map((row: SavingTargetApiRow) =>
              apiRowToSavingTarget(row),
            )
          : [];

        if (cancelled) return;

        const nextTargets =
          targets.length > 0 ? targets : [normaliseSavingTarget(null)];

        setSavingTargets(nextTargets);
        setSelectedSavingTargetId(nextTargets[0]?.id || "");
        setNewSavingTargetName("");
      } catch (error: any) {
        if (cancelled) return;

        setSavingTargets([normaliseSavingTarget(null)]);
        setSelectedSavingTargetId("");
        setSavingTargetError(
          error?.message || "Could not load saving targets from the database.",
        );
      } finally {
        if (!cancelled) {
          setSavingTargetLoading(false);
        }
      }
    }

    loadSavingTargets();

    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  useEffect(() => {
    const name =
      cleanEditorValue(currentAdminName) || nameFromEmail(currentAdminEmail);
    const email = cleanEditorValue(currentAdminEmail);

    if (name || email) {
      setEditorDetails({
        name,
        email,
      });
    }
  }, [currentAdminEmail, currentAdminName]);

  useEffect(() => {
    let cancelled = false;

    async function loadEditor() {
      if (editorDetails?.name || editorDetails?.email) return;

      const editor = await fetchBudgetEditor();

      if (!cancelled && editor) {
        setEditorDetails(editor);
      }
    }

    loadEditor();

    return () => {
      cancelled = true;
    };
  }, [editorDetails?.email, editorDetails?.name]);

  const activeItems = editing ? draftItems : budgetItems;

  const rows = useMemo<BudgetRow[]>(() => {
    const actuals = buildActualSpendByCategory(activeItems, transactions);

    return activeItems.map((item) => {
      const autoActualPence = actuals[item.category_key] || 0;
      const manualActualEnabled = getBudgetManualActualEnabled(item);
      const manualActualPence = getBudgetManualActualPence(item);
      const actualPence =
        manualActualEnabled && manualActualPence !== null
          ? manualActualPence
          : autoActualPence;
      const plannedPence = Number(item.planned_amount_pence || 0);
      const remainingPence = plannedPence - actualPence;
      const percentUsed =
        plannedPence > 0 ? Math.round((actualPence / plannedPence) * 100) : 0;

      return {
        ...item,
        autoActualPence,
        actualPence,
        manualActualEnabled,
        manualActualPence,
        remainingPence,
        percentUsed,
      };
    });
  }, [activeItems, transactions]);

  const totals = useMemo(() => {
    const planned = rows.reduce(
      (sum, item) => sum + (item.planned_amount_pence || 0),
      0,
    );

    const actual = rows.reduce((sum, item) => sum + item.actualPence, 0);
    const remaining = planned - actual;
    const percentUsed = planned > 0 ? Math.round((actual / planned) * 100) : 0;

    return {
      planned,
      actual,
      remaining,
      percentUsed,
    };
  }, [rows]);

  const selectedSavingTarget = useMemo(() => {
    return (
      savingTargets.find((target) => target.id === selectedSavingTargetId) ||
      savingTargets[0] ||
      normaliseSavingTarget(null)
    );
  }, [savingTargets, selectedSavingTargetId]);

  const savingTargetSummaries = useMemo(() => {
    return savingTargets.map((target) => {
      const targetPence = inputToPence(target.targetAmount);
      const currentSavedPence = inputToPence(target.currentSaved);
      const progressPercent =
        targetPence > 0
          ? Math.min(100, Math.round((currentSavedPence / targetPence) * 100))
          : 0;

      return {
        ...target,
        targetPence,
        currentSavedPence,
        remainingToSavePence: Math.max(targetPence - currentSavedPence, 0),
        progressPercent,
      };
    });
  }, [savingTargets]);

  const savingTargetTotals = useMemo(() => {
    const targetPence = inputToPence(selectedSavingTarget.targetAmount);
    const currentSavedPence = inputToPence(selectedSavingTarget.currentSaved);
    const months = Math.max(
      0,
      Math.floor(Number(selectedSavingTarget.months || 0) || 0),
    );
    const remainingToSavePence = Math.max(targetPence - currentSavedPence, 0);
    const monthlyRequiredPence =
      months > 0 ? Math.ceil(remainingToSavePence / months) : 0;
    const progressPercent =
      targetPence > 0
        ? Math.min(100, Math.round((currentSavedPence / targetPence) * 100))
        : 0;

    return {
      targetPence,
      currentSavedPence,
      months,
      remainingToSavePence,
      monthlyRequiredPence,
      progressPercent,
    };
  }, [
    selectedSavingTarget.currentSaved,
    selectedSavingTarget.months,
    selectedSavingTarget.targetAmount,
  ]);

  const hasSavingTarget = savingTargetTotals.targetPence > 0;

  const hasOverBudgetRows = rows.some((item) => item.remainingPence < 0);

  function startSuperEasyEditing() {
    setDraftItems(budgetItems);
    setDraftAmountInputs(buildBudgetAmountInputs(budgetItems));
    setDraftActualInputs(buildBudgetActualInputs(budgetItems));
    setNewBudgetName("");
    setNewBudgetError(null);
    setAuditLogError(null);
    setEditing(true);
  }

  function startEditing() {
    setDraftItems(budgetItems);
    setDraftAmountInputs(buildBudgetAmountInputs(budgetItems));
    setDraftActualInputs(buildBudgetActualInputs(budgetItems));
    setNewBudgetName("");
    setNewBudgetError(null);
    setAuditLogError(null);
    setEditing(true);
    setIsOpen(true);
  }

  function cancelEditing() {
    setDraftItems(budgetItems);
    setDraftAmountInputs(buildBudgetAmountInputs(budgetItems));
    setDraftActualInputs(buildBudgetActualInputs(budgetItems));
    setNewBudgetName("");
    setNewBudgetError(null);
    setAuditLogError(null);
    setEditing(false);
  }

  function updateDraft(
    categoryKey: string,
    field: "notes" | "category_label",
    value: string,
  ) {
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.category_key !== categoryKey) return item;

        if (field === "notes") {
          return setBudgetPublicNotesOnItem(item, value);
        }

        return {
          ...item,
          [field]: value,
        };
      }),
    );
  }

  function updateDraftPlannedAmount(categoryKey: string, value: string) {
    setDraftAmountInputs((prev) => ({
      ...prev,
      [categoryKey]: value,
    }));

    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.category_key !== categoryKey) return item;

        return {
          ...item,
          planned_amount_pence: inputToPence(value),
        };
      }),
    );
  }

  function formatDraftPlannedAmount(categoryKey: string) {
    setDraftAmountInputs((prev) => {
      const rawValue = prev[categoryKey];

      if (rawValue === undefined || rawValue === "") {
        return prev;
      }

      return {
        ...prev,
        [categoryKey]: penceToInput(inputToPence(rawValue)),
      };
    });
  }


  function updateDraftActualAmount(categoryKey: string, value: string) {
    setDraftActualInputs((prev) => ({
      ...prev,
      [categoryKey]: value,
    }));

    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.category_key !== categoryKey) return item;

        return setBudgetManualActualOnItem(item, true, inputToPence(value));
      }),
    );
  }

  function formatDraftActualAmount(categoryKey: string) {
    setDraftActualInputs((prev) => {
      const rawValue = prev[categoryKey];

      if (rawValue === undefined || rawValue === "") {
        return prev;
      }

      return {
        ...prev,
        [categoryKey]: penceToInput(inputToPence(rawValue)),
      };
    });
  }

  function toggleManualActualAmount(categoryKey: string, enabled: boolean) {
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.category_key !== categoryKey) return item;

        const currentManual = getBudgetManualActualPence(item);

        return setBudgetManualActualOnItem(
          item,
          enabled,
          enabled ? currentManual ?? 0 : null,
        );
      }),
    );

    if (!enabled) {
      setDraftActualInputs((prev) => ({
        ...prev,
        [categoryKey]: "",
      }));
    }
  }

  function updateSavingTarget(field: keyof SavingTargetState, value: string) {
    const cleanedValue =
      field === "targetAmount" || field === "currentSaved"
        ? cleanMoneyInput(value)
        : field === "months"
          ? cleanWholeNumberInput(value)
          : value;

    setSavingTargets((prev) =>
      prev.map((target) =>
        target.id === selectedSavingTarget.id
          ? {
              ...target,
              [field]: cleanedValue,
            }
          : target,
      ),
    );
  }

  async function saveSelectedSavingTarget() {
    const targetName = selectedSavingTarget.name.trim();

    if (!targetName) {
      setSavingTargetError("Enter a name for the selected saving target.");
      return;
    }

    setSavingTargetSaving(true);
    setSavingTargetError(null);

    try {
      const wasAlreadySaved = isSavedSavingTargetId(selectedSavingTarget.id);
      const beforeTarget = selectedSavingTarget;

      const savedTarget = await saveSavingTargetToDatabase(
        selectedSavingTarget,
        selectedYear,
      );

      const auditResult = await createSavingTargetAuditLog({
        action: wasAlreadySaved ? "saving_target_update" : "saving_target_create",
        selectedYear,
        beforeTarget: wasAlreadySaved ? beforeTarget : null,
        afterTarget: savedTarget,
        editor: editorDetails,
        metadata: {
          route: "/api/admin/money/saving-targets",
          trigger: "save_selected_target_button",
        },
      });

      setSavingTargets((prev) => {
        const found = prev.some(
          (target) => target.id === selectedSavingTarget.id,
        );

        if (!found) return [savedTarget, ...prev];

        return prev.map((target) =>
          target.id === selectedSavingTarget.id ? savedTarget : target,
        );
      });
      setSelectedSavingTargetId(savedTarget.id);

      if (!auditResult.ok) {
        setSavingTargetError(
          `Saving target saved, but audit log failed.\n\n${getSavingTargetAuditErrorMessage(auditResult)}`,
        );
      }
    } catch (error: any) {
      setSavingTargetError(
        error?.message || "Could not save the selected saving target.",
      );
    } finally {
      setSavingTargetSaving(false);
    }
  }

  async function clearSavingTarget() {
    const resetTarget = normaliseSavingTarget({
      id: selectedSavingTarget.id,
      name: selectedSavingTarget.name || DEFAULT_SAVING_TARGET_NAME,
    });

    setSavingTargets((prev) =>
      prev.map((target) =>
        target.id === selectedSavingTarget.id ? resetTarget : target,
      ),
    );

    setSavingTargetSaving(true);
    setSavingTargetError(null);

    try {
      const beforeTarget = selectedSavingTarget;

      const savedTarget = await saveSavingTargetToDatabase(
        resetTarget,
        selectedYear,
      );

      const auditResult = await createSavingTargetAuditLog({
        action: "saving_target_clear",
        selectedYear,
        beforeTarget,
        afterTarget: savedTarget,
        editor: editorDetails,
        metadata: {
          route: "/api/admin/money/saving-targets",
          trigger: "clear_selected_target_button",
        },
      });

      setSavingTargets((prev) =>
        prev.map((target) =>
          target.id === selectedSavingTarget.id ? savedTarget : target,
        ),
      );
      setSelectedSavingTargetId(savedTarget.id);

      if (!auditResult.ok) {
        setSavingTargetError(
          `Saving target cleared, but audit log failed.\n\n${getSavingTargetAuditErrorMessage(auditResult)}`,
        );
      }
    } catch (error: any) {
      setSavingTargetError(
        error?.message || "Could not clear the selected saving target.",
      );
    } finally {
      setSavingTargetSaving(false);
    }
  }

  async function addSavingTarget() {
    const label = newSavingTargetName.trim();

    if (!label) {
      setSavingTargetError("Enter a name for the saving target first.");
      return;
    }

    const nameAlreadyExists = savingTargets.some(
      (target) => target.name.toLowerCase().trim() === label.toLowerCase(),
    );

    if (nameAlreadyExists) {
      setSavingTargetError("A saving target with this name already exists.");
      return;
    }

    setSavingTargetSaving(true);
    setSavingTargetError(null);

    try {
      const newTarget = createEmptySavingTarget(label);
      const response = await fetch("/api/admin/money/saving-targets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          year: selectedYear,
          target_name: label,
          target_amount_pence: 0,
          saved_amount_pence: 0,
          months_to_save: 1,
          notes: "",
        }),
      });

      const payload = await parseSavingTargetResponse(response);
      const savedTarget = payload?.target
        ? apiRowToSavingTarget(payload.target)
        : newTarget;

      const auditResult = await createSavingTargetAuditLog({
        action: "saving_target_create",
        selectedYear,
        beforeTarget: null,
        afterTarget: savedTarget,
        editor: editorDetails,
        metadata: {
          route: "/api/admin/money/saving-targets",
          trigger: "add_target_button",
        },
      });

      setSavingTargets((prev) => {
        const withoutBlankDefault =
          prev.length === 1 &&
          !isSavedSavingTargetId(prev[0]?.id) &&
          !prev[0]?.targetAmount &&
          !prev[0]?.currentSaved &&
          !prev[0]?.months &&
          !prev[0]?.note
            ? []
            : prev;

        return [...withoutBlankDefault, savedTarget];
      });
      setSelectedSavingTargetId(savedTarget.id);
      setNewSavingTargetName("");

      if (!auditResult.ok) {
        setSavingTargetError(
          `Saving target created, but audit log failed.\n\n${getSavingTargetAuditErrorMessage(auditResult)}`,
        );
      }
    } catch (error: any) {
      setSavingTargetError(
        error?.message || "Could not add the new saving target.",
      );
    } finally {
      setSavingTargetSaving(false);
    }
  }

  function openDeleteSavingTargetPopup(target: SavingTargetState) {
    setSavingTargetError(null);
    setDeleteSavingTargetPopup(target);
  }

  function closeDeleteSavingTargetPopup() {
    if (savingTargetSaving) return;
    setDeleteSavingTargetPopup(null);
  }

  async function confirmSoftDeleteSavingTarget() {
    if (!deleteSavingTargetPopup?.id) return;

    await removeSavingTarget(deleteSavingTargetPopup.id);
    setDeleteSavingTargetPopup(null);
  }

  async function removeSavingTarget(targetId: string) {
    if (!targetId) return;

    if (!isSavedSavingTargetId(targetId)) {
      const beforeTarget =
        savingTargets.find((target) => target.id === targetId) || null;

      const auditResult = await createSavingTargetAuditLog({
        action: "saving_target_draft_remove",
        selectedYear,
        beforeTarget,
        afterTarget: null,
        editor: editorDetails,
        metadata: {
          trigger: "delete_unsaved_saving_target",
          database_row: false,
        },
      });

      setSavingTargets((prev) => {
        const nextTargets = prev.filter((target) => target.id !== targetId);
        const fallback = nextTargets.length > 0 ? nextTargets : [normaliseSavingTarget(null)];
        setSelectedSavingTargetId(fallback[0]?.id || "");
        return fallback;
      });

      if (!auditResult.ok) {
        setSavingTargetError(
          `Saving target removed from draft, but audit log failed.\n\n${getSavingTargetAuditErrorMessage(auditResult)}`,
        );
      }

      return;
    }

    setSavingTargetSaving(true);
    setSavingTargetError(null);

    try {
      const beforeTarget =
        savingTargets.find((target) => target.id === targetId) || null;

      const response = await fetch(
        `/api/admin/money/saving-targets?id=${encodeURIComponent(targetId)}`,
        { method: "DELETE" },
      );

      const payload = await parseSavingTargetResponse(response);
      const afterTarget = payload?.target
        ? apiRowToSavingTarget(payload.target)
        : null;

      const auditResult = await createSavingTargetAuditLog({
        action: "saving_target_soft_delete",
        selectedYear,
        beforeTarget,
        afterTarget,
        editor: editorDetails,
        metadata: {
          route: "/api/admin/money/saving-targets",
          trigger: "delete_selected_target_button",
          soft_delete: true,
        },
      });

      setSavingTargets((prev) => {
        const nextTargets = prev.filter((target) => target.id !== targetId);
        const fallback = nextTargets.length > 0 ? nextTargets : [normaliseSavingTarget(null)];

        if (selectedSavingTargetId === targetId) {
          setSelectedSavingTargetId(fallback[0]?.id || "");
        }

        return fallback;
      });

      if (!auditResult.ok) {
        setSavingTargetError(
          `Saving target soft deleted, but audit log failed.\n\n${getSavingTargetAuditErrorMessage(auditResult)}`,
        );
      }
    } catch (error: any) {
      setSavingTargetError(
        error?.message || "Could not remove the selected saving target.",
      );
    } finally {
      setSavingTargetSaving(false);
    }
  }

  async function addCurrentSavedFromMonthlyAmount() {
    if (savingTargetTotals.monthlyRequiredPence <= 0) return;

    const nextSavedPence =
      savingTargetTotals.currentSavedPence +
      savingTargetTotals.monthlyRequiredPence;

    const updatedTarget = {
      ...selectedSavingTarget,
      currentSaved: penceToInput(nextSavedPence),
    };

    setSavingTargets((prev) =>
      prev.map((target) =>
        target.id === selectedSavingTarget.id ? updatedTarget : target,
      ),
    );

    setSavingTargetSaving(true);
    setSavingTargetError(null);

    try {
      const beforeTarget = selectedSavingTarget;

      const savedTarget = await saveSavingTargetToDatabase(
        updatedTarget,
        selectedYear,
      );

      const auditResult = await createSavingTargetAuditLog({
        action: "saving_target_monthly_saved",
        selectedYear,
        beforeTarget,
        afterTarget: savedTarget,
        editor: editorDetails,
        metadata: {
          route: "/api/admin/money/saving-targets",
          trigger: "add_one_month_saved_button",
          monthly_required_pence: savingTargetTotals.monthlyRequiredPence,
        },
      });

      setSavingTargets((prev) =>
        prev.map((target) =>
          target.id === selectedSavingTarget.id ? savedTarget : target,
        ),
      );
      setSelectedSavingTargetId(savedTarget.id);

      if (!auditResult.ok) {
        setSavingTargetError(
          `Monthly saving update saved, but audit log failed.\n\n${getSavingTargetAuditErrorMessage(auditResult)}`,
        );
      }
    } catch (error: any) {
      setSavingTargetError(
        error?.message || "Could not save the monthly saving update.",
      );
    } finally {
      setSavingTargetSaving(false);
    }
  }

  function addBudgetArea() {
    const label = newBudgetName.trim();

    if (!label) {
      setAuditLogError(null);
      setNewBudgetError("Enter a budget area name first.");
      return;
    }

    const baseKey = slugifyBudgetKey(label);
    const existingKeys = new Set(draftItems.map((item) => item.category_key));
    const existingLabels = new Set(
      draftItems.map((item) => item.category_label.toLowerCase().trim()),
    );

    if (existingLabels.has(label.toLowerCase())) {
      setAuditLogError(null);
      setNewBudgetError("That budget area already exists.");
      return;
    }

    let categoryKey = baseKey;
    let counter = 2;

    while (existingKeys.has(categoryKey)) {
      categoryKey = `${baseKey}_${counter}`;
      counter += 1;
    }

    const otherIndex = draftItems.findIndex(
      (item) => item.category_key === "other",
    );

    const newItem: BudgetItem = {
      year: selectedYear,
      category_key: categoryKey,
      category_label: label,
      planned_amount_pence: 0,
      notes: "",
      updated_by:
        editorDetails?.name || nameFromEmail(editorDetails?.email) || null,
      updated_by_email: editorDetails?.email || null,
    };

    setDraftItems((prev) => {
      if (otherIndex === -1) {
        return [...prev, newItem];
      }

      return [...prev.slice(0, otherIndex), newItem, ...prev.slice(otherIndex)];
    });

    setDraftAmountInputs((prev) => ({
      ...prev,
      [categoryKey]: "",
    }));

    setDraftActualInputs((prev) => ({
      ...prev,
      [categoryKey]: "",
    }));

    setNewBudgetName("");
    setNewBudgetError(null);
    setAuditLogError(null);

    // Keep Super Easy Mode in edit mode so the new budget area appears
    // immediately and can be given an amount before Save Budget is pressed.
    setEditing(true);
  }

  function removeBudgetAreaFromDraft(categoryKey: string) {
    setDraftItems((prev) =>
      prev.filter((item) => item.category_key !== categoryKey),
    );

    setDraftAmountInputs((prev) => {
      const next = { ...prev };
      delete next[categoryKey];
      return next;
    });

    setDraftActualInputs((prev) => {
      const next = { ...prev };
      delete next[categoryKey];
      return next;
    });
  }

  function openDeleteBudgetAreaPopup(item: BudgetItem) {
    setAuditLogError(null);
    setNewBudgetError(null);
    setDeleteBudgetAreaPopup(item);
  }

  function closeDeleteBudgetAreaPopup() {
    if (deletingBudgetArea) return;
    setDeleteBudgetAreaPopup(null);
  }

  async function confirmSoftDeleteBudgetArea() {
    if (!deleteBudgetAreaPopup) return;

    const item = deleteBudgetAreaPopup;

    /**
     * If the custom budget area has not been saved to Supabase yet,
     * there is no database row to soft delete. Remove it from this draft only.
     */
    if (!item.id) {
      removeBudgetAreaFromDraft(item.category_key);
      setDeleteBudgetAreaPopup(null);
      return;
    }

    setDeletingBudgetArea(true);
    setAuditLogError(null);

    try {
      const response = await fetch("/api/admin/money/deleted-items", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "budget_item",
          id: item.id,
        }),
      });

      await parseDeletedItemsResponse(response);

      removeBudgetAreaFromDraft(item.category_key);
      setDeleteBudgetAreaPopup(null);
    } catch (error: any) {
      setAuditLogError(
        error?.message || "Could not soft delete the budget tracker item.",
      );
    } finally {
      setDeletingBudgetArea(false);
    }
  }

  async function saveBudget() {
    const beforeItems = cleanBudgetItemsForSave(budgetItems);
    const editorName =
      editorDetails?.name || nameFromEmail(editorDetails?.email) || null;
    const editorEmail = editorDetails?.email || null;
    const afterItems = cleanBudgetItemsForSave(draftItems).map((item) => ({
      ...item,
      updated_by: editorName,
      updated_by_email: editorEmail,
    }));
    const auditPayload = buildBudgetAuditPayload(beforeItems, afterItems);

    setAuditLogError(null);

    try {
      await onSaveBudget(afterItems);
    } catch (error: any) {
      const message =
        error?.message ||
        "Budget could not be saved. Please check the console/server logs.";

      setAuditLogError(message);
      console.error("Failed to save budget:", error);
      return;
    }

    const auditResult = await createBudgetAuditLog(
      selectedYear,
      auditPayload,
      editorDetails,
    );

    if (!auditResult.ok) {
      setAuditLogError(
        auditResult.error ||
          "Budget saved, but the audit log could not be created.",
      );
      return;
    }

    setDraftItems(afterItems);
    setDraftAmountInputs(buildBudgetAmountInputs(afterItems));
    setDraftActualInputs(buildBudgetActualInputs(afterItems));
    setNewBudgetName("");
    setNewBudgetError(null);
    setAuditLogError(null);
    setEditing(false);
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
      {superEasyMode ? (
        <div className="space-y-5">
          <div className="rounded-3xl border border-emerald-300/25 bg-emerald-500/10 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-black/20 px-3 py-2 text-xs font-black uppercase tracking-wide text-emerald-100">
                  <Sparkles className="h-4 w-4" />
                  Super Easy Mode
                </div>

                <h2 className="mt-3 text-2xl font-black text-white">
                  Simple budget planner
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-100/75">
                  This view only shows the main numbers. Use the large buttons
                  below to change your budget or update your saving target.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSuperEasyMode(false)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-black transition hover:bg-emerald-100"
              >
                Show Full Mode
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5">
              <p className="text-sm font-black text-emerald-100">Budget planned</p>
              <p className="mt-2 text-3xl font-black text-white">
                {money(totals.planned)}
              </p>
            </div>

            <div className="rounded-3xl border border-red-300/20 bg-red-500/10 p-5">
              <p className="text-sm font-black text-red-100">Money spent</p>
              <p className="mt-2 text-3xl font-black text-white">
                {money(totals.actual)}
              </p>
            </div>

            <div
              className={`rounded-3xl border p-5 ${
                totals.remaining >= 0
                  ? "border-sky-300/20 bg-sky-500/10"
                  : "border-red-300/20 bg-red-500/10"
              }`}
            >
              <p className="text-sm font-black text-white/75">Money left</p>
              <p
                className={`mt-2 text-3xl font-black ${
                  totals.remaining >= 0 ? "text-sky-100" : "text-red-100"
                }`}
              >
                {money(totals.remaining)}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-black text-white">
                  Your budget areas
                </h3>
                <p className="mt-1 text-sm leading-6 text-white/60">
                  Set how much you plan to spend in each area.
                </p>
              </div>

              {!editing ? (
                <button
                  type="button"
                  onClick={startSuperEasyEditing}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-500 px-5 py-3 text-sm font-black text-white transition hover:bg-pink-400"
                >
                  <Edit3 className="h-4 w-4" />
                  Change Budget Amounts
                </button>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={savingBudget}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={saveBudget}
                    disabled={savingBudget}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {savingBudget ? "Saving..." : "Save Budget"}
                  </button>
                </div>
              )}
            </div>

            {auditLogError ? (
              <div className="mt-4 rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-sm text-red-100">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="whitespace-pre-wrap break-words leading-6">
                    {auditLogError}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-300/20">
                  <Plus className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-base font-black text-white">
                    Add a new budget area
                  </h4>

                  <p className="mt-1 text-xs leading-5 text-emerald-100/70">
                    Add another area such as First Aid, Toilets, Stage,
                    Marketing, Gazebos, or Volunteer costs.
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={newBudgetName}
                  onChange={(event) => {
                    setNewBudgetName(event.target.value);
                    setNewBudgetError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addBudgetArea();
                    }
                  }}
                  placeholder="Example: First Aid"
                  className="min-w-0 flex-1 rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-emerald-300/20 placeholder:text-white/35 focus:ring-emerald-300/50"
                />

                <button
                  type="button"
                  onClick={addBudgetArea}
                  disabled={savingBudget}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Add Budget Area
                </button>
              </div>

              {newBudgetError ? (
                <p className="mt-3 rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100">
                  {newBudgetError}
                </p>
              ) : null}

              {!editing ? (
                <p className="mt-3 rounded-xl bg-black/20 px-3 py-2 text-xs leading-5 text-emerald-100/75">
                  Adding a new area will open editing automatically. Enter its
                  budget amount, then press Save Budget.
                </p>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((item) => {
                const overBudget = item.remainingPence < 0;

                return (
                  <div
                    key={item.category_key}
                    className={`rounded-2xl border p-4 ${
                      overBudget
                        ? "border-red-300/30 bg-red-500/10"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-white/45" />
                      <p className="font-black text-white">
                        {item.category_label}
                      </p>
                    </div>

                    {editing ? (
                      <label className="mt-3 block">
                        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-white/55">
                          Planned amount
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-white">£</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={draftAmountInputs[item.category_key] ?? ""}
                            onChange={(event) =>
                              updateDraftPlannedAmount(
                                item.category_key,
                                event.target.value,
                              )
                            }
                            onBlur={() =>
                              formatDraftPlannedAmount(item.category_key)
                            }
                            placeholder="0.00"
                            className="w-full rounded-xl bg-black/30 p-3 text-lg font-black text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/50"
                          />
                        </div>
                      </label>
                    ) : (
                      <p className="mt-3 text-2xl font-black text-white">
                        {money(item.planned_amount_pence)}
                      </p>
                    )}

                    {editing ? (
                      <div className="mt-3 rounded-xl border border-sky-300/20 bg-sky-500/10 p-3">
                        <label className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={item.manualActualEnabled}
                            onChange={(event) =>
                              toggleManualActualAmount(
                                item.category_key,
                                event.target.checked,
                              )
                            }
                            className="mt-1 h-4 w-4 rounded border-white/20"
                          />

                          <span>
                            <span className="block text-xs font-black uppercase tracking-wide text-sky-100">
                              Manually set spent amount
                            </span>
                            <span className="mt-1 block text-xs text-sky-100/70">
                              Auto from transactions: {money(item.autoActualPence)}
                            </span>
                          </span>
                        </label>

                        {item.manualActualEnabled ? (
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-lg font-black text-white">£</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={draftActualInputs[item.category_key] ?? ""}
                              onChange={(event) =>
                                updateDraftActualAmount(
                                  item.category_key,
                                  event.target.value,
                                )
                              }
                              onBlur={() =>
                                formatDraftActualAmount(item.category_key)
                              }
                              placeholder="0.00"
                              className="w-full rounded-xl bg-black/30 p-3 text-lg font-black text-white outline-none ring-1 ring-white/10 focus:ring-sky-300/50"
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-3 space-y-1 text-sm text-white/65">
                      <p>
                        Spent: <strong className="text-white">{money(item.actualPence)}</strong>
                        {item.manualActualEnabled ? (
                          <span className="ml-2 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-sky-100 ring-1 ring-sky-300/20">
                            Manual
                          </span>
                        ) : (
                          <span className="ml-2 text-xs text-white/40">Auto</span>
                        )}
                      </p>
                      <p>
                        Left:{" "}
                        <strong
                          className={
                            overBudget ? "text-red-100" : "text-emerald-100"
                          }
                        >
                          {money(item.remainingPence)}
                        </strong>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setSuperEasyMode(false);
                setIsOpen(true);
              }}
              className="mt-4 w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
            >
              Open advanced budget settings
            </button>
          </div>

          <div className="rounded-3xl border border-sky-300/20 bg-sky-500/10 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-black/20 px-3 py-2 text-xs font-black uppercase tracking-wide text-sky-100">
                  <Target className="h-4 w-4" />
                  Simple saving target
                </div>
                <h3 className="mt-3 text-xl font-black text-white">
                  Save money for something important
                </h3>
                <p className="mt-1 text-sm leading-6 text-sky-100/70">
                  Enter the amount you need and how many months you have.
                </p>
              </div>

              <button
                type="button"
                onClick={saveSelectedSavingTarget}
                disabled={savingTargetSaving || savingTargetLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-black transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {savingTargetSaving ? "Saving..." : "Save Target"}
              </button>
            </div>

            {savingTargetError ? (
              <div className="mt-4 rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
                {savingTargetError}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <span className="mb-2 block text-sm font-black text-sky-100">
                  What are you saving for?
                </span>
                <input
                  type="text"
                  value={selectedSavingTarget.name}
                  onChange={(event) =>
                    updateSavingTarget("name", event.target.value)
                  }
                  placeholder="Example: Insurance"
                  className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-sky-300/50"
                />
              </label>

              <label className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <span className="mb-2 block text-sm font-black text-sky-100">
                  How much do you need?
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-white">£</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={selectedSavingTarget.targetAmount}
                    onChange={(event) =>
                      updateSavingTarget("targetAmount", event.target.value)
                    }
                    placeholder="1000"
                    className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-sky-300/50"
                  />
                </div>
              </label>

              <label className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <span className="mb-2 block text-sm font-black text-sky-100">
                  How much have you saved?
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-white">£</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={selectedSavingTarget.currentSaved}
                    onChange={(event) =>
                      updateSavingTarget("currentSaved", event.target.value)
                    }
                    placeholder="0"
                    className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-sky-300/50"
                  />
                </div>
              </label>

              <label className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <span className="mb-2 block text-sm font-black text-sky-100">
                  How many months?
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={selectedSavingTarget.months}
                  onChange={(event) =>
                    updateSavingTarget("months", event.target.value)
                  }
                  placeholder="6"
                  className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-sky-300/50"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-black text-sky-100">Still to save</p>
                <p className="mt-2 text-2xl font-black text-white">
                  {money(savingTargetTotals.remainingToSavePence)}
                </p>
              </div>

              <div className="rounded-2xl border border-purple-300/20 bg-purple-500/10 p-4">
                <p className="text-sm font-black text-purple-100">
                  Save each month
                </p>
                <p className="mt-2 text-2xl font-black text-white">
                  {savingTargetTotals.months > 0
                    ? money(savingTargetTotals.monthlyRequiredPence)
                    : "Add months"}
                </p>
              </div>

              <button
                type="button"
                onClick={addCurrentSavedFromMonthlyAmount}
                disabled={
                  savingTargetTotals.monthlyRequiredPence <= 0 ||
                  savingTargetSaving ||
                  savingTargetLoading
                }
                className="inline-flex min-h-[92px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 text-base font-black text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Calculator className="h-5 w-5" />
                Add One Month Saved
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSuperEasyMode(false)}
              className="mt-4 w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
            >
              Manage more saving targets in Full Mode
            </button>
          </div>
        </div>
      ) : (
        <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-100">
            <PiggyBank className="h-4 w-4" />
            Budget planning
          </div>

          <h2 className="break-words text-2xl font-black text-white">
            Planned budget vs actual spending
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
            Plan your expected costs for {selectedYear}, then compare them
            against real spending from your transactions.
          </p>

          <div className="mt-3 inline-flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-pink-300/20 bg-pink-500/10 px-3 py-2 text-xs text-pink-100">
            <span className="font-black text-white">Editing as:</span>
            <span className="font-bold">
              {editorDetails?.name ||
                nameFromEmail(editorDetails?.email) ||
                "Signed-in admin"}
            </span>
            {editorDetails?.email && (
              <span className="break-all text-pink-100/70">
                {editorDetails.email}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSuperEasyMode(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-black hover:bg-emerald-400"
          >
            <Sparkles className="h-4 w-4" />
            Use Super Easy Mode
          </button>

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
          >
            {isOpen ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Hide details
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show details
              </>
            )}
          </button>

          {!editing && (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-500 px-4 py-3 text-sm font-black text-white hover:bg-pink-400"
            >
              <Edit3 className="h-4 w-4" />
              Edit budget
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-100">
            Planned
          </p>
          <p className="mt-2 text-2xl font-black text-white">
            {money(totals.planned)}
          </p>
        </div>

        <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-red-100">
            Actual spent
          </p>
          <p className="mt-2 text-2xl font-black text-white">
            {money(totals.actual)}
          </p>
        </div>

        <div
          className={`rounded-2xl border p-4 ${
            totals.remaining >= 0
              ? "border-sky-300/20 bg-sky-500/10"
              : "border-red-300/20 bg-red-500/10"
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-wide text-white/60">
            Remaining
          </p>
          <p
            className={`mt-2 text-2xl font-black ${
              totals.remaining >= 0 ? "text-sky-100" : "text-red-100"
            }`}
          >
            {money(totals.remaining)}
          </p>
        </div>

        <div className="rounded-2xl border border-purple-300/20 bg-purple-500/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-purple-100">
            Budget used
          </p>
          <p className="mt-2 text-2xl font-black text-white">
            {totals.percentUsed}%
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-sky-300/20 bg-sky-500/10 p-4 ring-1 ring-sky-300/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-black/20 px-3 py-2 text-xs font-black uppercase tracking-wide text-sky-100">
              <Target className="h-4 w-4" />
              Saving target planner
            </div>

            <h3 className="mt-3 text-xl font-black text-white">
              Create saving targets for different things
            </h3>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-sky-100/70">
              Add separate targets for things like insurance, pitch hire, stage,
              security, or emergency savings. Each target works out how much to
              put away each month.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/Admin/MoneyManagement/TrackingMoney/BudgetPlanning/Delete"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/15 px-4 py-3 text-sm font-black text-red-100 ring-1 ring-red-300/20 hover:bg-red-500/25"
            >
              <Trash2 className="h-4 w-4" />
              View deleted items
            </Link>

            <button
              type="button"
              onClick={clearSavingTarget}
              disabled={savingTargetSaving || savingTargetLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="h-4 w-4" />
              Clear selected target
            </button>
          </div>
        </div>

        {(savingTargetLoading || savingTargetError) && (
          <div
            className={`mt-4 rounded-2xl border p-4 text-sm ${
              savingTargetError
                ? "border-red-300/30 bg-red-500/10 text-red-100"
                : "border-sky-300/20 bg-sky-500/10 text-sky-100"
            }`}
          >
            {savingTargetError ? (
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-black text-white">Saving target error</p>
                  <p className="mt-2 whitespace-pre-wrap break-words leading-6 text-red-100/90">
                    {savingTargetError}
                  </p>
                </div>
              </div>
            ) : (
              "Loading saving targets from the database..."
            )}
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
          <label className="mb-2 block text-sm font-black text-emerald-100">
            Add another saving target
          </label>

          <p className="mb-3 text-xs leading-5 text-emerald-100/70">
            Example targets: Public liability insurance, pitch hire, stage,
            performers, security, printing, or emergency reserve.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={newSavingTargetName}
              onChange={(event) => {
                setNewSavingTargetName(event.target.value);
                setSavingTargetError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSavingTarget();
                }
              }}
              placeholder="Example: Public liability insurance"
              className="min-w-0 flex-1 rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-emerald-300/20 placeholder:text-white/35 focus:ring-emerald-300/50"
            />

            <button
              type="button"
              onClick={addSavingTarget}
              disabled={savingTargetSaving || savingTargetLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Add target
            </button>
          </div>

          {savingTargetError && (
            <p className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-100">
              {savingTargetError}
            </p>
          )}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {savingTargetSummaries.map((target) => {
            const active = target.id === selectedSavingTarget.id;

            return (
              <button
                key={target.id}
                type="button"
                onClick={() => setSelectedSavingTargetId(target.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-sky-300/40 bg-sky-400/15 ring-2 ring-sky-300/30"
                    : "border-white/10 bg-black/20 hover:bg-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-black text-white">
                      {target.name || "Saving target"}
                    </p>

                    <p className="mt-1 text-xs text-sky-100/65">
                      {money(target.currentSavedPence)} saved of{" "}
                      {money(target.targetPence)}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-xs font-black text-white">
                    {target.progressPercent}%
                  </span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-sky-300"
                    style={{ width: `${target.progressPercent}%` }}
                  />
                </div>

                <p className="mt-2 text-xs text-sky-100/65">
                  Still to save: {money(target.remainingToSavePence)}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-sky-100/60">
              Editing selected target
            </p>
            <p className="mt-1 break-words text-lg font-black text-white">
              {selectedSavingTarget.name || "Saving target"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => openDeleteSavingTargetPopup(selectedSavingTarget)}
            disabled={savingTargetSaving || savingTargetLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/15 px-4 py-3 text-sm font-black text-red-100 ring-1 ring-red-300/20 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Delete selected target
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-sky-100/75">
            Changes to the selected saving target are saved to Supabase when you press Save selected target.
          </p>

          <button
            type="button"
            onClick={saveSelectedSavingTarget}
            disabled={savingTargetSaving || savingTargetLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-black hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {savingTargetSaving ? "Saving target..." : "Save selected target"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          <label className="block rounded-2xl border border-white/10 bg-black/20 p-3">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-sky-100/70">
              Target name
            </span>
            <input
              type="text"
              value={selectedSavingTarget.name}
              onChange={(event) =>
                updateSavingTarget("name", event.target.value)
              }
              placeholder="Example: Insurance"
              className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-sky-300/50"
            />
          </label>

          <label className="block rounded-2xl border border-white/10 bg-black/20 p-3">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-sky-100/70">
              Target amount
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={selectedSavingTarget.targetAmount}
              onChange={(event) =>
                updateSavingTarget("targetAmount", event.target.value)
              }
              placeholder="Example: 1000"
              className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-sky-300/50"
            />
          </label>

          <label className="block rounded-2xl border border-white/10 bg-black/20 p-3">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-sky-100/70">
              Already saved
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={selectedSavingTarget.currentSaved}
              onChange={(event) =>
                updateSavingTarget("currentSaved", event.target.value)
              }
              placeholder="Example: 150"
              className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-sky-300/50"
            />
          </label>

          <label className="block rounded-2xl border border-white/10 bg-black/20 p-3">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-sky-100/70">
              How many months?
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={selectedSavingTarget.months}
              onChange={(event) =>
                updateSavingTarget("months", event.target.value)
              }
              placeholder="Example: 6"
              className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-sky-300/50"
            />
          </label>

          <label className="block rounded-2xl border border-white/10 bg-black/20 p-3">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-sky-100/70">
              Target note
            </span>
            <input
              type="text"
              value={selectedSavingTarget.note}
              onChange={(event) =>
                updateSavingTarget("note", event.target.value)
              }
              placeholder="Example: Needs paying before June"
              className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-sky-300/50"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-sky-300/20 bg-black/20 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-sky-100/70">
              Target
            </p>
            <p className="mt-2 text-2xl font-black text-white">
              {money(savingTargetTotals.targetPence)}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-100/70">
              Still to save
            </p>
            <p className="mt-2 text-2xl font-black text-white">
              {money(savingTargetTotals.remainingToSavePence)}
            </p>
          </div>

          <div className="rounded-2xl border border-purple-300/20 bg-purple-500/10 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-purple-100/70">
              Put away monthly
            </p>
            <p className="mt-2 text-2xl font-black text-white">
              {savingTargetTotals.months > 0
                ? money(savingTargetTotals.monthlyRequiredPence)
                : "Set months"}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-100/70">
              Monthly guide
            </p>
            <p className="mt-2 text-2xl font-black text-white">
              {savingTargetTotals.months > 0
                ? money(savingTargetTotals.monthlyRequiredPence)
                : "Set months"}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wide text-sky-100/70">
                <span>
                  Progress for {selectedSavingTarget.name || "selected target"}
                </span>
                <span>{savingTargetTotals.progressPercent}%</span>
              </div>

              <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-sky-300"
                  style={{ width: `${savingTargetTotals.progressPercent}%` }}
                />
              </div>

              {hasSavingTarget ? (
                <p className="mt-3 text-sm leading-6 text-sky-100/75">
                  {savingTargetTotals.months > 0 ? (
                    <>
                      To reach {money(savingTargetTotals.targetPence)} for{" "}
                      <strong className="text-white">
                        {selectedSavingTarget.name || "this target"}
                      </strong>{" "}
                      in {savingTargetTotals.months} month
                      {savingTargetTotals.months === 1 ? "" : "s"}, put away{" "}
                      <strong className="text-white">
                        {money(savingTargetTotals.monthlyRequiredPence)}
                      </strong>{" "}
                      every month.
                    </>
                  ) : (
                    <>
                      Enter how many months you have to calculate the monthly
                      saving amount.
                    </>
                  )}
                </p>
              ) : (
                <p className="mt-3 text-sm leading-6 text-sky-100/65">
                  Add a target amount to start the selected saving plan.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={addCurrentSavedFromMonthlyAmount}
              disabled={
                savingTargetTotals.monthlyRequiredPence <= 0 ||
                savingTargetSaving ||
                savingTargetLoading
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-black hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Calculator className="h-4 w-4" />
              Add one month saved
            </button>
          </div>
        </div>
      </div>

      {!isOpen && hasOverBudgetRows && (
        <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">
          Some cost areas are over budget. Open details to check the rows before
          approving more spending.
        </div>
      )}

      {isOpen && (
        <div className="mt-5 space-y-5">
          {editing && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                <label className="mb-2 block text-sm font-black text-emerald-100">
                  Add another budget area
                </label>

                <p className="mb-3 text-xs leading-5 text-emerald-100/70">
                  Add extra cost areas such as First Aid, Toilets, Stage,
                  Marketing, Gazebos, or Volunteer costs.
                </p>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={newBudgetName}
                    onChange={(event) => {
                      setNewBudgetName(event.target.value);
                      setNewBudgetError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addBudgetArea();
                      }
                    }}
                    placeholder="Example: First Aid"
                    className="min-w-0 flex-1 rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-emerald-300/20 placeholder:text-white/35 focus:ring-emerald-300/50"
                  />

                  <button
                    type="button"
                    onClick={addBudgetArea}
                    disabled={savingBudget}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    Add budget area
                  </button>
                </div>

                {newBudgetError && (
                  <p className="mt-2 rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                    {newBudgetError}
                  </p>
                )}
              </div>

              {auditLogError && (
                <div className="rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-sm text-red-100">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

                    <div className="min-w-0">
                      <p className="font-black text-white">
                        Budget audit log error
                      </p>

                      <p className="mt-1 whitespace-pre-wrap break-words leading-6 text-red-100/85">
                        {auditLogError}
                      </p>

                      <p className="mt-2 text-xs leading-5 text-red-100/70">
                        If this says 405, update
                        app/api/admin/money/audit-logs/route.ts so it includes
                        export async function POST(request: Request).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={saveBudget}
                  disabled={savingBudget}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {savingBudget ? "Saving..." : "Save budget"}
                </button>

                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={savingBudget}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1220px] text-left text-sm">
                <thead className="bg-white/10 text-xs uppercase tracking-wide text-white/60">
                  <tr>
                    <th className="px-4 py-3">Cost area</th>
                    <th className="px-4 py-3">Planned budget</th>
                    <th className="px-4 py-3">Actual spending</th>
                    <th className="px-4 py-3">Remaining</th>
                    <th className="px-4 py-3">Used</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Updated by</th>
                    {editing && <th className="px-4 py-3">Action</th>}
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {rows.map((item) => {
                    const overBudget = item.remainingPence < 0;
                    const customBudgetArea = !isDefaultBudgetKey(
                      item.category_key,
                    );

                    return (
                      <tr key={item.category_key} className="bg-black/10">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4 text-white/45" />

                            {editing && customBudgetArea ? (
                              <input
                                type="text"
                                value={item.category_label}
                                onChange={(event) =>
                                  updateDraft(
                                    item.category_key,
                                    "category_label",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-xl bg-black/30 p-2 font-black text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
                              />
                            ) : (
                              <span className="font-black text-white">
                                {item.category_label}
                              </span>
                            )}

                            {customBudgetArea && (
                              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-100 ring-1 ring-emerald-300/20">
                                Custom
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={draftAmountInputs[item.category_key] ?? ""}
                              onChange={(event) =>
                                updateDraftPlannedAmount(
                                  item.category_key,
                                  event.target.value,
                                )
                              }
                              onBlur={() =>
                                formatDraftPlannedAmount(item.category_key)
                              }
                              placeholder="0.00"
                              className="w-32 rounded-xl bg-black/30 p-2 text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
                            />
                          ) : (
                            <span className="font-bold text-white">
                              {money(item.planned_amount_pence)}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {editing ? (
                            <div className="min-w-[190px] space-y-2">
                              <label className="flex items-start gap-2 text-xs font-bold text-white/70">
                                <input
                                  type="checkbox"
                                  checked={item.manualActualEnabled}
                                  onChange={(event) =>
                                    toggleManualActualAmount(
                                      item.category_key,
                                      event.target.checked,
                                    )
                                  }
                                  className="mt-0.5 h-4 w-4 rounded border-white/20"
                                />
                                <span>
                                  Manual actual
                                  <span className="block font-normal text-white/40">
                                    Auto: {money(item.autoActualPence)}
                                  </span>
                                </span>
                              </label>

                              {item.manualActualEnabled ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  inputMode="decimal"
                                  value={draftActualInputs[item.category_key] ?? ""}
                                  onChange={(event) =>
                                    updateDraftActualAmount(
                                      item.category_key,
                                      event.target.value,
                                    )
                                  }
                                  onBlur={() =>
                                    formatDraftActualAmount(item.category_key)
                                  }
                                  placeholder="0.00"
                                  className="w-36 rounded-xl bg-black/30 p-2 text-white outline-none ring-1 ring-white/10 focus:ring-sky-300/40"
                                />
                              ) : null}
                            </div>
                          ) : (
                            <div className="font-bold text-white">
                              {money(item.actualPence)}
                              {item.manualActualEnabled ? (
                                <span className="ml-2 rounded-full bg-sky-500/15 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-sky-100 ring-1 ring-sky-300/20">
                                  Manual
                                </span>
                              ) : (
                                <span className="ml-2 text-xs font-semibold text-white/35">
                                  Auto
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td
                          className={`px-4 py-4 font-black ${
                            overBudget ? "text-red-200" : "text-emerald-200"
                          }`}
                        >
                          {money(item.remainingPence)}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                              <div
                                className={`h-full rounded-full ${
                                  overBudget ? "bg-red-400" : "bg-emerald-400"
                                }`}
                                style={{
                                  width: `${Math.min(item.percentUsed, 100)}%`,
                                }}
                              />
                            </div>

                            <span className="font-bold text-white/75">
                              {item.percentUsed}%
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          {editing ? (
                            <input
                              type="text"
                              value={getBudgetPublicNotes(item)}
                              onChange={(event) =>
                                updateDraft(
                                  item.category_key,
                                  "notes",
                                  event.target.value,
                                )
                              }
                              placeholder="Add note"
                              className="w-full rounded-xl bg-black/30 p-2 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-pink-300/40"
                            />
                          ) : getBudgetPublicNotes(item) ? (
                            <span className="text-white/70">{getBudgetPublicNotes(item)}</span>
                          ) : (
                            <span className="text-white/30">No notes</span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <div className="max-w-[220px] rounded-xl bg-pink-500/10 px-3 py-2 text-xs ring-1 ring-pink-300/15">
                            <p className="font-black text-white">
                              {editing
                                ? editorDetails?.name ||
                                  nameFromEmail(editorDetails?.email) ||
                                  budgetEditorDisplayName(item, editorDetails)
                                : budgetEditorDisplayName(item, editorDetails)}
                            </p>

                            {(editing
                              ? editorDetails?.email ||
                                budgetEditorDisplayEmail(item, editorDetails)
                              : budgetEditorDisplayEmail(
                                  item,
                                  editorDetails,
                                )) && (
                              <p className="mt-1 break-all text-pink-100/65">
                                {editing
                                  ? editorDetails?.email ||
                                    budgetEditorDisplayEmail(
                                      item,
                                      editorDetails,
                                    )
                                  : budgetEditorDisplayEmail(
                                      item,
                                      editorDetails,
                                    )}
                              </p>
                            )}

                            {editing && (
                              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-pink-100/45">
                                Will save under this user
                              </p>
                            )}
                          </div>
                        </td>

                        {editing && (
                          <td className="px-4 py-4">
                            {customBudgetArea ? (
                              <button
                                type="button"
                                onClick={() => openDeleteBudgetAreaPopup(item)}
                                disabled={savingBudget}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-black text-red-100 ring-1 ring-red-300/20 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remove
                              </button>
                            ) : (
                              <span className="text-xs text-white/30">
                                Default
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {hasOverBudgetRows && (
            <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">
              <CheckCircle2 className="mb-2 h-5 w-5" />
              Some cost areas are over budget. Check the rows marked in red
              before approving more spending.
            </div>
          )}
        </div>
      )}

        </>
      )}

      {deleteBudgetAreaPopup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-red-300/30 bg-[#11111f] p-5 text-white shadow-2xl shadow-black/50">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-200 ring-1 ring-red-300/30">
                <Trash2 className="h-6 w-6" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-black text-white">
                  Soft delete budget tracker item?
                </h3>

                <p className="mt-2 text-sm leading-6 text-white/70">
                  This will remove the budget area from the Budget Tracker page,
                  but it will not be permanently deleted from Supabase.
                </p>

                <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-red-100/70">
                    Selected budget area
                  </p>

                  <p className="mt-1 break-words text-lg font-black text-white">
                    {deleteBudgetAreaPopup.category_label || "Budget area"}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-red-100/80">
                    Planned budget:{" "}
                    <strong className="text-white">
                      {money(deleteBudgetAreaPopup.planned_amount_pence || 0)}
                    </strong>
                  </p>
                </div>

                <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-50">
                  <p className="font-black text-white">
                    This is a soft delete.
                  </p>

                  <p className="mt-1">
                    The API route{" "}
                    <strong>/api/admin/money/deleted-items</strong> will be
                    called with <strong>DELETE</strong>. The database row will
                    stay in your budget tracker table and the API will set{" "}
                    <strong>deleted_at</strong>, <strong>deleted_by</strong>,{" "}
                    <strong>deleted_by_email</strong>, and{" "}
                    <strong>deleted_by_user_id</strong>. The deleted item can
                    then show on the deleted items page and be restored.
                  </p>

                  {!deleteBudgetAreaPopup.id && (
                    <p className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-amber-100/80">
                      This budget area has not been saved to Supabase yet, so
                      it will only be removed from this draft.
                    </p>
                  )}
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeDeleteBudgetAreaPopup}
                    disabled={deletingBudgetArea}
                    className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={confirmSoftDeleteBudgetArea}
                    disabled={deletingBudgetArea}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deletingBudgetArea
                      ? "Soft deleting..."
                      : "Yes, soft delete budget area"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteSavingTargetPopup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-red-300/30 bg-[#11111f] p-5 text-white shadow-2xl shadow-black/50">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-200 ring-1 ring-red-300/30">
                <Trash2 className="h-6 w-6" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-black text-white">
                  Soft delete saving target?
                </h3>

                <p className="mt-2 text-sm leading-6 text-white/70">
                  This will remove the saving target from the Budget Planning
                  page, but it will not be permanently deleted from Supabase.
                </p>

                <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-red-100/70">
                    Selected saving target
                  </p>

                  <p className="mt-1 break-words text-lg font-black text-white">
                    {deleteSavingTargetPopup.name || "Saving target"}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-red-100/80">
                    Target:{" "}
                    <strong className="text-white">
                      {money(inputToPence(deleteSavingTargetPopup.targetAmount))}
                    </strong>{" "}
                    · Saved:{" "}
                    <strong className="text-white">
                      {money(inputToPence(deleteSavingTargetPopup.currentSaved))}
                    </strong>
                  </p>
                </div>

                <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-50">
                  <p className="font-black text-white">
                    This is a soft delete.
                  </p>

                  <p className="mt-1">
                    The database row will stay in{" "}
                    <strong>money_saving_targets</strong>. The API will set{" "}
                    <strong>deleted_at</strong>, <strong>deleted_by</strong>,{" "}
                    <strong>deleted_by_email</strong>, and{" "}
                    <strong>deleted_by_user_id</strong>, then normal loading
                    will hide it from this page.
                  </p>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeDeleteSavingTargetPopup}
                    disabled={savingTargetSaving}
                    className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={confirmSoftDeleteSavingTarget}
                    disabled={savingTargetSaving}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    {savingTargetSaving
                      ? "Soft deleting..."
                      : "Yes, soft delete target"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
