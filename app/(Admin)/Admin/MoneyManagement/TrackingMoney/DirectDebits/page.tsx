"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  BadgePoundSterling,
  Banknote,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CirclePause,
  CirclePlay,
  CreditCard,
  FileSpreadsheet,
  FileUp,
  Filter,
  Loader2,
  Plus,
  Pencil,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  HandCoins,
  WalletCards,
  X,
} from "lucide-react";

import useAdmin from "../../../components/AdminAuditTracker";
import type {
  DirectDebitAccountSource,
  DirectDebitOccurrenceStatus,
  DirectDebitPlan,
  DirectDebitStatus,
} from "@/lib/money/directDebit";

type DirectDebitOccurrence = {
  id: string;
  due_date: string;
  period_month?: string | null;
  status: DirectDebitOccurrenceStatus;
  transaction_id: string | null;
  payment_number: number;
  amount_pence: number;
  reimbursement_status?:
    | "not_required"
    | "awaiting_reimbursement"
    | "partially_reimbursed"
    | "reimbursed"
    | null;
  invoice_url?: string | null;
  invoice_file_name?: string | null;
  reimbursement_transaction_id?: string | null;
};

type DirectDebitPlanRow = DirectDebitPlan & {
  created_at?: string | null;
  updated_at?: string | null;
  budget_category_key?: string | null;
  budget_category_label?: string | null;
  collection_day?: number | null;
  payments_failed?: number | null;
  outstanding_reimbursement_pence?: number | null;
  auto_reimburse_person?: boolean | null;
  reimbursement_payment_method?: string | null;
  reimbursement_image_url?: string | null;
  reimbursement_image_file_name?: string | null;
  money_direct_debit_occurrences?: DirectDebitOccurrence[] | null;
};

type ListResponse = {
  success?: boolean;
  plans?: DirectDebitPlanRow[];
  error?: string;
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  transaction_id?: string | null;
  attachment?: {
    id?: string;
    transaction_id?: string;
    file_name?: string;
    file_url?: string | null;
    file_type?: string | null;
    file_size?: number | null;
  } | null;
};

type MoneyAuditStatus =
  | "success"
  | "failed"
  | "blocked"
  | "warning"
  | "pending"
  | "cancelled";

type MoneyAuditRisk = "low" | "medium" | "high" | "critical";

type MoneyAuditInput = {
  action: string;
  action_label: string;
  status?: MoneyAuditStatus;
  risk?: MoneyAuditRisk;
  module?: string;
  record_type?: string;
  record_id?: string | null;
  transaction_id?: string | null;
  direct_debit_plan_id?: string | null;
  direct_debit_occurrence_id?: string | null;
  summary: string;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

type CreateForm = {
  title: string;
  description: string;
  amount: string;
  first_collection_date: string;
  total_payments: string;
  is_open_ended: boolean;
  account_source: DirectDebitAccountSource;
  account_holder: string;
  supplier_id: string;
  supplier_name: string;
  budget_category_key: string;
  budget_category_label: string;
  mandate_reference: string;
  notes: string;
  auto_reimburse_person: boolean;
  reimbursement_payment_method: string;
};

type StatusFilter = "all" | DirectDebitStatus;
type AccountFilter = "all" | DirectDebitAccountSource;
type DueFilter = "all" | "due" | "overdue" | "personal_reimbursement";
type BusyAction = {
  planId: string;
  action: "pause" | "resume" | "cancel" | "post" | "edit" | "invoice" | "undo" | "reimburse" | "undo_reimburse";
} | null;

type Toast = {
  type: "success" | "error";
  message: string;
} | null;

type ConfirmModalState =
  | {
      kind: "post";
      plan: DirectDebitPlanRow;
      occurrence: DirectDebitOccurrence;
      invoiceFile: File | null;
      invoiceError: string;
    }
  | null;

type CancelModalState =
  | {
      plan: DirectDebitPlanRow;
      reason: string;
      error: string;
    }
  | null;

type EditPlanForm = {
  title: string;
  description: string;
  amount: string;
  account_source: DirectDebitAccountSource;
  account_holder: string;
  supplier_name: string;
  budget_category_key: string;
  budget_category_label: string;
  mandate_reference: string;
  notes: string;
  auto_reimburse_person: boolean;
  reimbursement_payment_method: string;
};

type EditModalState =
  | {
      plan: DirectDebitPlanRow;
      form: EditPlanForm;
      error: string;
    }
  | null;

type InvoiceModalState =
  | {
      plan: DirectDebitPlanRow;
      occurrence: DirectDebitOccurrence;
      file: File | null;
      error: string;
    }
  | null;

type UndoModalState =
  | {
      plan: DirectDebitPlanRow;
      occurrence: DirectDebitOccurrence;
      reason: string;
      error: string;
    }
  | null;

type ReimburseModalState =
  | {
      plan: DirectDebitPlanRow;
      occurrence: DirectDebitOccurrence;
      payment_method: string;
      reference: string;
      error: string;
    }
  | null;

type UndoReimbursementModalState =
  | {
      plan: DirectDebitPlanRow;
      occurrence: DirectDebitOccurrence;
      reason: string;
      delete_repayment_transaction: boolean;
      error: string;
    }
  | null;

const EMPTY_FORM: CreateForm = {
  title: "",
  description: "",
  amount: "",
  first_collection_date: "",
  total_payments: "12",
  is_open_ended: false,
  account_source: "organisation",
  account_holder: "",
  supplier_id: "",
  supplier_name: "",
  budget_category_key: "",
  budget_category_label: "",
  mandate_reference: "",
  notes: "",
  auto_reimburse_person: false,
  reimbursement_payment_method: "Bank Transfer",
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function money(pence: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(pence || 0) / 100);
}

function dateLabel(value?: string | null) {
  if (!value) return "Not scheduled";

  const normalised = value.length === 10 ? `${value}T00:00:00` : value;
  const date = new Date(normalised);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function todayDateKey() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function statusLabel(status: DirectDebitStatus) {
  if (status === "draft") return "Draft";
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  if (status === "cancelled") return "Cancelled";
  return "Completed";
}

function statusClass(status: DirectDebitStatus) {
  if (status === "active") {
    return "bg-emerald-500/15 text-emerald-100 ring-emerald-300/25";
  }

  if (status === "paused") {
    return "bg-amber-500/15 text-amber-100 ring-amber-300/25";
  }

  if (status === "cancelled") {
    return "bg-red-500/15 text-red-100 ring-red-300/25";
  }

  if (status === "completed") {
    return "bg-sky-500/15 text-sky-100 ring-sky-300/25";
  }

  return "bg-white/10 text-white/65 ring-white/15";
}

function occurrenceStatusLabel(status: DirectDebitOccurrenceStatus) {
  if (status === "scheduled") return "Scheduled";
  if (status === "posted") return "Posted";
  if (status === "paid") return "Paid";
  if (status === "failed") return "Failed";
  if (status === "skipped") return "Skipped";
  return "Cancelled";
}

function occurrenceStatusClass(status: DirectDebitOccurrenceStatus) {
  if (status === "paid") {
    return "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";
  }

  if (status === "posted") {
    return "bg-cyan-500/15 text-cyan-100 ring-cyan-300/20";
  }

  if (status === "failed") {
    return "bg-red-500/15 text-red-100 ring-red-300/20";
  }

  if (status === "skipped") {
    return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
  }

  if (status === "cancelled") {
    return "bg-white/10 text-white/55 ring-white/10";
  }

  return "bg-purple-500/15 text-purple-100 ring-purple-300/20";
}

function getOccurrences(plan: DirectDebitPlanRow) {
  return Array.isArray(plan.money_direct_debit_occurrences)
    ? [...plan.money_direct_debit_occurrences].sort((a, b) =>
        cleanText(a.due_date).localeCompare(cleanText(b.due_date)),
      )
    : [];
}

function occurrenceDateKey(value: string | null | undefined) {
  return cleanText(value).slice(0, 10);
}

function getNextOccurrence(plan: DirectDebitPlanRow) {
  const today = todayDateKey();
  const scheduled = getOccurrences(plan).filter(
    (occurrence) => occurrence.status === "scheduled",
  );

  return (
    scheduled.find(
      (occurrence) =>
        occurrenceDateKey(occurrence.due_date) >= today,
    ) ||
    scheduled[0] ||
    null
  );
}

function getDueOccurrence(plan: DirectDebitPlanRow) {
  const today = todayDateKey();

  return (
    getOccurrences(plan).find(
      (occurrence) =>
        occurrence.status === "scheduled" &&
        occurrenceDateKey(occurrence.due_date) <= today,
    ) || null
  );
}

function isOverdue(plan: DirectDebitPlanRow) {
  const due = getDueOccurrence(plan);

  return Boolean(
    due &&
      occurrenceDateKey(due.due_date) < todayDateKey(),
  );
}

function getOutstandingReimbursement(plan: DirectDebitPlanRow) {
  if (plan.account_source !== "personal") return 0;

  const occurrences = getOccurrences(plan);
  const reimbursementRows = occurrences.filter(
    (occurrence) =>
      occurrence.status === "posted" ||
      occurrence.status === "paid",
  );

  /*
   * Occurrence rows are the source of truth. Using a stale plan-level total
   * first caused values such as £132 to remain after individual repayments
   * had changed.
   */
  if (reimbursementRows.length > 0) {
    return reimbursementRows
      .filter((occurrence) => {
        const status = cleanText(
          occurrence.reimbursement_status,
        ).toLowerCase();

        return (
          status === "awaiting_reimbursement" ||
          status === "partially_reimbursed"
        );
      })
      .reduce(
        (sum, occurrence) =>
          sum + Math.max(0, Number(occurrence.amount_pence || 0)),
        0,
      );
  }

  /*
   * Keep the API aggregate only as a fallback for older API responses that do
   * not include occurrence reimbursement fields.
   */
  return Math.max(
    0,
    Number(plan.outstanding_reimbursement_pence || 0),
  );
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      error: "The server returned an invalid response.",
      details: text.slice(0, 1000),
    } as T;
  }
}

