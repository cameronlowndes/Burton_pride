

export const DIRECT_DEBIT_PLAN_STATUSES = [
  "draft",
  "active",
  "paused",
  "cancelled",
  "completed",
] as const;

export type DirectDebitStatus =
  (typeof DIRECT_DEBIT_PLAN_STATUSES)[number];

export const DIRECT_DEBIT_ACCOUNT_SOURCES = [
  "organisation",
  "personal",
] as const;

export type DirectDebitAccountSource =
  (typeof DIRECT_DEBIT_ACCOUNT_SOURCES)[number];

export const DIRECT_DEBIT_OCCURRENCE_STATUSES = [
  "scheduled",
  "posted",
  "paid",
  "failed",
  "skipped",
  "cancelled",
] as const;

export type DirectDebitOccurrenceStatus =
  (typeof DIRECT_DEBIT_OCCURRENCE_STATUSES)[number];

export const DIRECT_DEBIT_REIMBURSEMENT_STATUSES = [
  "not_required",
  "awaiting_reimbursement",
  "partially_reimbursed",
  "reimbursed",
] as const;

export type DirectDebitReimbursementStatus =
  (typeof DIRECT_DEBIT_REIMBURSEMENT_STATUSES)[number];

export type DirectDebitPlan = {
  id: string;
  title: string;
  description: string | null;
  amount_pence: number;

  first_collection_date: string;
  next_collection_date: string | null;
  collection_day: number | null;

  total_payments: number | null;
  is_open_ended: boolean;

  account_source: DirectDebitAccountSource;
  account_holder: string | null;

  supplier_id: string | null;
  supplier_name: string | null;

  budget_category_key: string | null;
  budget_category_label: string | null;

  mandate_reference: string | null;
  notes: string | null;

  status: DirectDebitStatus;
  payments_created: number;
  payments_paid: number;
  payments_failed: number;

  outstanding_reimbursement_pence: number;

  created_by?: string | null;
  created_by_name?: string | null;
  created_by_email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
};

export type DirectDebitOccurrence = {
  id: string;
  plan_id: string;
  due_date: string;
  period_month: string;
  payment_number: number;
  amount_pence: number;
  status: DirectDebitOccurrenceStatus;

  transaction_id: string | null;
  reimbursement_status: DirectDebitReimbursementStatus;
  reimbursement_id?: string | null;

  failure_reason?: string | null;
  skipped_reason?: string | null;
  posted_at?: string | null;
  paid_at?: string | null;
  failed_at?: string | null;
  skipped_at?: string | null;
  cancelled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DirectDebitCreateInput = {
  title: string;
  description?: string | null;
  amount?: string | number | null;
  amount_pence?: number | null;

  first_collection_date: string;
  total_payments?: string | number | null;
  is_open_ended?: boolean;

  account_source: DirectDebitAccountSource;
  account_holder?: string | null;

  supplier_id?: string | null;
  supplier_name?: string | null;
  budget_category_key?: string | null;
  budget_category_label?: string | null;
  mandate_reference?: string | null;
  notes?: string | null;

  created_by?: string | null;
  created_by_name?: string | null;
  created_by_email?: string | null;
};

export type NormalisedDirectDebitCreateInput = {
  title: string;
  description: string | null;
  amount_pence: number;

  first_collection_date: string;
  collection_day: number;
  total_payments: number | null;
  is_open_ended: boolean;

  account_source: DirectDebitAccountSource;
  account_holder: string | null;

  supplier_id: string | null;
  supplier_name: string | null;
  budget_category_key: string | null;
  budget_category_label: string | null;
  mandate_reference: string | null;
  notes: string | null;

  created_by: string | null;
  created_by_name: string | null;
  created_by_email: string | null;
};

export type DirectDebitValidationIssue = {
  field: keyof DirectDebitCreateInput | "general";
  message: string;
};

export class DirectDebitValidationError extends Error {
  readonly code = "DIRECT_DEBIT_VALIDATION_ERROR";
  readonly issues: DirectDebitValidationIssue[];

  constructor(issues: DirectDebitValidationIssue[]) {
    super(issues[0]?.message || "The Direct Debit details are invalid.");
    this.name = "DirectDebitValidationError";
    this.issues = issues;
  }
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableText(value: unknown): string | null {
  const clean = cleanText(value);
  return clean || null;
}

function integerValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number)) return null;

  return number;
}

