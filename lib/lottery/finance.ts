export const FINANCE_API = "/api/admin/lotterymanagement/finance";
export type FinanceTotals = {
  id: string;
  title: string;
  slug: string;
  status: string;
  currency: string;
  lottery_year: number;
  mode: "unclassified" | "test" | "live";
  gross_sales_pence: number;
  refunds_pence: number;
  pending_refunds_pence: number;
  paid_costs_pence: number;
  unpaid_costs_pence: number;
  transferred_pence: number;
  net_result_pence: number;
  balance_pence: number;
  available_pence: number;
  reserve_pence: number;
  cleared_gross_pence: number;
  paid_orders: number;
  fingerprint: string;
  reconciled: boolean | null;
  reconciled_at: string | null;
  reconciliation_note: string | null;
  invalid_sources: boolean;
  imported_sales: boolean;
};
export type FinanceCost = {
  id: string;
  title: string;
  category: string;
  amount_pence: number;
  cost_date: string;
  status: "paid" | "unpaid";
  reference: string;
  note: string;
  voided_at: string | null;
  void_reason: string | null;
};
export type FinanceTransfer = {
  id: string;
  amount_pence: number;
  transfer_date: string;
  reference: string;
  note: string;
  money_transaction_id: string;
  created_at: string;
};
export type FinanceReport = {
  capabilities: { canManage: boolean; canTransfer: boolean };
  summary: Pick<
    FinanceTotals,
    | "gross_sales_pence"
    | "refunds_pence"
    | "paid_costs_pence"
    | "unpaid_costs_pence"
    | "net_result_pence"
    | "transferred_pence"
    | "balance_pence"
    | "available_pence"
  >;
  lottery: FinanceTotals | null;
  lotteries: FinanceTotals[];
  total: number;
  unclassified: number;
  needs_review: number;
  costs: FinanceCost[];
  cost_count: number;
  transfers: FinanceTransfer[];
  transfer_count: number;
};
export function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}
export function parsePounds(value: string, allowZero = false) {
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter a pounds amount with up to two decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  const pence = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (
    !Number.isSafeInteger(pence) ||
    pence > 2 ** 31 - 1 ||
    pence < (allowZero ? 0 : 1)
  )
    throw new Error("Enter an amount within the supported range.");
  return pence;
}
export function londonToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type WriteAction =
  | "cost"
  | "pay_cost"
  | "void_cost"
  | "reconcile"
  | "transfer";
export function validateWrite(value: unknown): {
  action: WriteAction;
  lotteryId: string;
  requestKey: string;
  data: Record<string, unknown>;
} {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid request.");
  const body = value as Record<string, unknown>;
  if (
    typeof body.lotteryId !== "string" ||
    !UUID_PATTERN.test(body.lotteryId) ||
    typeof body.requestKey !== "string" ||
    !UUID_PATTERN.test(body.requestKey)
  )
    throw new Error("Invalid lottery or request key.");
  if (
    !["cost", "pay_cost", "void_cost", "reconcile", "transfer"].includes(
      String(body.action),
    )
  )
    throw new Error("Unknown finance action.");
  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data))
    throw new Error("Invalid finance details.");
  const data = body.data as Record<string, unknown>;
  const text = (name: string, max: number, required = false) => {
    if (
      (data[name] !== undefined && typeof data[name] !== "string") ||
      String(data[name] || "").length > max ||
      (required && !String(data[name] || "").trim())
    )
      throw new Error(`Enter a valid ${name.replaceAll("_", " ")}.`);
  };
  const integer = (name: string, allowZero = false) => {
    const n = data[name];
    if (
      typeof n !== "number" ||
      !Number.isSafeInteger(n) ||
      n < (allowZero ? 0 : 1) ||
      n > 2147483647
    )
      throw new Error(`Enter a valid ${name.replaceAll("_", " ")}.`);
  };
  const action = body.action as WriteAction;
  text("note", 2000);
  text("reference", 200);
  if (action === "cost" || action === "transfer") {
    integer("amount_pence");
    text("date", 10, true);
    const date = String(data.date);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date + "T12:00:00Z")) ||
      new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date ||
      date > londonToday()
    )
      throw new Error("Enter a valid date no later than today.");
  }
  if (action === "cost") {
    text("title", 200, true);
    if (
      !["prizes", "payment_fees", "licence", "printing", "other"].includes(
        String(data.category),
      ) ||
      !["paid", "unpaid"].includes(String(data.status))
    )
      throw new Error("Choose a cost category and payment status.");
  }
  if (action === "pay_cost" || action === "void_cost") {
    if (typeof data.cost_id !== "string" || !UUID_PATTERN.test(data.cost_id))
      throw new Error("Choose a valid cost.");
  }
  if (action === "reconcile") {
    integer("cleared_gross_pence", true);
    integer("reserve_pence", true);
    if (
      !["unclassified", "test", "live"].includes(String(data.mode)) ||
      data.confirmed !== true ||
      String(data.note || "").trim().length < 5
    )
      throw new Error(
        "Complete the reconciliation checklist and add a reference.",
      );
  }
  if (action === "transfer") {
    text("reference", 200, true);
    if (
      data.confirmed !== true ||
      typeof data.expected_fingerprint !== "string" ||
      !/^[0-9a-f]{32}$/.test(data.expected_fingerprint)
    )
      throw new Error("Review and confirm the latest transfer figures.");
  }
  if (action === "void_cost" && String(data.note || "").trim().length < 5)
    throw new Error("Explain why this cost is being voided.");
  return {
    action,
    lotteryId: body.lotteryId,
    requestKey: body.requestKey,
    data,
  };
}
