"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  PiggyBank,
  Plus,
  Save,
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
  notes?: string | null;
  updated_by?: string | null;
  updated_by_email?: string | null;
  updated_by_user_id?: string | null;
};

type BudgetRow = BudgetItem & {
  actualPence: number;
  remainingPence: number;
  percentUsed: number;
};

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
  return String(value || "").trim();
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
      notes: item.notes || "",
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

function getBudgetItemEditor(item: BudgetItem, currentEditor: BudgetEditor | null) {
  const savedName = cleanEditorValue(item.updated_by);
  const savedEmail = cleanEditorValue(item.updated_by_email);
  const currentName = cleanEditorValue(currentEditor?.name);
  const currentEmail = cleanEditorValue(currentEditor?.email);

  const name = savedName || nameFromEmail(savedEmail) || currentName || nameFromEmail(currentEmail);
  const email = savedEmail || currentEmail;

  return {
    name: name || null,
    email: email || null,
  };
}

function budgetEditorDisplayName(item: BudgetItem, currentEditor: BudgetEditor | null) {
  const editor = getBudgetItemEditor(item, currentEditor);

  return editor.name || editor.email || "Not recorded yet";
}

function budgetEditorDisplayEmail(item: BudgetItem, currentEditor: BudgetEditor | null) {
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
  const endpoints = [
    "/api/admin/me/permissions",
  ];

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
    return [
      "Audit log failed because the server returned an error.",
      details,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    `Audit log failed with status ${status}.`,
    details,
  ]
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
  const [editing, setEditing] = useState(false);
  const [draftItems, setDraftItems] = useState<BudgetItem[]>(budgetItems);
  const [newBudgetName, setNewBudgetName] = useState("");
  const [newBudgetError, setNewBudgetError] = useState<string | null>(null);
  const [auditLogError, setAuditLogError] = useState<string | null>(null);
  const [editorDetails, setEditorDetails] = useState<BudgetEditor | null>(() => {
    const name =
      cleanEditorValue(currentAdminName) || nameFromEmail(currentAdminEmail);
    const email = cleanEditorValue(currentAdminEmail);

    return name || email
      ? {
          name,
          email,
        }
      : null;
  });

  useEffect(() => {
    setDraftItems(budgetItems);
  }, [budgetItems]);

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
      const actualPence = actuals[item.category_key] || 0;
      const plannedPence = Number(item.planned_amount_pence || 0);
      const remainingPence = plannedPence - actualPence;
      const percentUsed =
        plannedPence > 0 ? Math.round((actualPence / plannedPence) * 100) : 0;

      return {
        ...item,
        actualPence,
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

  const hasOverBudgetRows = rows.some((item) => item.remainingPence < 0);

  function startEditing() {
    setDraftItems(budgetItems);
    setNewBudgetName("");
    setNewBudgetError(null);
    setAuditLogError(null);
    setEditing(true);
    setIsOpen(true);
  }

  function cancelEditing() {
    setDraftItems(budgetItems);
    setNewBudgetName("");
    setNewBudgetError(null);
    setAuditLogError(null);
    setEditing(false);
  }

  function updateDraft(
    categoryKey: string,
    field: "planned_amount_pence" | "notes" | "category_label",
    value: string,
  ) {
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.category_key !== categoryKey) return item;

        return {
          ...item,
          [field]:
            field === "planned_amount_pence" ? inputToPence(value) : value,
        };
      }),
    );
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
      updated_by: editorDetails?.name || nameFromEmail(editorDetails?.email) || null,
      updated_by_email: editorDetails?.email || null,
    };

    setDraftItems((prev) => {
      if (otherIndex === -1) {
        return [...prev, newItem];
      }

      return [...prev.slice(0, otherIndex), newItem, ...prev.slice(otherIndex)];
    });

    setNewBudgetName("");
    setNewBudgetError(null);
    setAuditLogError(null);
  }

  function removeBudgetArea(categoryKey: string) {
    setDraftItems((prev) =>
      prev.filter((item) => item.category_key !== categoryKey),
    );
  }

  async function saveBudget() {
    const beforeItems = cleanBudgetItemsForSave(budgetItems);
    const editorName = editorDetails?.name || nameFromEmail(editorDetails?.email) || null;
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
    setNewBudgetName("");
    setNewBudgetError(null);
    setAuditLogError(null);
    setEditing(false);
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
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
                              value={penceToInput(item.planned_amount_pence)}
                              onChange={(event) =>
                                updateDraft(
                                  item.category_key,
                                  "planned_amount_pence",
                                  event.target.value,
                                )
                              }
                              className="w-32 rounded-xl bg-black/30 p-2 text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
                            />
                          ) : (
                            <span className="font-bold text-white">
                              {money(item.planned_amount_pence)}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4 font-bold text-white">
                          {money(item.actualPence)}
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
                              value={item.notes || ""}
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
                          ) : item.notes ? (
                            <span className="text-white/70">{item.notes}</span>
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
                              ? editorDetails?.email || budgetEditorDisplayEmail(item, editorDetails)
                              : budgetEditorDisplayEmail(item, editorDetails)) && (
                              <p className="mt-1 break-all text-pink-100/65">
                                {editing
                                  ? editorDetails?.email || budgetEditorDisplayEmail(item, editorDetails)
                                  : budgetEditorDisplayEmail(item, editorDetails)}
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
                                onClick={() =>
                                  removeBudgetArea(item.category_key)
                                }
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
    </section>
  );
}