export function isDirectDebitStatus(
  value: unknown,
): value is DirectDebitStatus {
  return DIRECT_DEBIT_PLAN_STATUSES.includes(value as DirectDebitStatus);
}

export function isDirectDebitAccountSource(
  value: unknown,
): value is DirectDebitAccountSource {
  return DIRECT_DEBIT_ACCOUNT_SOURCES.includes(
    value as DirectDebitAccountSource,
  );
}

export function isDirectDebitOccurrenceStatus(
  value: unknown,
): value is DirectDebitOccurrenceStatus {
  return DIRECT_DEBIT_OCCURRENCE_STATUSES.includes(
    value as DirectDebitOccurrenceStatus,
  );
}

export function poundsToPence(value: string | number): number {
  const cleanValue =
    typeof value === "string"
      ? value.replace(/£/g, "").replace(/,/g, "").trim()
      : value;

  const amount = Number(cleanValue);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new DirectDebitValidationError([
      {
        field: "amount",
        message: "The monthly Direct Debit amount must be greater than zero.",
      },
    ]);
  }

  const pence = Math.round((amount + Number.EPSILON) * 100);

  if (!Number.isSafeInteger(pence) || pence <= 0) {
    throw new DirectDebitValidationError([
      {
        field: "amount",
        message: "The monthly Direct Debit amount is too large or invalid.",
      },
    ]);
  }

  return pence;
}

export function penceToPounds(value: number | null | undefined): number {
  const pence = Number(value || 0);
  return Number.isFinite(pence) ? pence / 100 : 0;
}

export function penceToPoundsInput(
  value: number | null | undefined,
): string {
  const pounds = penceToPounds(value);
  return pounds > 0 ? pounds.toFixed(2) : "";
}

/**
 * Parses a YYYY-MM-DD value without allowing timezone conversion to move it
 * into a different calendar date.
 */