function apiErrorMessage(
  payload: Partial<ListResponse>,
  fallback: string,
  response?: Response,
) {
  return [
    payload.error || payload.message || fallback,
    payload.code ? `Code: ${payload.code}` : "",
    payload.details ? `Details: ${payload.details}` : "",
    payload.hint ? `Hint: ${payload.hint}` : "",
    response ? `HTTP: ${response.status}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function writeMoneyAuditLog(
  input: MoneyAuditInput,
): Promise<void> {
  try {
    const response = await fetch("/api/admin/money/audit-logs", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...input,
        module: input.module || "direct_debits",
        status: input.status || "success",
        risk: input.risk || "low",
      }),
    });

    if (!response.ok) {
      const payload = await readJsonResponse<ListResponse>(response);
      console.error("Money audit log failed", {
        input,
        responseStatus: response.status,
        payload,
      });
    }
  } catch (auditError) {
    console.error("Money audit log request failed", {
      input,
      auditError,
    });
  }
}

function StatCard({
  label,
  value,
  help,
  icon,
  warning = false,
}: {
  label: string;
  value: string | number;
  help: string;
  icon: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        warning
          ? "border-amber-300/20 bg-amber-500/10"
          : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wide text-white/45">
          {label}
        </p>
        <div className={warning ? "text-amber-200" : "text-pink-200"}>
          {icon}
        </div>
      </div>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-white/50">{help}</p>
    </div>
  );
}

export default function DirectDebitsPage() {
  const adminDetails =
    (useAdmin() as {
      admin?: {
        id?: string | null;
        full_name?: string | null;
        email?: string | null;
      } | null;
    } | null)?.admin ?? null;

  const [plans, setPlans] = useState<DirectDebitPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(null);
  const [cancelModal, setCancelModal] = useState<CancelModalState>(null);
  const [editModal, setEditModal] = useState<EditModalState>(null);
  const [invoiceModal, setInvoiceModal] = useState<InvoiceModalState>(null);
  const [undoModal, setUndoModal] = useState<UndoModalState>(null);
  const [reimburseModal, setReimburseModal] = useState<ReimburseModalState>(null);
  const [undoReimbursementModal, setUndoReimbursementModal] =
    useState<UndoReimbursementModalState>(null);
  const [createRepaymentImage, setCreateRepaymentImage] = useState<File | null>(
    null,
  );
  const [editRepaymentImage, setEditRepaymentImage] = useState<File | null>(
    null,
  );
  const [removeExistingRepaymentImage, setRemoveExistingRepaymentImage] =
    useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/money/direct-debits?t=${Date.now()}`,
        {
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const payload = await readJsonResponse<ListResponse>(response);

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(payload, "Could not load Direct Debits.", response),
        );
      }

      setPlans(Array.isArray(payload.plans) ? payload.plans : []);
    } catch (loadError) {
      setPlans([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load Direct Debits.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const summary = useMemo(() => {
    const active = plans.filter((plan) => plan.status === "active");
    const due = active.filter((plan) => Boolean(getDueOccurrence(plan)));
    const overdue = active.filter(isOverdue);
    const personal = active.filter(
      (plan) => plan.account_source === "personal",
    );

    const nextCollection = active
      .map((plan) => plan.next_collection_date || getNextOccurrence(plan)?.due_date)
      .filter((value): value is string => Boolean(value))
      .sort()[0];

    return {
      active: active.length,
      monthlyCommitment: active.reduce(
        (sum, plan) => sum + Number(plan.amount_pence || 0),
        0,
      ),
      due: due.length,
      overdue: overdue.length,
      nextCollection: nextCollection || null,
      personalMonthly: personal.reduce(
        (sum, plan) => sum + Number(plan.amount_pence || 0),
        0,
      ),
      reimbursementOutstanding: plans.reduce(
        (sum, plan) => sum + getOutstandingReimbursement(plan),
        0,
      ),
    };
  }, [plans]);

  const visiblePlans = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return plans.filter((plan) => {
      const occurrences = getOccurrences(plan);
      const matchesSearch =
        !cleanSearch ||
        [
          plan.title,
          plan.description,
          plan.supplier_name,
          plan.account_holder,
          plan.mandate_reference,
          plan.notes,
          plan.budget_category_label,
          plan.budget_category_key,
          plan.status,
          plan.account_source,
          occurrences.map((item) => item.status).join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(cleanSearch);

      const matchesStatus =
        statusFilter === "all" || plan.status === statusFilter;
      const matchesAccount =
        accountFilter === "all" || plan.account_source === accountFilter;

      const outstanding = getOutstandingReimbursement(plan);
      const matchesDue =
        dueFilter === "all"
          ? true
          : dueFilter === "due"
            ? Boolean(getDueOccurrence(plan))
            : dueFilter === "overdue"
              ? isOverdue(plan)
              : plan.account_source === "personal" && outstanding > 0;

      return matchesSearch && matchesStatus && matchesAccount && matchesDue;
    });
  }, [plans, search, statusFilter, accountFilter, dueFilter]);

  const formError = useMemo(() => {
    if (!form.title.trim()) return "Enter a Direct Debit title.";

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return "Enter a monthly amount greater than £0.";
    }

    if (!form.first_collection_date) {
      return "Choose the first collection date.";
    }

    if (form.account_source === "personal" && !form.account_holder.trim()) {
      return "Enter the person whose account will pay the Direct Debit.";
    }

    if (!form.is_open_ended) {
      const count = Number(form.total_payments);
      if (!Number.isInteger(count) || count < 2 || count > 60) {
        return "Payment count must be a whole number between 2 and 60.";
      }
    }

    return "";
  }, [form]);

  function updateForm<K extends keyof CreateForm>(
    key: K,
    value: CreateForm[K],
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function closeCreateModal() {
    if (saving) return;
    setShowCreate(false);
    setForm(EMPTY_FORM);
    setCreateRepaymentImage(null);
  }

  async function uploadRepaymentImage({
    planId,
    file,
    removeExisting = false,
  }: {
    planId: string;
    file: File | null;
    removeExisting?: boolean;
  }) {
    if (!file && !removeExisting) return;

    if (file && file.size > 10 * 1024 * 1024) {
      throw new Error("The repayment picture must be 10 MB or smaller.");
    }

    const formData = new FormData();

    if (file) {
      formData.append("file", file);
    }

    formData.append("remove_existing", String(removeExisting));

    const response = await fetch(
      `/api/admin/money/direct-debits/${encodeURIComponent(
        planId,
      )}/repayment-image`,
      {
        method: removeExisting && !file ? "DELETE" : "POST",
        credentials: "include",
        body: formData,
      },
    );

    const payload = await readJsonResponse<ListResponse>(response);

    if (!response.ok) {
      throw new Error(
        apiErrorMessage(
          payload,
          "The Direct Debit was saved, but the repayment picture could not be uploaded.",
          response,
        ),
      );
    }
  }

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (formError) {
      setToast({ type: "error", message: formError });
      return;
    }

    if (
      form.account_source === "personal" &&
      form.auto_reimburse_person &&
      createRepaymentImage &&
      createRepaymentImage.size > 10 * 1024 * 1024
    ) {
      setToast({
        type: "error",
        message: "The repayment picture must be 10 MB or smaller.",
      });
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/admin/money/direct-debits", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          total_payments: form.is_open_ended
            ? null
            : Number(form.total_payments),
          supplier_id: form.supplier_id || null,
          supplier_name: form.supplier_name || null,
          budget_category_key: form.budget_category_key || null,
          budget_category_label: form.budget_category_label || null,
          mandate_reference: form.mandate_reference || null,
          notes: form.notes || null,
          admin_id: adminDetails?.id || null,
          admin_name: adminDetails?.full_name || null,
          admin_email: adminDetails?.email || null,
        }),
      });

      const payload = await readJsonResponse<ListResponse & { plan_id?: string }>(
        response,
      );

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(payload, "Could not create Direct Debit.", response),
        );
      }

      let imageWasUploaded = false;
      let imageUploadWarning = "";

      if (
        payload.plan_id &&
        form.account_source === "personal" &&
        form.auto_reimburse_person &&
        createRepaymentImage
      ) {
        try {
          await uploadRepaymentImage({
            planId: payload.plan_id,
            file: createRepaymentImage,
          });
          imageWasUploaded = true;
        } catch (imageError) {
          imageUploadWarning =
            imageError instanceof Error
              ? imageError.message
              : "The repayment picture could not be uploaded.";
        }
      }

      await writeMoneyAuditLog({
        action: "money.direct_debit.created",
        action_label: "Direct Debit created",
        status: "success",
        risk: "medium",
        record_type: "direct_debit_plan",
        record_id: payload.plan_id || null,
        direct_debit_plan_id: payload.plan_id || null,
        summary: `Created Direct Debit plan: ${form.title.trim()}`,
        after_data: {
          title: form.title.trim(),
          amount: Number(form.amount),
          account_source: form.account_source,
          account_holder:
            form.account_source === "personal"
              ? form.account_holder.trim()
              : null,
          supplier_name: form.supplier_name || null,
          first_collection_date: form.first_collection_date,
          is_open_ended: form.is_open_ended,
          total_payments: form.is_open_ended
            ? null
            : Number(form.total_payments),
          auto_reimburse_person:
            form.account_source === "personal"
              ? form.auto_reimburse_person
              : false,
          reimbursement_payment_method:
            form.account_source === "personal" &&
            form.auto_reimburse_person
              ? form.reimbursement_payment_method
              : null,
          repayment_picture_uploaded: imageWasUploaded,
        },
      });

      closeCreateModal();
      setToast({
        type: imageUploadWarning ? "error" : "success",
        message: imageUploadWarning
          ? `The monthly Direct Debit plan was created, but its repayment picture was not uploaded. ${imageUploadWarning}`
          : imageWasUploaded
            ? "The monthly Direct Debit plan and repayment picture were saved successfully."
            : "The monthly Direct Debit plan was created successfully.",
      });
      await loadPlans();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create Direct Debit.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updatePlanStatus(
    plan: DirectDebitPlanRow,
    status: "active" | "paused",
  ) {
    const action = status === "active" ? "resume" : "pause";
    setBusyAction({ planId: plan.id, action });
    setError("");

    try {
      const response = await fetch(
        `/api/admin/money/direct-debits/${encodeURIComponent(plan.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            admin_id: adminDetails?.id || null,
            admin_name: adminDetails?.full_name || null,
            admin_email: adminDetails?.email || null,
          }),
        },
      );

      const payload = await readJsonResponse<ListResponse>(response);

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(payload, "Could not update the plan.", response),
        );
      }

      await writeMoneyAuditLog({
        action:
          status === "active"
            ? "money.direct_debit.resumed"
            : "money.direct_debit.paused",
        action_label:
          status === "active"
            ? "Direct Debit resumed"
            : "Direct Debit paused",
        status: "success",
        risk: "medium",
        record_type: "direct_debit_plan",
        record_id: plan.id,
        direct_debit_plan_id: plan.id,
        summary:
          status === "active"
            ? `Resumed Direct Debit plan: ${plan.title}`
            : `Paused Direct Debit plan: ${plan.title}`,
        before_data: { status: plan.status },
        after_data: { status },
      });

      setToast({
        type: "success",
        message:
          status === "active"
            ? `${plan.title} was resumed.`
            : `${plan.title} was paused.`,
      });
      await loadPlans();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Could not update the plan.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  function openCancelPlanModal(plan: DirectDebitPlanRow) {
    if (plan.status === "cancelled" || plan.status === "completed") return;

    setCancelModal({
      plan,
      reason: "Service no longer required",
      error: "",
    });
  }

  function closeCancelPlanModal() {
    if (
      cancelModal &&
      busyAction?.planId === cancelModal.plan.id &&
      busyAction.action === "cancel"
    ) {
      return;
    }

    setCancelModal(null);
  }

  async function confirmCancelPlan() {
    if (!cancelModal) return;

    const { plan } = cancelModal;
    const reason = cancelModal.reason.trim();

    if (!reason) {
      setCancelModal((previous) =>
        previous
          ? {
              ...previous,
              error: "Enter a cancellation reason before continuing.",
            }
          : previous,
      );
      return;
    }

    setBusyAction({ planId: plan.id, action: "cancel" });
    setError("");

    try {
      const response = await fetch(
        `/api/admin/money/direct-debits/${encodeURIComponent(plan.id)}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason,
            admin_id: adminDetails?.id || null,
            admin_name: adminDetails?.full_name || null,
            admin_email: adminDetails?.email || null,
          }),
        },
      );

      const payload = await readJsonResponse<ListResponse>(response);

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(payload, "Could not cancel the plan.", response),
        );
      }

      await writeMoneyAuditLog({
        action: "money.direct_debit.cancelled",
        action_label: "Direct Debit cancelled",
        status: "cancelled",
        risk: "high",
        record_type: "direct_debit_plan",
        record_id: plan.id,
        direct_debit_plan_id: plan.id,
        summary: `Cancelled future Direct Debit payments: ${plan.title}`,
        before_data: { status: plan.status },
        after_data: {
          status: "cancelled",
          cancellation_reason: reason,
        },
      });

      setCancelModal(null);
      setToast({
        type: "success",
        message: `${plan.title} was cancelled. Historic records were kept.`,
      });
      await loadPlans();
    } catch (actionError) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : "Could not cancel the plan.";

      setCancelModal((previous) =>
        previous ? { ...previous, error: message } : previous,
      );
    } finally {
      setBusyAction(null);
    }
  }

  function openPostPaymentModal(plan: DirectDebitPlanRow) {
    const dueOccurrence = getDueOccurrence(plan);

    if (!dueOccurrence) {
      setToast({
        type: "error",
        message: "This plan has no payment due today or earlier.",
      });
      return;
    }

    setConfirmModal({
      kind: "post",
      plan,
      occurrence: dueOccurrence,
      invoiceFile: null,
      invoiceError: "",
    });
  }

  function closeConfirmModal() {
    if (
      confirmModal &&
      busyAction?.planId === confirmModal.plan.id &&
      busyAction.action === "post"
    ) {
      return;
    }

    setConfirmModal(null);
  }

  async function uploadInvoiceForOccurrence({
    planId,
    occurrenceId,
    file,
  }: {
    planId: string;
    occurrenceId: string;
    file: File;
  }) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("occurrence_id", occurrenceId);

    const response = await fetch(
      `/api/admin/money/direct-debits/${encodeURIComponent(
        planId,
      )}/occurrences/${encodeURIComponent(occurrenceId)}/invoice`,
      {
        method: "POST",
        credentials: "include",
        body: formData,
      },
    );

    const payload = await readJsonResponse<ListResponse>(response);

    if (!response.ok) {
      throw new Error(
        apiErrorMessage(
          payload,
          "The payment was made, but the receipt could not be added to the linked Money Tracker transaction.",
          response,
        ),
      );
    }

    window.dispatchEvent(
      new CustomEvent("money:transactions-changed", {
        detail: {
          source: "direct-debit-receipt-upload",
          planId,
          occurrenceId,
          transactionId:
            payload.transaction_id || null,
          attachmentId:
            payload.attachment?.id || null,
        },
      }),
    );

    return payload;
  }

  async function confirmPostDuePayment() {
    if (!confirmModal || confirmModal.kind !== "post") return;

    const {
      plan,
      occurrence: dueOccurrence,
      invoiceFile,
    } = confirmModal;

    if (invoiceFile && invoiceFile.size > 10 * 1024 * 1024) {
      setConfirmModal((previous) =>
        previous
          ? {
              ...previous,
              invoiceError:
                "The receipt or invoice must be 10 MB or smaller.",
            }
          : previous,
      );
      return;
    }

    if (
      invoiceFile &&
      invoiceFile.type &&
      !new Set([
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
      ]).has(invoiceFile.type)
    ) {
      setConfirmModal((previous) =>
        previous
          ? {
              ...previous,
              invoiceError:
                "Upload a PDF, JPG, PNG or WebP receipt.",
            }
          : previous,
      );
      return;
    }

    setBusyAction({ planId: plan.id, action: "post" });
    setError("");

    try {
      const response = await fetch(
        `/api/admin/money/direct-debits/${encodeURIComponent(
          plan.id,
        )}/generate-due`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            occurrence_id: dueOccurrence.id,
            admin_id: adminDetails?.id || null,
            admin_name: adminDetails?.full_name || null,
            admin_email: adminDetails?.email || null,
          }),
        },
      );

      const payload = await readJsonResponse<ListResponse>(response);

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(payload, "Could not post the due payment.", response),
        );
      }

      let uploadedReceipt:
        | ListResponse
        | null = null;

      if (invoiceFile) {
        uploadedReceipt =
          await uploadInvoiceForOccurrence({
            planId: plan.id,
            occurrenceId: dueOccurrence.id,
            file: invoiceFile,
          });
      }

      await writeMoneyAuditLog({
        action: "money.direct_debit.payment_posted",
        action_label: "Direct Debit payment made",
        status: "success",
        risk: "medium",
        record_type: "direct_debit_occurrence",
        record_id: dueOccurrence.id,
        direct_debit_plan_id: plan.id,
        direct_debit_occurrence_id: dueOccurrence.id,
        summary: `Made Direct Debit payment ${dueOccurrence.payment_number}${
          plan.total_payments ? ` of ${plan.total_payments}` : ""
        } for ${plan.title}`,
        before_data: {
          occurrence_status: dueOccurrence.status,
          transaction_id: dueOccurrence.transaction_id,
        },
        after_data: {
          occurrence_status: "posted",
          amount_pence: dueOccurrence.amount_pence,
          invoice_uploaded: Boolean(invoiceFile),
          receipt_transaction_id:
            uploadedReceipt?.transaction_id || null,
          receipt_attachment_id:
            uploadedReceipt?.attachment?.id || null,
          auto_reimburse_person: Boolean(plan.auto_reimburse_person),
        },
      });

      setConfirmModal(null);
      setToast({
        type: "success",
        message: invoiceFile
          ? `${plan.title} was recorded as a payment and the receipt was added to its Money Tracker receipt section.`
          : `${plan.title} was recorded as a payment in Money Transactions.`,
      });

      window.dispatchEvent(
        new CustomEvent("money:transactions-changed", {
          detail: {
            source: "direct-debit-payment-posted",
            planId: plan.id,
            occurrenceId: dueOccurrence.id,
            transactionId:
              uploadedReceipt?.transaction_id ||
              null,
          },
        }),
      );

      await loadPlans();
    } catch (actionError) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : "Could not make the payment.";

      if (confirmModal) {
        setConfirmModal((previous) =>
          previous
            ? {
                ...previous,
                invoiceError: message,
              }
            : previous,
        );
      } else {
        setError(message);
      }
    } finally {
      setBusyAction(null);
    }
  }

  function openEditPlanModal(plan: DirectDebitPlanRow) {
    setEditRepaymentImage(null);
    setRemoveExistingRepaymentImage(false);
    setEditModal({
      plan,
      error: "",
      form: {
        title: cleanText(plan.title),
        description: cleanText(plan.description),
        amount: (Number(plan.amount_pence || 0) / 100).toFixed(2),
        account_source: plan.account_source,
        account_holder: cleanText(plan.account_holder),
        supplier_name: cleanText(plan.supplier_name),
        budget_category_key: cleanText(plan.budget_category_key),
        budget_category_label: cleanText(plan.budget_category_label),
        mandate_reference: cleanText(plan.mandate_reference),
        notes: cleanText(plan.notes),
        auto_reimburse_person: Boolean(plan.auto_reimburse_person),
        reimbursement_payment_method:
          cleanText(plan.reimbursement_payment_method) || "Bank Transfer",
      },
    });
  }

  function closeEditPlanModal() {
    if (
      editModal &&
      busyAction?.planId === editModal.plan.id &&
      busyAction.action === "edit"
    ) {
      return;
    }

    setEditModal(null);
    setEditRepaymentImage(null);
    setRemoveExistingRepaymentImage(false);
  }

  function updateEditForm<K extends keyof EditPlanForm>(
    key: K,
    value: EditPlanForm[K],
  ) {
    setEditModal((previous) =>
      previous
        ? {
            ...previous,
            error: "",
            form: {
              ...previous.form,
              [key]: value,
            },
          }
        : previous,
    );
  }

  async function saveEditedPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editModal) return;

    const { plan, form: editForm } = editModal;
    const amount = Number(editForm.amount);

    if (!editForm.title.trim()) {
      setEditModal((previous) =>
        previous
          ? { ...previous, error: "Enter a Direct Debit title." }
          : previous,
      );
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setEditModal((previous) =>
        previous
          ? {
              ...previous,
              error: "Enter a monthly amount greater than £0.",
            }
          : previous,
      );
      return;
    }

    if (
      editForm.account_source === "personal" &&
      !editForm.account_holder.trim()
    ) {
      setEditModal((previous) =>
        previous
          ? {
              ...previous,
              error: "Enter the person whose account pays this Direct Debit.",
            }
          : previous,
      );
      return;
    }

    setBusyAction({ planId: plan.id, action: "edit" });
    setError("");

    try {
      const response = await fetch(
        `/api/admin/money/direct-debits/${encodeURIComponent(plan.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "edit_plan",
            title: editForm.title.trim(),
            description: editForm.description.trim() || null,
            amount_pence: Math.round(amount * 100),
            account_source: editForm.account_source,
            account_holder:
              editForm.account_source === "personal"
                ? editForm.account_holder.trim()
                : null,
            supplier_name: editForm.supplier_name.trim() || null,
            budget_category_key:
              editForm.budget_category_key.trim() || null,
            budget_category_label:
              editForm.budget_category_label.trim() || null,
            mandate_reference: editForm.mandate_reference.trim() || null,
            notes: editForm.notes.trim() || null,
            auto_reimburse_person:
              editForm.account_source === "personal"
                ? editForm.auto_reimburse_person
                : false,
            reimbursement_payment_method:
              editForm.account_source === "personal"
                ? editForm.reimbursement_payment_method
                : null,
            update_future_scheduled_occurrences: true,
            admin_id: adminDetails?.id || null,
            admin_name: adminDetails?.full_name || null,
            admin_email: adminDetails?.email || null,
          }),
        },
      );

      const payload = await readJsonResponse<ListResponse>(response);

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(payload, "Could not edit the Direct Debit.", response),
        );
      }

      if (
        editForm.account_source === "personal" &&
        editForm.auto_reimburse_person &&
        (editRepaymentImage || removeExistingRepaymentImage)
      ) {
        await uploadRepaymentImage({
          planId: plan.id,
          file: editRepaymentImage,
          removeExisting: removeExistingRepaymentImage,
        });
      } else if (
        (!editForm.auto_reimburse_person ||
          editForm.account_source !== "personal") &&
        plan.reimbursement_image_url
      ) {
        await uploadRepaymentImage({
          planId: plan.id,
          file: null,
          removeExisting: true,
        });
      }

      const pictureChanged =
        Boolean(editRepaymentImage) || removeExistingRepaymentImage;

      await writeMoneyAuditLog({
        action: "money.direct_debit.updated",
        action_label: "Direct Debit updated",
        status: "success",
        risk: "medium",
        record_type: "direct_debit_plan",
        record_id: plan.id,
        direct_debit_plan_id: plan.id,
        summary: `Updated Direct Debit plan: ${editForm.title.trim()}`,
        before_data: {
          title: plan.title,
          amount_pence: plan.amount_pence,
          account_source: plan.account_source,
          account_holder: plan.account_holder,
          supplier_name: plan.supplier_name,
          budget_category_key: plan.budget_category_key,
          budget_category_label: plan.budget_category_label,
          mandate_reference: plan.mandate_reference,
          notes: plan.notes,
          auto_reimburse_person: plan.auto_reimburse_person,
          reimbursement_payment_method:
            plan.reimbursement_payment_method,
          reimbursement_image_file_name:
            plan.reimbursement_image_file_name,
        },
        after_data: {
          title: editForm.title.trim(),
          amount_pence: Math.round(amount * 100),
          account_source: editForm.account_source,
          account_holder:
            editForm.account_source === "personal"
              ? editForm.account_holder.trim()
              : null,
          supplier_name: editForm.supplier_name.trim() || null,
          budget_category_key:
            editForm.budget_category_key.trim() || null,
          budget_category_label:
            editForm.budget_category_label.trim() || null,
          mandate_reference:
            editForm.mandate_reference.trim() || null,
          notes: editForm.notes.trim() || null,
          auto_reimburse_person:
            editForm.account_source === "personal"
              ? editForm.auto_reimburse_person
              : false,
          reimbursement_payment_method:
            editForm.account_source === "personal" &&
            editForm.auto_reimburse_person
              ? editForm.reimbursement_payment_method
              : null,
          repayment_picture_changed: pictureChanged,
          repayment_picture_removed:
            removeExistingRepaymentImage && !editRepaymentImage,
        },
      });

      setEditModal(null);
      setEditRepaymentImage(null);
      setRemoveExistingRepaymentImage(false);
      setToast({
        type: "success",
        message: pictureChanged
          ? `${editForm.title.trim()} and its repayment picture were updated.`
          : `${editForm.title.trim()} was updated. Future scheduled payments now use the new details.`,
      });
      await loadPlans();
    } catch (editError) {
      const message =
        editError instanceof Error
          ? editError.message
          : "Could not edit the Direct Debit.";

      setEditModal((previous) =>
        previous ? { ...previous, error: message } : previous,
      );
    } finally {
      setBusyAction(null);
    }
  }


  function postedOccurrences(plan: DirectDebitPlanRow) {
    return getOccurrences(plan)
      .filter(
        (occurrence) =>
          occurrence.status === "posted" ||
          occurrence.status === "paid",
      )
      .sort((a, b) =>
        occurrenceDateKey(b.due_date).localeCompare(
          occurrenceDateKey(a.due_date),
        ),
      );
  }

  function latestPostedOccurrence(plan: DirectDebitPlanRow) {
    return postedOccurrences(plan)[0] || null;
  }

  function latestReimbursedOccurrence(
    plan: DirectDebitPlanRow,
  ) {
    return (
      postedOccurrences(plan).find(
        (occurrence) =>
          cleanText(
            occurrence.reimbursement_status,
          ).toLowerCase() === "reimbursed",
      ) || null
    );
  }

  function latestOutstandingReimbursementOccurrence(
    plan: DirectDebitPlanRow,
  ) {
    return (
      postedOccurrences(plan).find((occurrence) => {
        const status = cleanText(
          occurrence.reimbursement_status,
        ).toLowerCase();

        return (
          status === "awaiting_reimbursement" ||
          status === "partially_reimbursed" ||
          status === "" ||
          status === "not_required"
        );
      }) || null
    );
  }

  function openInvoiceModal(plan: DirectDebitPlanRow) {
    const occurrence = latestPostedOccurrence(plan);
    if (!occurrence) {
      setToast({
        type: "error",
        message: "Make a payment before uploading an invoice or receipt.",
      });
      return;
    }

    setInvoiceModal({ plan, occurrence, file: null, error: "" });
  }

  async function uploadInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invoiceModal) return;

    if (!invoiceModal.file) {
      setInvoiceModal((previous) =>
        previous ? { ...previous, error: "Choose a receipt or invoice file." } : previous,
      );
      return;
    }

    const { plan, occurrence, file } = invoiceModal;

    if (file.size > 10 * 1024 * 1024) {
      setInvoiceModal((previous) =>
        previous
          ? {
              ...previous,
              error:
                "The receipt or invoice must be 10 MB or smaller.",
            }
          : previous,
      );
      return;
    }

    const allowedTypes = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);

    if (file.type && !allowedTypes.has(file.type)) {
      setInvoiceModal((previous) =>
        previous
          ? {
              ...previous,
              error:
                "Upload a PDF, JPG, PNG or WebP receipt.",
            }
          : previous,
      );
      return;
    }

    setBusyAction({ planId: plan.id, action: "invoice" });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("occurrence_id", occurrence.id);

      const response = await fetch(
        `/api/admin/money/direct-debits/${encodeURIComponent(
          plan.id,
        )}/occurrences/${encodeURIComponent(occurrence.id)}/invoice`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      );

      const payload = await readJsonResponse<ListResponse>(response);
      if (!response.ok) {
        throw new Error(
          apiErrorMessage(payload, "Could not upload the receipt.", response),
        );
      }

      await writeMoneyAuditLog({
        action: "money.direct_debit.receipt_uploaded",
        action_label: "Direct Debit receipt uploaded",
        status: "success",
        risk: "low",
        record_type: "direct_debit_occurrence",
        record_id: occurrence.id,
        direct_debit_plan_id: plan.id,
        direct_debit_occurrence_id: occurrence.id,
        summary: `Uploaded receipt for payment ${occurrence.payment_number}: ${plan.title}`,
        after_data: {
          receipt_file_name: file.name,
          receipt_file_size: file.size,
          receipt_mime_type: file.type,
        },
      });

      setInvoiceModal(null);
      setToast({
        type: "success",
        message:
          `Receipt uploaded for payment ${occurrence.payment_number} and added to its Money Tracker receipt section.`,
      });

      window.dispatchEvent(
        new CustomEvent("money:transactions-changed", {
          detail: {
            source: "direct-debit-receipt-upload",
            planId: plan.id,
            occurrenceId: occurrence.id,
            transactionId:
              payload.transaction_id ||
              occurrence.transaction_id ||
              null,
            attachmentId:
              payload.attachment?.id || null,
          },
        }),
      );

      await loadPlans();
    } catch (uploadError) {
      setInvoiceModal((previous) =>
        previous
          ? {
              ...previous,
              error:
                uploadError instanceof Error
                  ? uploadError.message
                  : "Could not upload the receipt.",
            }
          : previous,
      );
    } finally {
      setBusyAction(null);
    }
  }

  function openUndoModal(plan: DirectDebitPlanRow) {
    const occurrence = latestPostedOccurrence(plan);
    if (!occurrence || !occurrence.transaction_id) {
      setToast({
        type: "error",
        message: "There is no posted payment available to undo.",
      });
      return;
    }

    setUndoModal({
      plan,
      occurrence,
      reason: "Payment was recorded by mistake",
      error: "",
    });
  }

  async function confirmUndoPayment() {
    if (!undoModal) return;
    const { plan, occurrence } = undoModal;
    const reason = undoModal.reason.trim();

    if (!reason) {
      setUndoModal((previous) =>
        previous ? { ...previous, error: "Enter a reason for undoing the payment." } : previous,
      );
      return;
    }

    setBusyAction({ planId: plan.id, action: "undo" });

    try {
      const response = await fetch(
        `/api/admin/money/direct-debits/${encodeURIComponent(
          plan.id,
        )}/occurrences/${encodeURIComponent(occurrence.id)}/undo`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason }),
        },
      );

      const payload = await readJsonResponse<ListResponse>(response);
      if (!response.ok) {
        throw new Error(
          apiErrorMessage(payload, "Could not undo the payment.", response),
        );
      }

      await writeMoneyAuditLog({
        action: "money.direct_debit.payment_undone",
        action_label: "Direct Debit payment undone",
        status: "warning",
        risk: "high",
        record_type: "direct_debit_occurrence",
        record_id: occurrence.id,
        transaction_id: occurrence.transaction_id,
        direct_debit_plan_id: plan.id,
        direct_debit_occurrence_id: occurrence.id,
        summary: `Undid Direct Debit payment ${occurrence.payment_number}: ${plan.title}`,
        before_data: {
          occurrence_status: occurrence.status,
          transaction_id: occurrence.transaction_id,
        },
        after_data: {
          occurrence_status: "scheduled",
          transaction_id: null,
          undo_reason: reason,
        },
      });

      setUndoModal(null);
      setToast({
        type: "success",
        message: `Payment ${occurrence.payment_number} was undone and returned to scheduled.`,
      });
      await loadPlans();
    } catch (undoError) {
      setUndoModal((previous) =>
        previous
          ? {
              ...previous,
              error:
                undoError instanceof Error
                  ? undoError.message
                  : "Could not undo the payment.",
            }
          : previous,
      );
    } finally {
      setBusyAction(null);
    }
  }

  function openReimburseModal(plan: DirectDebitPlanRow) {
    const occurrence =
      latestOutstandingReimbursementOccurrence(plan);

    if (plan.account_source !== "personal") {
      setToast({
        type: "error",
        message: "This Direct Debit is not paid from a personal account.",
      });
      return;
    }

    if (!occurrence) {
      setToast({
        type: "error",
        message: "Make a payment before repaying the person.",
      });
      return;
    }

    setReimburseModal({
      plan,
      occurrence,
      payment_method: plan.reimbursement_payment_method || "Bank Transfer",
      reference: "",
      error: "",
    });
  }

  async function confirmReimbursement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reimburseModal) return;

    const { plan, occurrence } = reimburseModal;
    setBusyAction({ planId: plan.id, action: "reimburse" });

    try {
      const response = await fetch(
        `/api/admin/money/direct-debits/${encodeURIComponent(
          plan.id,
        )}/occurrences/${encodeURIComponent(occurrence.id)}/reimburse`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payment_method: reimburseModal.payment_method,
            reference: reimburseModal.reference.trim() || null,
          }),
        },
      );

      const payload = await readJsonResponse<ListResponse>(response);
      if (!response.ok) {
        throw new Error(
          apiErrorMessage(payload, "Could not repay the person.", response),
        );
      }

      await writeMoneyAuditLog({
        action: "money.direct_debit.person_reimbursed",
        action_label: "Personal Direct Debit reimbursed",
        status: "success",
        risk: "high",
        record_type: "direct_debit_occurrence",
        record_id: occurrence.id,
        direct_debit_plan_id: plan.id,
        direct_debit_occurrence_id: occurrence.id,
        summary: `Repaid ${money(occurrence.amount_pence)} to ${
          plan.account_holder || "the payer"
        } for ${plan.title}`,
        before_data: {
          reimbursement_status: occurrence.reimbursement_status,
        },
        after_data: {
          reimbursement_status: "reimbursed",
          payment_method: reimburseModal.payment_method,
          reference: reimburseModal.reference.trim() || null,
          amount_pence: occurrence.amount_pence,
          account_holder: plan.account_holder || null,
        },
      });

      setReimburseModal(null);
      setToast({
        type: "success",
        message: `${money(occurrence.amount_pence)} was recorded as repaid to ${
          plan.account_holder || "the payer"
        }.`,
      });

      window.dispatchEvent(
        new CustomEvent("money:direct-debit-reimbursed", {
          detail: {
            planId: plan.id,
            occurrenceId: occurrence.id,
            transactionId: occurrence.transaction_id,
          },
        }),
      );

      window.dispatchEvent(
        new CustomEvent("money:transactions-changed"),
      );

      await loadPlans();
    } catch (reimburseError) {
      setReimburseModal((previous) =>
        previous
          ? {
              ...previous,
              error:
                reimburseError instanceof Error
                  ? reimburseError.message
                  : "Could not repay the person.",
            }
          : previous,
      );
    } finally {
      setBusyAction(null);
    }
  }

  function openUndoReimbursementModal(plan: DirectDebitPlanRow) {
    const occurrence =
      latestReimbursedOccurrence(plan);

    if (!occurrence) {
      setToast({
        type: "error",
        message: "There is no reimbursed payment available to undo.",
      });
      return;
    }

    setUndoReimbursementModal({
      plan,
      occurrence,
      reason: "Repayment was recorded by mistake",
      delete_repayment_transaction: true,
      error: "",
    });
  }

  function closeUndoReimbursementModal() {
    if (
      undoReimbursementModal &&
      busyAction?.planId === undoReimbursementModal.plan.id &&
      busyAction.action === "undo_reimburse"
    ) {
      return;
    }

    setUndoReimbursementModal(null);
  }

  async function confirmUndoReimbursement(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!undoReimbursementModal) return;

    const { plan, occurrence } = undoReimbursementModal;
    const reason = undoReimbursementModal.reason.trim();

    if (!reason) {
      setUndoReimbursementModal((previous) =>
        previous
          ? {
              ...previous,
              error: "Enter a reason for undoing the repayment.",
            }
          : previous,
      );
      return;
    }

    setBusyAction({
      planId: plan.id,
      action: "undo_reimburse",
    });

    try {
      const response = await fetch(
        `/api/admin/money/direct-debits/${encodeURIComponent(
          plan.id,
        )}/occurrences/${encodeURIComponent(
          occurrence.id,
        )}/reimburse/undo`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason,
            delete_repayment_transaction:
              undoReimbursementModal.delete_repayment_transaction,
          }),
        },
      );

      const payload = await readJsonResponse<ListResponse>(response);

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(
            payload,
            "Could not undo the repayment.",
            response,
          ),
        );
      }

      await writeMoneyAuditLog({
        action: "money.direct_debit.person_reimbursement_undone",
        action_label: "Personal Direct Debit repayment undone",
        status: "warning",
        risk: "high",
        record_type: "direct_debit_occurrence",
        record_id: occurrence.id,
        transaction_id: occurrence.transaction_id,
        direct_debit_plan_id: plan.id,
        direct_debit_occurrence_id: occurrence.id,
        summary: `Undid ${money(
          occurrence.amount_pence,
        )} repayment to ${
          plan.account_holder || "the payer"
        } for ${plan.title}`,
        before_data: {
          reimbursement_status: "reimbursed",
          reimbursement_transaction_id:
            occurrence.reimbursement_transaction_id || null,
        },
        after_data: {
          reimbursement_status: "awaiting_reimbursement",
          reimbursement_transaction_id: null,
          undo_reason: reason,
          repayment_transaction_deleted:
            undoReimbursementModal.delete_repayment_transaction,
        },
      });

      setUndoReimbursementModal(null);
      setToast({
        type: "success",
        message: `${money(
          occurrence.amount_pence,
        )} is awaiting repayment again for ${
          plan.account_holder || "the payer"
        }.`,
      });

      window.dispatchEvent(
        new CustomEvent("money:direct-debit-reimbursement-undone", {
          detail: {
            planId: plan.id,
            occurrenceId: occurrence.id,
            transactionId: occurrence.transaction_id,
          },
        }),
      );

      window.dispatchEvent(
        new CustomEvent("money:transactions-changed"),
      );

      await loadPlans();
    } catch (undoError) {
      setUndoReimbursementModal((previous) =>
        previous
          ? {
              ...previous,
              error:
                undoError instanceof Error
                  ? undoError.message
                  : "Could not undo the repayment.",
            }
          : previous,
      );
    } finally {
      setBusyAction(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setAccountFilter("all");
    setDueFilter("all");
  }

  const hasFilters =
    Boolean(search.trim()) ||
    statusFilter !== "all" ||
    accountFilter !== "all" ||
    dueFilter !== "all";

  return (
    <main className="min-h-screen w-full min-w-0 bg-[#080812] px-0 py-4 text-white sm:py-6">
      <div className="w-full min-w-0 max-w-none space-y-5">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                  Direct Debits
                </h1>
                <span className="rounded-full bg-pink-500/15 px-3 py-1 text-xs font-black text-pink-100 ring-1 ring-pink-300/20">
                  Monthly plans
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
                Manage monthly commitments, post payments when they become due,
                track personal-account liabilities and keep future collections
                separate from completed spending.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/Admin/MoneyManagement/Transactions"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/15"
              >
                <WalletCards className="h-4 w-4" />
                Money Transactions
              </Link>

              <button
                type="button"
                onClick={() => void loadPlans()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-50"
              >
                <RefreshCcw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-pink-950/30 hover:bg-pink-400"
              >
                <Plus className="h-4 w-4" />
                New Direct Debit
              </button>
            </div>
          </div>
        </header>

        {toast ? (
          <div
            className={`fixed right-4 top-4 z-[70] max-w-md rounded-2xl border p-4 text-sm font-bold shadow-2xl backdrop-blur ${
              toast.type === "success"
                ? "border-emerald-300/30 bg-emerald-950/95 text-emerald-100"
                : "border-red-300/30 bg-red-950/95 text-red-100"
            }`}
          >
            <div className="flex items-start gap-3">
              {toast.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <p className="whitespace-pre-line leading-6">{toast.message}</p>
            </div>
          </div>
        ) : null}

        {error ? (
          <section className="rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-red-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="font-black">Direct Debit error</p>
                <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-red-100/80">
                  {error}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <StatCard
            label="Active plans"
            value={summary.active}
            help="Plans currently allowed to produce future payments."
            icon={<ShieldCheck className="h-5 w-5" />}
          />
          <StatCard
            label="Monthly commitment"
            value={money(summary.monthlyCommitment)}
            help="Combined monthly cost of active plans."
            icon={<BadgePoundSterling className="h-5 w-5" />}
          />
          <StatCard
            label="Due now"
            value={summary.due}
            help={`${summary.overdue} payment${
              summary.overdue === 1 ? " is" : "s are"
            } overdue.`}
            icon={<CalendarCheck2 className="h-5 w-5" />}
            warning={summary.due > 0}
          />
          <StatCard
            label="Next collection"
            value={dateLabel(summary.nextCollection)}
            help="Earliest upcoming scheduled collection."
            icon={<CalendarClock className="h-5 w-5" />}
          />
          <StatCard
            label="Personal monthly"
            value={money(summary.personalMonthly)}
            help="Active monthly payments leaving personal accounts."
            icon={<UserRound className="h-5 w-5" />}
          />
          <StatCard
            label="Reimbursement due"
            value={money(summary.reimbursementOutstanding)}
            help="Personal-account payments still awaiting repayment."
            icon={<Banknote className="h-5 w-5" />}
            warning={summary.reimbursementOutstanding > 0}
          />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-pink-200" />
              <h2 className="font-black">Find and filter plans</h2>
            </div>

            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white/75 ring-1 ring-white/10 hover:bg-white/15"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="relative block md:col-span-2 xl:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-white/35" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search plan, supplier, reference..."
                className="w-full rounded-xl bg-black/25 py-3 pl-10 pr-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-pink-300/40"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              className="rounded-xl bg-black/25 p-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
            >
              <option className="bg-[#11111f]" value="all">
                All statuses
              </option>
              <option className="bg-[#11111f]" value="active">
                Active
              </option>
              <option className="bg-[#11111f]" value="paused">
                Paused
              </option>
              <option className="bg-[#11111f]" value="draft">
                Draft
              </option>
              <option className="bg-[#11111f]" value="completed">
                Completed
              </option>
              <option className="bg-[#11111f]" value="cancelled">
                Cancelled
              </option>
            </select>

            <select
              value={accountFilter}
              onChange={(event) =>
                setAccountFilter(event.target.value as AccountFilter)
              }
              className="rounded-xl bg-black/25 p-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
            >
              <option className="bg-[#11111f]" value="all">
                All paying accounts
              </option>
              <option className="bg-[#11111f]" value="organisation">
                Burton Pride account
              </option>
              <option className="bg-[#11111f]" value="personal">
                Personal accounts
              </option>
            </select>

            <select
              value={dueFilter}
              onChange={(event) => setDueFilter(event.target.value as DueFilter)}
              className="rounded-xl bg-black/25 p-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
            >
              <option className="bg-[#11111f]" value="all">
                All payment states
              </option>
              <option className="bg-[#11111f]" value="due">
                Payment due now
              </option>
              <option className="bg-[#11111f]" value="overdue">
                Overdue
              </option>
              <option className="bg-[#11111f]" value="personal_reimbursement">
                Personal reimbursement due
              </option>
            </select>
          </div>
        </section>

        <section className="w-full min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-xl font-black">Direct Debit plans</h2>
              <p className="mt-1 text-sm text-white/50">
                Showing {visiblePlans.length} of {plans.length} plan
                {plans.length === 1 ? "" : "s"}.
              </p>
            </div>

            <Link
              href="/Admin/MoneyManagement/DirectDebits/export"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white ring-1 ring-white/10 hover:bg-white/15"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export report
            </Link>
          </div>

          {loading ? (
            <div className="flex min-h-72 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03]">
              <div className="text-center">
                <Loader2 className="mx-auto h-9 w-9 animate-spin text-pink-200" />
                <p className="mt-3 text-sm font-bold text-white/55">
                  Loading Direct Debits...
                </p>
              </div>
            </div>
          ) : visiblePlans.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
              <CreditCard className="mx-auto h-10 w-10 text-white/25" />
              <h3 className="mt-3 text-xl font-black">
                {plans.length === 0
                  ? "No Direct Debits have been created"
                  : "No Direct Debits match these filters"}
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/50">
                {plans.length === 0
                  ? "Create the first monthly plan. Future months will remain scheduled until each payment is posted."
                  : "Clear or change the filters to see other plans."}
              </p>
              <button
                type="button"
                onClick={() =>
                  plans.length === 0 ? setShowCreate(true) : clearFilters()
                }
                className="mt-5 rounded-xl bg-pink-500 px-4 py-3 text-sm font-black text-white hover:bg-pink-400"
              >
                {plans.length === 0 ? "Create first Direct Debit" : "Clear filters"}
              </button>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {visiblePlans.map((plan) => {
                const occurrences = getOccurrences(plan);
                const nextOccurrence = getNextOccurrence(plan);
                const dueOccurrence = getDueOccurrence(plan);
                const recentOccurrences = [...occurrences]
                  .sort((a, b) => b.due_date.localeCompare(a.due_date))
                  .slice(0, 3);
                const outstandingReimbursement =
                  getOutstandingReimbursement(plan);
                const planBusy = busyAction?.planId === plan.id;

                return (
                  <article
                    key={plan.id}
                    className={`rounded-3xl border p-4 sm:p-5 ${
                      isOverdue(plan)
                        ? "border-red-300/25 bg-red-500/[0.07]"
                        : plan.account_source === "personal" &&
                            outstandingReimbursement > 0
                          ? "border-amber-300/20 bg-amber-500/[0.06]"
                          : "border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words text-xl font-black">
                            {plan.title}
                          </h3>
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ring-1 ${statusClass(
                              plan.status,
                            )}`}
                          >
                            {statusLabel(plan.status)}
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-white/55">
                          {plan.supplier_name || "No supplier linked"}
                          {plan.budget_category_label
                            ? ` · ${plan.budget_category_label}`
                            : ""}
                        </p>

                        {plan.description ? (
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/45">
                            {plan.description}
                          </p>
                        ) : null}
                      </div>

                      <Link
                        href={`/Admin/MoneyManagement/TrackingMoney/DirectDebits/${encodeURIComponent(
                          plan.id,
                        )}`}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-pink-500/15 px-3 py-2 text-xs font-black text-pink-100 ring-1 ring-pink-300/20 hover:bg-pink-500/25"
                      >
                        View plan
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>

                    {isOverdue(plan) ? (
                      <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-300/25 bg-red-500/10 p-3 text-sm text-red-100">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>
                          Payment {dueOccurrence?.payment_number} was due on{" "}
                          <strong>{dateLabel(dueOccurrence?.due_date)}</strong>{" "}
                          and has not been posted.
                        </p>
                      </div>
                    ) : null}

                    {plan.account_source === "personal" &&
                    outstandingReimbursement > 0 ? (
                      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm text-amber-100">
                        <UserRound className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>
                          <strong>{money(outstandingReimbursement)}</strong> is
                          awaiting reimbursement to{" "}
                          <strong>{plan.account_holder || "the payer"}</strong>.
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <div className="rounded-xl bg-black/20 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-white/40">
                          Monthly amount
                        </p>
                        <p className="mt-1 text-lg font-black">
                          {money(plan.amount_pence)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-black/20 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-white/40">
                          Next collection
                        </p>
                        <p className="mt-1 text-sm font-black">
                          {dateLabel(
                            plan.next_collection_date ||
                              nextOccurrence?.due_date ||
                              null,
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl bg-black/20 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-white/40">
                          Paying account
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-sm font-black">
                          {plan.account_source === "personal" ? (
                            <UserRound className="h-4 w-4 text-amber-200" />
                          ) : (
                            <CreditCard className="h-4 w-4 text-sky-200" />
                          )}
                          <span className="break-words">
                            {plan.account_source === "personal"
                              ? plan.account_holder || "Personal account"
                              : "Burton Pride"}
                          </span>
                        </p>
                      </div>

                      <div className="rounded-xl bg-black/20 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-white/40">
                          Progress
                        </p>
                        <p className="mt-1 text-sm font-black">
                          {plan.payments_paid || 0} paid ·{" "}
                          {plan.payments_created || 0} posted
                          {plan.total_payments
                            ? ` · ${plan.total_payments} total`
                            : " · ongoing"}
                        </p>
                      </div>
                    </div>

                    {plan.mandate_reference || plan.notes ? (
                      <div className="mt-3 rounded-xl border border-white/10 bg-black/15 p-3 text-xs leading-5 text-white/50">
                        {plan.mandate_reference ? (
                          <p>
                            Reference:{" "}
                            <strong className="text-white/80">
                              {plan.mandate_reference}
                            </strong>
                          </p>
                        ) : null}
                        {plan.notes ? (
                          <p className={plan.mandate_reference ? "mt-1" : ""}>
                            {plan.notes}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {recentOccurrences.length > 0 ? (
                      <div className="mt-4">
                        <p className="mb-2 text-xs font-black uppercase tracking-wide text-white/40">
                          Latest schedule records
                        </p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {recentOccurrences.map((occurrence) => (
                            <div
                              key={occurrence.id}
                              className="rounded-xl border border-white/10 bg-black/15 p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-black">
                                  Payment {occurrence.payment_number}
                                </p>
                                <span
                                  className={`rounded-lg px-2 py-1 text-[10px] font-black ring-1 ${occurrenceStatusClass(
                                    occurrence.status,
                                  )}`}
                                >
                                  {occurrenceStatusLabel(occurrence.status)}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-white/50">
                                {dateLabel(occurrence.due_date)}
                              </p>
                              <p className="mt-1 text-sm font-black">
                                {money(occurrence.amount_pence)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                      <button
                        type="button"
                        onClick={() => openEditPlanModal(plan)}
                        disabled={
                          planBusy ||
                          plan.status === "cancelled" ||
                          plan.status === "completed"
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-sky-500/15 px-3 py-2 text-xs font-black text-sky-100 ring-1 ring-sky-300/20 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {busyAction?.planId === plan.id &&
                        busyAction.action === "edit" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Pencil className="h-4 w-4" />
                        )}
                        Edit payment
                      </button>

                      <button
                        type="button"
                        onClick={() => openPostPaymentModal(plan)}
                        disabled={
                          planBusy ||
                          plan.status !== "active" ||
                          !dueOccurrence
                        }
                        title={
                          plan.status !== "active"
                            ? "The plan must be active before posting."
                            : !dueOccurrence
                              ? "No scheduled payment is due yet."
                              : "Record this due payment and create its linked Money Transaction."
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-black text-emerald-100 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busyAction?.planId === plan.id &&
                        busyAction.action === "post" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CalendarCheck2 className="h-4 w-4" />
                        )}
                        Make payment
                      </button>

                      <button
                        type="button"
                        onClick={() => openInvoiceModal(plan)}
                        disabled={planBusy || !latestPostedOccurrence(plan)}
                        className="inline-flex items-center gap-2 rounded-xl bg-purple-500/15 px-3 py-2 text-xs font-black text-purple-100 ring-1 ring-purple-300/20 hover:bg-purple-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <FileUp className="h-4 w-4" />
                        Upload receipt
                      </button>

                      <button
                        type="button"
                        onClick={() => openUndoModal(plan)}
                        disabled={
                          planBusy ||
                          !latestPostedOccurrence(plan)?.transaction_id ||
                          Boolean(latestReimbursedOccurrence(plan))
                        }
                        title={
                          latestReimbursedOccurrence(plan)
                            ? "Undo the personal repayment first, then undo the Direct Debit payment."
                            : !latestPostedOccurrence(plan)?.transaction_id
                              ? "There is no posted payment available to undo."
                              : "Remove the linked Money Transaction and return the payment to Scheduled."
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-orange-500/15 px-3 py-2 text-xs font-black text-orange-100 ring-1 ring-orange-300/20 hover:bg-orange-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Undo payment
                      </button>

                      {plan.account_source === "personal" ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              openReimburseModal(plan)
                            }
                            disabled={
                              planBusy ||
                              !latestOutstandingReimbursementOccurrence(
                                plan,
                              )
                            }
                            title={
                              latestOutstandingReimbursementOccurrence(
                                plan,
                              )
                                ? "Record money paid from Burton Pride back to the person for the newest outstanding payment."
                                : latestPostedOccurrence(plan)
                                  ? "Every posted payment is already reimbursed."
                                  : "Make a Direct Debit payment before repaying the person."
                            }
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-black text-emerald-100 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {busyAction?.planId === plan.id &&
                            busyAction.action === "reimburse" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <HandCoins className="h-4 w-4" />
                            )}
                            Repay person
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openUndoReimbursementModal(plan)
                            }
                            disabled={
                              planBusy ||
                              !latestReimbursedOccurrence(plan)
                            }
                            title={
                              latestReimbursedOccurrence(plan)
                                ? "Undo the recorded repayment and return it to awaiting reimbursement."
                                : "No completed personal repayment is available to undo."
                            }
                            className="inline-flex items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-black text-red-100 ring-1 ring-red-300/20 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {busyAction?.planId === plan.id &&
                            busyAction.action === "undo_reimburse" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                            Undo repay person
                          </button>
                        </>
                      ) : null}

                      {plan.status === "active" ? (
                        <button
                          type="button"
                          onClick={() => void updatePlanStatus(plan, "paused")}
                          disabled={planBusy}
                          className="inline-flex items-center gap-2 rounded-xl bg-amber-500/15 px-3 py-2 text-xs font-black text-amber-100 ring-1 ring-amber-300/20 hover:bg-amber-500/25 disabled:opacity-40"
                        >
                          {busyAction?.planId === plan.id &&
                          busyAction.action === "pause" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CirclePause className="h-4 w-4" />
                          )}
                          Pause
                        </button>
                      ) : plan.status === "paused" ? (
                        <button
                          type="button"
                          onClick={() => void updatePlanStatus(plan, "active")}
                          disabled={planBusy}
                          className="inline-flex items-center gap-2 rounded-xl bg-sky-500/15 px-3 py-2 text-xs font-black text-sky-100 ring-1 ring-sky-300/20 hover:bg-sky-500/25 disabled:opacity-40"
                        >
                          {busyAction?.planId === plan.id &&
                          busyAction.action === "resume" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CirclePlay className="h-4 w-4" />
                          )}
                          Resume
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => openCancelPlanModal(plan)}
                        disabled={
                          planBusy ||
                          plan.status === "cancelled" ||
                          plan.status === "completed"
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-black text-red-100 ring-1 ring-red-300/20 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {busyAction?.planId === plan.id &&
                        busyAction.action === "cancel" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Cancel future
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {invoiceModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={uploadInvoice}
            className="w-full max-w-lg rounded-3xl border border-purple-300/20 bg-[#121220] p-6 shadow-2xl"
          >
            <h2 className="text-2xl font-black">Upload receipt or receipt</h2>
            <p className="mt-2 text-sm text-white/55">
              Payment {invoiceModal.occurrence.payment_number} ·{" "}
              {money(invoiceModal.occurrence.amount_pence)}
            </p>
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              onChange={(event) =>
                setInvoiceModal((previous) =>
                  previous
                    ? {
                        ...previous,
                        file: event.target.files?.[0] || null,
                        error: "",
                      }
                    : previous,
                )
              }
              className="mt-5 w-full rounded-xl bg-black/30 p-3 text-sm ring-1 ring-white/10"
            />
            <p className="mt-2 text-xs text-white/40">
              PDF, JPG, PNG or WEBP. Maximum 10 MB.
            </p>
            {invoiceModal.error ? (
              <p className="mt-4 whitespace-pre-line rounded-xl bg-red-500/10 p-3 text-sm font-bold text-red-100 ring-1 ring-red-300/20">
                {invoiceModal.error}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInvoiceModal(null)}
                className="rounded-xl bg-white/10 px-4 py-3 font-black"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!invoiceModal.file || busyAction?.action === "invoice"}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-500 px-4 py-3 font-black disabled:opacity-40"
              >
                {busyAction?.action === "invoice" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                Upload receipt
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {undoModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-orange-300/20 bg-[#121220] p-6 shadow-2xl">
            <h2 className="text-2xl font-black">Undo this payment?</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              The linked Money Transaction will be removed and payment{" "}
              {undoModal.occurrence.payment_number} will return to Scheduled.
              This is blocked once the person has been reimbursed.
            </p>
            <textarea
              value={undoModal.reason}
              onChange={(event) =>
                setUndoModal((previous) =>
                  previous
                    ? { ...previous, reason: event.target.value, error: "" }
                    : previous,
                )
              }
              className="mt-5 min-h-24 w-full rounded-xl bg-black/30 p-3 ring-1 ring-orange-300/20"
            />
            {undoModal.error ? (
              <p className="mt-3 whitespace-pre-line rounded-xl bg-red-500/10 p-3 text-sm font-bold text-red-100">
                {undoModal.error}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUndoModal(null)}
                className="rounded-xl bg-white/10 px-4 py-3 font-black"
              >
                Keep payment
              </button>
              <button
                type="button"
                onClick={() => void confirmUndoPayment()}
                disabled={!undoModal.reason.trim() || busyAction?.action === "undo"}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 font-black text-black disabled:opacity-40"
              >
                <RotateCcw className="h-4 w-4" />
                Undo payment
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reimburseModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={confirmReimbursement}
            className="w-full max-w-lg rounded-3xl border border-emerald-300/20 bg-[#121220] p-6 shadow-2xl"
          >
            <h2 className="text-2xl font-black">Repay person</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Record {money(reimburseModal.occurrence.amount_pence)} as repaid to{" "}
              <strong className="text-white">
                {reimburseModal.plan.account_holder || "the payer"}
              </strong>
              .
            </p>
            <label className="mt-5 block">
              <span className="mb-1 block text-sm font-black">
                Repayment method
              </span>
              <select
                value={reimburseModal.payment_method}
                onChange={(event) =>
                  setReimburseModal((previous) =>
                    previous
                      ? { ...previous, payment_method: event.target.value }
                      : previous,
                  )
                }
                className="w-full rounded-xl bg-black/30 p-3 ring-1 ring-white/10"
              >
                <option className="bg-[#11111f]">Bank Transfer</option>
                <option className="bg-[#11111f]">Cash</option>
                <option className="bg-[#11111f]">PayPal</option>
                <option className="bg-[#11111f]">Other</option>
              </select>
            </label>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-black">
                Repayment reference
              </span>
              <input
                value={reimburseModal.reference}
                onChange={(event) =>
                  setReimburseModal((previous) =>
                    previous
                      ? { ...previous, reference: event.target.value }
                      : previous,
                  )
                }
                className="w-full rounded-xl bg-black/30 p-3 ring-1 ring-white/10"
              />
            </label>
            {reimburseModal.error ? (
              <p className="mt-3 whitespace-pre-line rounded-xl bg-red-500/10 p-3 text-sm font-bold text-red-100">
                {reimburseModal.error}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReimburseModal(null)}
                className="rounded-xl bg-white/10 px-4 py-3 font-black"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyAction?.action === "reimburse"}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-black text-black disabled:opacity-40"
              >
                <HandCoins className="h-4 w-4" />
                Record repayment
              </button>
            </div>
          </form>
        </div>
      ) : null}


      {undoReimbursementModal ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={confirmUndoReimbursement}
            className="w-full max-w-lg rounded-3xl border border-red-300/20 bg-[#121220] p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-red-500/15 p-3 text-red-200 ring-1 ring-red-300/20">
                <RotateCcw className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black">Undo repay person</h2>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  This will mark{" "}
                  {money(
                    undoReimbursementModal.occurrence.amount_pence,
                  )}{" "}
                  as awaiting repayment again for{" "}
                  <strong className="text-white">
                    {undoReimbursementModal.plan.account_holder ||
                      "the payer"}
                  </strong>
                  .
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100">
              The original Direct Debit payment will stay posted. Only the
              personal repayment will be undone.
            </div>

            <label className="mt-5 block">
              <span className="mb-1 block text-sm font-black">
                Reason for undoing repayment
              </span>
              <textarea
                value={undoReimbursementModal.reason}
                onChange={(event) =>
                  setUndoReimbursementModal((previous) =>
                    previous
                      ? {
                          ...previous,
                          reason: event.target.value,
                          error: "",
                        }
                      : previous,
                  )
                }
                className="min-h-24 w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-red-300/40"
                placeholder="Explain why this repayment needs to be undone"
              />
            </label>

            <label className="mt-4 flex items-start gap-3 rounded-xl border border-red-300/20 bg-red-500/10 p-3">
              <input
                type="checkbox"
                checked={
                  undoReimbursementModal.delete_repayment_transaction
                }
                onChange={(event) =>
                  setUndoReimbursementModal((previous) =>
                    previous
                      ? {
                          ...previous,
                          delete_repayment_transaction:
                            event.target.checked,
                          error: "",
                        }
                      : previous,
                  )
                }
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="block text-sm font-black text-red-100">
                  Remove the linked repayment transaction
                </span>
                <span className="mt-1 block text-xs leading-5 text-red-100/65">
                  Keep this selected when the repayment transaction was created
                  by mistake. The original Direct Debit payment is not deleted.
                </span>
              </span>
            </label>

            {undoReimbursementModal.error ? (
              <p className="mt-4 whitespace-pre-line rounded-xl bg-red-500/10 p-3 text-sm font-bold text-red-100">
                {undoReimbursementModal.error}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeUndoReimbursementModal}
                disabled={
                  busyAction?.action === "undo_reimburse"
                }
                className="rounded-xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  busyAction?.action === "undo_reimburse" ||
                  !undoReimbursementModal.reason.trim()
                }
                className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-3 font-black text-white hover:bg-red-400 disabled:opacity-40"
              >
                {busyAction?.action === "undo_reimburse" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Undo repayment
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editModal ? (
        <div
          className="fixed inset-0 z-[80] overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-direct-debit-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditPlanModal();
            }
          }}
        >
          <form
            onSubmit={saveEditedPlan}
            className="mx-auto my-4 w-full max-w-3xl rounded-3xl border border-sky-300/20 bg-[#121220] p-5 shadow-2xl sm:my-8 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="rounded-2xl bg-sky-500/15 p-3 text-sky-200 ring-1 ring-sky-300/20">
                  <Pencil className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="edit-direct-debit-title"
                    className="text-2xl font-black text-white"
                  >
                    Edit Direct Debit payment
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-white/55">
                    Update the plan and all future scheduled payments. Posted
                    and paid transactions will not be changed.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeEditPlanModal}
                disabled={
                  busyAction?.planId === editModal.plan.id &&
                  busyAction.action === "edit"
                }
                className="rounded-xl bg-white/10 p-2 text-white/70 ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-40"
                aria-label="Close edit payment popup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
              Changes to the amount or paying account apply only to occurrences
              that are still scheduled. Historic posted and paid records remain
              exactly as originally recorded.
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-sm font-black">
                  Plan title <span className="text-red-200">*</span>
                </span>
                <input
                  value={editModal.form.title}
                  onChange={(event) =>
                    updateEditForm("title", event.target.value)
                  }
                  className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-sky-300/45"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="mb-1 block text-sm font-black">
                  Description
                </span>
                <textarea
                  value={editModal.form.description}
                  onChange={(event) =>
                    updateEditForm("description", event.target.value)
                  }
                  className="min-h-20 w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-sky-300/45"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-black">
                  Monthly amount <span className="text-red-200">*</span>
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-3 text-white/45">
                    £
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editModal.form.amount}
                    onChange={(event) =>
                      updateEditForm("amount", event.target.value)
                    }
                    className="w-full rounded-xl bg-black/30 py-3 pl-8 pr-3 text-white outline-none ring-1 ring-white/10 focus:ring-sky-300/45"
                  />
                </div>
              </label>

              <label>
                <span className="mb-1 block text-sm font-black">
                  Paying account
                </span>
                <select
                  value={editModal.form.account_source}
                  onChange={(event) => {
                    const source = event.target
                      .value as DirectDebitAccountSource;
                    setEditModal((previous) =>
                      previous
                        ? {
                            ...previous,
                            error: "",
                            form: {
                              ...previous.form,
                              account_source: source,
                              account_holder:
                                source === "personal"
                                  ? previous.form.account_holder
                                  : "",
                            },
                          }
                        : previous,
                    );
                  }}
                  className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-sky-300/45"
                >
                  <option className="bg-[#11111f]" value="organisation">
                    Burton Pride bank account
                  </option>
                  <option className="bg-[#11111f]" value="personal">
                    Someone’s personal account
                  </option>
                </select>
              </label>

              {editModal.form.account_source === "personal" ? (
                <label>
                  <span className="mb-1 block text-sm font-black">
                    Person paying <span className="text-red-200">*</span>
                  </span>
                  <input
                    value={editModal.form.account_holder}
                    onChange={(event) =>
                      updateEditForm("account_holder", event.target.value)
                    }
                    className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-amber-300/20 focus:ring-amber-300/45"
                  />
                </label>
              ) : (
                <div className="rounded-xl border border-sky-300/20 bg-sky-500/10 p-3 text-sm leading-6 text-sky-100">
                  Future scheduled payments will leave Burton Pride’s account.
                </div>
              )}

              <label>
                <span className="mb-1 block text-sm font-black">
                  Supplier name
                </span>
                <input
                  value={editModal.form.supplier_name}
                  onChange={(event) =>
                    updateEditForm("supplier_name", event.target.value)
                  }
                  className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-sky-300/45"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-black">
                  Mandate or account reference
                </span>
                <input
                  value={editModal.form.mandate_reference}
                  onChange={(event) =>
                    updateEditForm("mandate_reference", event.target.value)
                  }
                  className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-sky-300/45"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-black">
                  Budget key
                </span>
                <input
                  value={editModal.form.budget_category_key}
                  onChange={(event) =>
                    updateEditForm("budget_category_key", event.target.value)
                  }
                  className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-sky-300/45"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-black">
                  Budget label
                </span>
                <input
                  value={editModal.form.budget_category_label}
                  onChange={(event) =>
                    updateEditForm("budget_category_label", event.target.value)
                  }
                  className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-sky-300/45"
                />
              </label>

              {editModal.form.account_source === "personal" ? (
                <div className="sm:col-span-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={editModal.form.auto_reimburse_person}
                      onChange={(event) =>
                        updateEditForm(
                          "auto_reimburse_person",
                          event.target.checked,
                        )
                      }
                      className="mt-1 h-4 w-4"
                    />
                    <span>
                      <span className="block text-sm font-black text-emerald-100">
                        Automatically create repayment after each payment
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-emerald-100/65">
                        This only applies to future monthly payments.
                      </span>
                    </span>
                  </label>

                  {editModal.form.auto_reimburse_person ? (
                    <select
                      value={editModal.form.reimbursement_payment_method}
                      onChange={(event) =>
                        updateEditForm(
                          "reimbursement_payment_method",
                          event.target.value,
                        )
                      }
                      className="mt-4 w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-emerald-300/20"
                    >
                      <option className="bg-[#11111f]">Bank Transfer</option>
                      <option className="bg-[#11111f]">Cash</option>
                      <option className="bg-[#11111f]">PayPal</option>
                      <option className="bg-[#11111f]">Other</option>
                    </select>
                  ) : null}

                  {editModal.form.auto_reimburse_person ? (
                    <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-4">
                      <label className="block">
                        <span className="block text-sm font-black text-cyan-100">
                          Repayment picture for Money Tracker
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-cyan-100/65">
                          This picture will be linked to future automatic
                          repayment records.
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) => {
                            setEditRepaymentImage(
                              event.target.files?.[0] || null,
                            );
                            setRemoveExistingRepaymentImage(false);
                          }}
                          className="mt-3 w-full rounded-xl bg-black/30 p-3 text-sm text-white ring-1 ring-cyan-300/20 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-2 file:text-xs file:font-black file:text-black"
                        />
                      </label>

                      {editRepaymentImage ? (
                        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-black/20 p-3 text-xs">
                          <div className="min-w-0">
                            <p className="truncate font-black text-white">
                              {editRepaymentImage.name}
                            </p>
                            <p className="mt-1 text-white/45">
                              {(editRepaymentImage.size / 1024 / 1024).toFixed(
                                2,
                              )}{" "}
                              MB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditRepaymentImage(null)}
                            className="rounded-lg bg-white/10 px-3 py-2 font-black text-white/75 hover:bg-white/15"
                          >
                            Remove selected
                          </button>
                        </div>
                      ) : editModal.plan.reimbursement_image_url &&
                        !removeExistingRepaymentImage ? (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                          <p className="truncate text-xs font-black text-white">
                            Current picture:{" "}
                            {editModal.plan.reimbursement_image_file_name ||
                              "Repayment picture"}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <a
                              href={editModal.plan.reimbursement_image_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-cyan-500/15 px-3 py-2 text-xs font-black text-cyan-100 ring-1 ring-cyan-300/20"
                            >
                              View picture
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                setRemoveExistingRepaymentImage(true)
                              }
                              className="rounded-lg bg-red-500/15 px-3 py-2 text-xs font-black text-red-100 ring-1 ring-red-300/20"
                            >
                              Remove picture
                            </button>
                          </div>
                        </div>
                      ) : removeExistingRepaymentImage ? (
                        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-red-500/10 p-3 text-xs text-red-100 ring-1 ring-red-300/20">
                          <span className="font-bold">
                            The current picture will be removed when saved.
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setRemoveExistingRepaymentImage(false)
                            }
                            className="rounded-lg bg-white/10 px-3 py-2 font-black"
                          >
                            Undo
                          </button>
                        </div>
                      ) : null}

                      <p className="mt-3 text-xs text-cyan-100/50">
                        JPG, PNG or WEBP. Maximum 10 MB.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <label className="sm:col-span-2">
                <span className="mb-1 block text-sm font-black">
                  Plan notes
                </span>
                <textarea
                  value={editModal.form.notes}
                  onChange={(event) =>
                    updateEditForm("notes", event.target.value)
                  }
                  className="min-h-24 w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-sky-300/45"
                />
              </label>
            </div>

            {editModal.error ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-300/20 bg-red-500/10 p-3 text-sm font-bold text-red-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="whitespace-pre-line break-words">
                  {editModal.error}
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeEditPlanModal}
                disabled={
                  busyAction?.planId === editModal.plan.id &&
                  busyAction.action === "edit"
                }
                className="rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  busyAction?.planId === editModal.plan.id &&
                  busyAction.action === "edit"
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-black text-black hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busyAction?.planId === editModal.plan.id &&
                busyAction.action === "edit" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pencil className="h-4 w-4" />
                )}
                {busyAction?.planId === editModal.plan.id &&
                busyAction.action === "edit"
                  ? "Saving changes..."
                  : "Save payment changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {confirmModal?.kind === "post" ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-direct-debit-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeConfirmModal();
            }
          }}
        >
          <div className="w-full max-w-lg rounded-3xl border border-emerald-300/20 bg-[#121220] p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-200 ring-1 ring-emerald-300/20">
                  <CalendarCheck2 className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="post-direct-debit-title"
                    className="text-xl font-black text-white sm:text-2xl"
                  >
                    Make this Direct Debit payment?
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-white/55">
                    This records this monthly Direct Debit as paid and creates its linked Money Transaction.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeConfirmModal}
                disabled={
                  busyAction?.planId === confirmModal.plan.id &&
                  busyAction.action === "post"
                }
                className="rounded-xl bg-white/10 p-2 text-white/70 ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-40"
                aria-label="Close payment confirmation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-black uppercase tracking-wide text-white/40">
                    Plan
                  </dt>
                  <dd className="mt-1 break-words font-black text-white">
                    {confirmModal.plan.title}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-black uppercase tracking-wide text-white/40">
                    Payment
                  </dt>
                  <dd className="mt-1 font-black text-white">
                    {confirmModal.occurrence.payment_number}
                    {confirmModal.plan.total_payments
                      ? ` of ${confirmModal.plan.total_payments}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-black uppercase tracking-wide text-white/40">
                    Amount
                  </dt>
                  <dd className="mt-1 text-lg font-black text-emerald-100">
                    {money(confirmModal.occurrence.amount_pence)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-black uppercase tracking-wide text-white/40">
                    Due date
                  </dt>
                  <dd className="mt-1 font-black text-white">
                    {dateLabel(confirmModal.occurrence.due_date)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-4 rounded-2xl border border-purple-300/20 bg-purple-500/10 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-purple-500/15 p-2 text-purple-200 ring-1 ring-purple-300/20">
                  <FileUp className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <label className="block">
                    <span className="block text-sm font-black text-purple-100">
                      Upload receipt or receipt
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-purple-100/65">
                      Optional. The file will be attached to this monthly payment
                      after the Money Transaction is created.
                    </span>

                    <input
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      onChange={(event) =>
                        setConfirmModal((previous) =>
                          previous
                            ? {
                                ...previous,
                                invoiceFile:
                                  event.target.files?.[0] || null,
                                invoiceError: "",
                              }
                            : previous,
                        )
                      }
                      className="mt-3 w-full rounded-xl bg-black/30 p-3 text-sm text-white ring-1 ring-purple-300/20 file:mr-3 file:rounded-lg file:border-0 file:bg-purple-500 file:px-3 file:py-2 file:text-xs file:font-black file:text-white hover:file:bg-purple-400"
                    />
                  </label>

                  {confirmModal.invoiceFile ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-purple-300/20 bg-black/20 p-3 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-black text-white">
                          {confirmModal.invoiceFile.name}
                        </p>
                        <p className="mt-1 text-white/45">
                          {(confirmModal.invoiceFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmModal((previous) =>
                            previous
                              ? {
                                  ...previous,
                                  invoiceFile: null,
                                  invoiceError: "",
                                }
                              : previous,
                          )
                        }
                        disabled={
                          busyAction?.planId === confirmModal.plan.id &&
                          busyAction.action === "post"
                        }
                        className="rounded-lg bg-white/10 px-3 py-2 font-black text-white/75 hover:bg-white/15 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {confirmModal.invoiceError ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-300/20 bg-red-500/10 p-3 text-sm font-bold text-red-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="whitespace-pre-line break-words">
                    {confirmModal.invoiceError}
                  </p>
                </div>
              ) : null}

              <p className="mt-3 text-xs text-purple-100/50">
                Accepted: PDF, JPG, PNG or WEBP. Maximum file size 10 MB.
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100">
              Only continue when the payment has left the paying account and should now appear in Money Transactions.
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeConfirmModal}
                disabled={
                  busyAction?.planId === confirmModal.plan.id &&
                  busyAction.action === "post"
                }
                className="rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-40"
              >
                Keep scheduled
              </button>
              <button
                type="button"
                onClick={() => void confirmPostDuePayment()}
                disabled={
                  busyAction?.planId === confirmModal.plan.id &&
                  busyAction.action === "post"
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busyAction?.planId === confirmModal.plan.id &&
                busyAction.action === "post" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CalendarCheck2 className="h-4 w-4" />
                )}
                {busyAction?.planId === confirmModal.plan.id &&
                busyAction.action === "post"
                  ? confirmModal.invoiceFile
                    ? "Making payment and uploading..."
                    : "Making payment..."
                  : confirmModal.invoiceFile
                    ? "Make payment and upload"
                    : "Make payment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelModal ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-direct-debit-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCancelPlanModal();
            }
          }}
        >
          <div className="w-full max-w-xl rounded-3xl border border-red-300/20 bg-[#121220] p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="rounded-2xl bg-red-500/15 p-3 text-red-200 ring-1 ring-red-300/20">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="cancel-direct-debit-title"
                    className="text-xl font-black text-white sm:text-2xl"
                  >
                    Cancel future payments?
                  </h2>
                  <p className="mt-1 break-words text-sm leading-6 text-white/55">
                    You are cancelling future payments for{" "}
                    <strong className="text-white">
                      {cancelModal.plan.title}
                    </strong>
                    .
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeCancelPlanModal}
                disabled={
                  busyAction?.planId === cancelModal.plan.id &&
                  busyAction.action === "cancel"
                }
                className="rounded-xl bg-white/10 p-2 text-white/70 ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-40"
                aria-label="Close cancellation popup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
              Posted and paid transactions will remain in the accounts. Only
              future scheduled occurrences will be cancelled.
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-black text-white">
                Cancellation reason <span className="text-red-200">*</span>
              </span>
              <textarea
                value={cancelModal.reason}
                onChange={(event) =>
                  setCancelModal((previous) =>
                    previous
                      ? {
                          ...previous,
                          reason: event.target.value,
                          error: "",
                        }
                      : previous,
                  )
                }
                placeholder="Explain why this Direct Debit is being cancelled..."
                className="min-h-28 w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-red-300/20 placeholder:text-white/30 focus:ring-red-300/45"
                autoFocus
              />
            </label>

            {cancelModal.error ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-300/20 bg-red-500/10 p-3 text-sm font-bold text-red-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="whitespace-pre-line break-words">
                  {cancelModal.error}
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCancelPlanModal}
                disabled={
                  busyAction?.planId === cancelModal.plan.id &&
                  busyAction.action === "cancel"
                }
                className="rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-40"
              >
                Keep Direct Debit
              </button>
              <button
                type="button"
                onClick={() => void confirmCancelPlan()}
                disabled={
                  !cancelModal.reason.trim() ||
                  (busyAction?.planId === cancelModal.plan.id &&
                    busyAction.action === "cancel")
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-black text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busyAction?.planId === cancelModal.plan.id &&
                busyAction.action === "cancel" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {busyAction?.planId === cancelModal.plan.id &&
                busyAction.action === "cancel"
                  ? "Cancelling..."
                  : "Cancel future payments"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreate ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6">
          <form
            onSubmit={createPlan}
            className="mx-auto my-4 max-w-3xl rounded-3xl border border-white/10 bg-[#121220] p-4 shadow-2xl sm:my-8 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black sm:text-3xl">
                  Create Direct Debit
                </h2>
                <p className="mt-1 text-sm leading-6 text-white/55">
                  This creates a monthly plan and schedule. It does not count
                  every future payment as completed spending today.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                disabled={saving}
                className="rounded-xl bg-white/10 p-2 text-white/70 ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-40"
                aria-label="Close Direct Debit form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4 text-sm leading-6 text-sky-100">
              <p className="font-black">Monthly accounting rule</p>
              <p className="mt-1 text-sky-100/75">
                One occurrence is created per calendar month. A money
                transaction is created only when that occurrence is posted.
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-sm font-black">
                  Plan title <span className="text-red-200">*</span>
                </span>
                <input
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                  placeholder="Example: Website hosting"
                  className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-pink-300/45"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="mb-1 block text-sm font-black">
                  Description
                </span>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateForm("description", event.target.value)
                  }
                  placeholder="What service or commitment is this for?"
                  className="min-h-20 w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-pink-300/45"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-black">
                  Monthly amount <span className="text-red-200">*</span>
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-3 text-white/45">
                    £
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) =>
                      updateForm("amount", event.target.value)
                    }
                    placeholder="25.00"
                    className="w-full rounded-xl bg-black/30 py-3 pl-8 pr-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-pink-300/45"
                  />
                </div>
              </label>

              <label>
                <span className="mb-1 block text-sm font-black">
                  First collection date <span className="text-red-200">*</span>
                </span>
                <input
                  type="date"
                  value={form.first_collection_date}
                  onChange={(event) =>
                    updateForm("first_collection_date", event.target.value)
                  }
                  className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/45"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-black">
                  Paying account <span className="text-red-200">*</span>
                </span>
                <select
                  value={form.account_source}
                  onChange={(event) => {
                    const source = event.target
                      .value as DirectDebitAccountSource;
                    setForm((previous) => ({
                      ...previous,
                      account_source: source,
                      account_holder:
                        source === "personal" ? previous.account_holder : "",
                    }));
                  }}
                  className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/45"
                >
                  <option className="bg-[#11111f]" value="organisation">
                    Burton Pride bank account
                  </option>
                  <option className="bg-[#11111f]" value="personal">
                    Someone’s personal account
                  </option>
                </select>
              </label>

              {form.account_source === "personal" ? (
                <label>
                  <span className="mb-1 block text-sm font-black">
                    Person paying <span className="text-red-200">*</span>
                  </span>
                  <input
                    value={form.account_holder}
                    onChange={(event) =>
                      updateForm("account_holder", event.target.value)
                    }
                    placeholder="Who will pay from their personal account?"
                    className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-amber-300/20 placeholder:text-white/30 focus:ring-amber-300/45"
                  />
                </label>
              ) : (
                <div className="rounded-xl border border-sky-300/20 bg-sky-500/10 p-3 text-sm leading-6 text-sky-100">
                  This will reduce Burton Pride’s bank balance when each
                  occurrence is posted.
                </div>
              )}

              {form.account_source === "personal" ? (
                <div className="sm:col-span-2 rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100">
                  Personal-account payments will be saved as Personal Funds and
                  shown as awaiting reimbursement. They will not reduce Burton
                  Pride’s bank balance until the person is repaid.
                </div>
              ) : null}

              <label>
                <span className="mb-1 block text-sm font-black">
                  Supplier name
                </span>
                <input
                  value={form.supplier_name}
                  onChange={(event) =>
                    updateForm("supplier_name", event.target.value)
                  }
                  placeholder="What is the title of the Direct Debit supplier?"
                  className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-pink-300/45"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-black">
                  Mandate or account reference
                </span>
                <input
                  value={form.mandate_reference}
                  onChange={(event) =>
                    updateForm("mandate_reference", event.target.value)
                  }
                  placeholder="Reference shown on bank statement"
                  className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-pink-300/45"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-black">
                  Budget key
                </span>
                <input
                  value={form.budget_category_key}
                  onChange={(event) =>
                    updateForm("budget_category_key", event.target.value)
                  }
                  placeholder="Example: website"
                  className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-pink-300/45"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-black">
                  Budget label
                </span>
                <input
                  value={form.budget_category_label}
                  onChange={(event) =>
                    updateForm("budget_category_label", event.target.value)
                  }
                  placeholder="Example: Website and systems"
                  className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-pink-300/45"
                />
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-purple-300/20 bg-purple-500/10 p-3 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_open_ended}
                  onChange={(event) =>
                    updateForm("is_open_ended", event.target.checked)
                  }
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="block text-sm font-black">
                    Ongoing until cancelled
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-purple-100/65">
                    Use this for services with no planned final month. Future
                    months can be cancelled later without deleting history.
                  </span>
                </span>
              </label>

              {!form.is_open_ended ? (
                <label>
                  <span className="mb-1 block text-sm font-black">
                    Number of monthly payments
                  </span>
                  <input
                    type="number"
                    min="2"
                    max="60"
                    step="1"
                    value={form.total_payments}
                    onChange={(event) =>
                      updateForm("total_payments", event.target.value)
                    }
                    className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/45"
                  />
                  <p className="mt-1 text-xs text-white/40">
                    Minimum 2, maximum 60 payments.
                  </p>
                </label>
              ) : null}

              {form.account_source === "personal" ? (
                <div className="sm:col-span-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={form.auto_reimburse_person}
                      onChange={(event) =>
                        updateForm("auto_reimburse_person", event.target.checked)
                      }
                      className="mt-1 h-4 w-4"
                    />
                    <span>
                      <span className="block text-sm font-black text-emerald-100">
                        Automatically create repayment after each payment
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-emerald-100/65">
                        When a monthly payment is made, the system will also create
                        a linked reimbursement transaction to the person who paid.
                      </span>
                    </span>
                  </label>

                  {form.auto_reimburse_person ? (
                    <label className="mt-4 block">
                      <span className="mb-1 block text-sm font-black">
                        Repayment method
                      </span>
                      <select
                        value={form.reimbursement_payment_method}
                        onChange={(event) =>
                          updateForm(
                            "reimbursement_payment_method",
                            event.target.value,
                          )
                        }
                        className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-emerald-300/20"
                      >
                        <option className="bg-[#11111f]">Bank Transfer</option>
                        <option className="bg-[#11111f]">Cash</option>
                        <option className="bg-[#11111f]">PayPal</option>
                        <option className="bg-[#11111f]">Other</option>
                      </select>
                    </label>
                  ) : null}

                  {form.auto_reimburse_person ? (
                    <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-4">
                      <label className="block">
                        <span className="block text-sm font-black text-cyan-100">
                          Repayment picture for Money Tracker
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-cyan-100/65">
                          Upload a screenshot, bank-transfer confirmation or
                          other picture that Money Tracker can show with the
                          automatic repayment record.
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) =>
                            setCreateRepaymentImage(
                              event.target.files?.[0] || null,
                            )
                          }
                          className="mt-3 w-full rounded-xl bg-black/30 p-3 text-sm text-white ring-1 ring-cyan-300/20 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-2 file:text-xs file:font-black file:text-black"
                        />
                      </label>

                      {createRepaymentImage ? (
                        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-black/20 p-3 text-xs">
                          <div className="min-w-0">
                            <p className="truncate font-black text-white">
                              {createRepaymentImage.name}
                            </p>
                            <p className="mt-1 text-white/45">
                              {(createRepaymentImage.size / 1024 / 1024).toFixed(
                                2,
                              )}{" "}
                              MB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCreateRepaymentImage(null)}
                            className="rounded-lg bg-white/10 px-3 py-2 font-black text-white/75 hover:bg-white/15"
                          >
                            Remove
                          </button>
                        </div>
                      ) : null}

                      <p className="mt-3 text-xs text-cyan-100/50">
                        JPG, PNG or WEBP. Maximum 10 MB.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <label className={form.is_open_ended ? "sm:col-span-2" : ""}>
                <span className="mb-1 block text-sm font-black">Plan notes</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  placeholder="Cancellation terms, price review date or other information..."
                  className="min-h-24 w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-pink-300/45"
                />
              </label>
            </div>

            {formError ? (
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm font-bold text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {formError}
              </div>
            ) : (
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-100">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                Ready to create this monthly Direct Debit schedule.
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={saving}
                className="rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || Boolean(formError)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-500 px-5 py-3 text-sm font-black text-white hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {saving ? "Creating plan..." : "Create monthly Direct Debit"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