export function parseDirectDebitDate(value: unknown): Date | null {
  const clean = cleanText(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function directDebitPeriodMonth(value: string | Date): string {
  const date = value instanceof Date ? value : parseDirectDebitDate(value);
  if (!date) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-01`;
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0, 12, 0, 0, 0).getDate();
}

/**
 * Adds calendar months and preserves the chosen collection day where possible.
 * A day such as 31 becomes the final valid day in a shorter month.
 */
export function addDirectDebitMonths(
  value: string | Date,
  monthsToAdd: number,
  preferredCollectionDay?: number | null,
): string {
  const start = value instanceof Date ? new Date(value) : parseDirectDebitDate(value);

  if (!start) {
    throw new DirectDebitValidationError([
      {
        field: "first_collection_date",
        message: "The first collection date is invalid.",
      },
    ]);
  }

  const offset = Number.isFinite(monthsToAdd) ? Math.trunc(monthsToAdd) : 0;
  const collectionDay = Math.min(
    31,
    Math.max(1, preferredCollectionDay || start.getDate()),
  );

  const targetMonthStart = new Date(
    start.getFullYear(),
    start.getMonth() + offset,
    1,
    12,
    0,
    0,
    0,
  );

  const targetDay = Math.min(
    collectionDay,
    daysInMonth(targetMonthStart.getFullYear(), targetMonthStart.getMonth()),
  );

  targetMonthStart.setDate(targetDay);
  return toDateInputValue(targetMonthStart);
}

export function buildDirectDebitSchedule(params: {
  firstCollectionDate: string;
  totalPayments: number;
  amountPence: number;
  planId?: string;
}): Array<
  Pick<
    DirectDebitOccurrence,
    | "plan_id"
    | "due_date"
    | "period_month"
    | "payment_number"
    | "amount_pence"
    | "status"
    | "transaction_id"
    | "reimbursement_status"
  >
> {
  const firstDate = parseDirectDebitDate(params.firstCollectionDate);

  if (!firstDate) {
    throw new DirectDebitValidationError([
      {
        field: "first_collection_date",
        message: "The first collection date is invalid.",
      },
    ]);
  }

  if (
    !Number.isInteger(params.totalPayments) ||
    params.totalPayments < 1 ||
    params.totalPayments > 60
  ) {
    throw new DirectDebitValidationError([
      {
        field: "total_payments",
        message: "The number of scheduled payments must be between 1 and 60.",
      },
    ]);
  }

  if (!Number.isSafeInteger(params.amountPence) || params.amountPence <= 0) {
    throw new DirectDebitValidationError([
      {
        field: "amount_pence",
        message: "The monthly Direct Debit amount is invalid.",
      },
    ]);
  }

  const collectionDay = firstDate.getDate();

  return Array.from({ length: params.totalPayments }, (_, index) => {
    const dueDate = addDirectDebitMonths(
      params.firstCollectionDate,
      index,
      collectionDay,
    );

    return {
      plan_id: params.planId || "",
      due_date: dueDate,
      period_month: directDebitPeriodMonth(dueDate),
      payment_number: index + 1,
      amount_pence: params.amountPence,
      status: "scheduled" as const,
      transaction_id: null,
      reimbursement_status: "not_required" as const,
    };
  });
}

export function validateDirectDebitInput(
  input: DirectDebitCreateInput,
): NormalisedDirectDebitCreateInput {
  const issues: DirectDebitValidationIssue[] = [];

  const title = cleanText(input.title);
  const description = nullableText(input.description);
  const firstCollectionDate = cleanText(input.first_collection_date);
  const firstDate = parseDirectDebitDate(firstCollectionDate);
  const isOpenEnded = Boolean(input.is_open_ended);
  const totalPaymentsValue = integerValue(input.total_payments);
  const accountSource = input.account_source;
  const accountHolder = nullableText(input.account_holder);

  let amountPence = integerValue(input.amount_pence);

  if (amountPence === null && input.amount !== null && input.amount !== undefined) {
    try {
      amountPence = poundsToPence(input.amount);
    } catch (error) {
      if (error instanceof DirectDebitValidationError) {
        issues.push(...error.issues);
      } else {
        issues.push({
          field: "amount",
          message: "The monthly Direct Debit amount is invalid.",
        });
      }
    }
  }

  if (!title) {
    issues.push({
      field: "title",
      message: "Enter a title for the Direct Debit plan.",
    });
  }

  if (!amountPence || amountPence <= 0) {
    if (!issues.some((issue) => issue.field === "amount")) {
      issues.push({
        field: "amount_pence",
        message: "The monthly Direct Debit amount must be greater than zero.",
      });
    }
  }

  if (!firstCollectionDate) {
    issues.push({
      field: "first_collection_date",
      message: "Choose the first monthly collection date.",
    });
  } else if (!firstDate) {
    issues.push({
      field: "first_collection_date",
      message: "The first collection date must be a valid date.",
    });
  }

  if (!isDirectDebitAccountSource(accountSource)) {
    issues.push({
      field: "account_source",
      message: "Choose whether Burton Pride or a personal account pays.",
    });
  }

  if (accountSource === "personal" && !accountHolder) {
    issues.push({
      field: "account_holder",
      message: "Enter the name of the person whose account pays this Direct Debit.",
    });
  }

  if (!isOpenEnded) {
    if (totalPaymentsValue === null) {
      issues.push({
        field: "total_payments",
        message: "Enter how many monthly payments the plan will make.",
      });
    } else if (totalPaymentsValue < 2 || totalPaymentsValue > 60) {
      issues.push({
        field: "total_payments",
        message: "A fixed Direct Debit plan must contain between 2 and 60 payments.",
      });
    }
  }

  if (issues.length > 0) {
    throw new DirectDebitValidationError(issues);
  }

  return {
    title,
    description,
    amount_pence: amountPence as number,
    first_collection_date: firstCollectionDate,
    collection_day: (firstDate as Date).getDate(),
    total_payments: isOpenEnded ? null : (totalPaymentsValue as number),
    is_open_ended: isOpenEnded,
    account_source: accountSource,
    account_holder: accountSource === "personal" ? accountHolder : null,
    supplier_id: nullableText(input.supplier_id),
    supplier_name: nullableText(input.supplier_name),
    budget_category_key: nullableText(input.budget_category_key),
    budget_category_label: nullableText(input.budget_category_label),
    mandate_reference: nullableText(input.mandate_reference),
    notes: nullableText(input.notes),
    created_by: nullableText(input.created_by),
    created_by_name: nullableText(input.created_by_name),
    created_by_email: nullableText(input.created_by_email),
  };
}

export function directDebitStatusLabel(status: DirectDebitStatus): string {
  if (status === "draft") return "Draft";
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  if (status === "cancelled") return "Cancelled";
  return "Completed";
}

export function directDebitOccurrenceStatusLabel(
  status: DirectDebitOccurrenceStatus,
): string {
  if (status === "scheduled") return "Scheduled";
  if (status === "posted") return "Posted";
  if (status === "paid") return "Paid";
  if (status === "failed") return "Failed";
  if (status === "skipped") return "Skipped";
  return "Cancelled";
}

export function directDebitAccountSourceLabel(
  source: DirectDebitAccountSource,
): string {
  return source === "personal"
    ? "Personal account"
    : "Burton Pride account";
}

export function directDebitReimbursementStatusLabel(
  status: DirectDebitReimbursementStatus,
): string {
  if (status === "awaiting_reimbursement") return "Reimbursement due";
  if (status === "partially_reimbursed") return "Partially reimbursed";
  if (status === "reimbursed") return "Reimbursed";
  return "Not required";
}

export function directDebitPaymentProgress(plan: Pick<
  DirectDebitPlan,
  "payments_created" | "payments_paid" | "total_payments" | "is_open_ended"
>): string {
  const paid = Math.max(0, Number(plan.payments_paid || 0));

  if (plan.is_open_ended || plan.total_payments === null) {
    return `${paid} paid · open-ended`;
  }

  return `${paid} of ${Math.max(0, Number(plan.total_payments || 0))} paid`;
}

export function isDirectDebitPlanMutable(status: DirectDebitStatus): boolean {
  return status === "draft" || status === "active" || status === "paused";
}

export function canPauseDirectDebitPlan(status: DirectDebitStatus): boolean {
  return status === "active";
}

export function canResumeDirectDebitPlan(status: DirectDebitStatus): boolean {
  return status === "paused";
}

export function canCancelDirectDebitPlan(status: DirectDebitStatus): boolean {
  return status !== "cancelled" && status !== "completed";
}

export function isDirectDebitOccurrenceResolved(
  status: DirectDebitOccurrenceStatus,
): boolean {
  return status === "paid" || status === "skipped" || status === "cancelled";
}

export function directDebitApiErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "The Direct Debit request failed.";
  }

  const row = payload as Record<string, unknown>;
  const parts = [
    cleanText(row.error || row.message),
    row.code ? `Code: ${cleanText(row.code)}` : "",
    row.details ? `Details: ${cleanText(row.details)}` : "",
    row.hint ? `Hint: ${cleanText(row.hint)}` : "",
  ].filter(Boolean);

  return parts.join("\n") || "The Direct Debit request failed.";
}
