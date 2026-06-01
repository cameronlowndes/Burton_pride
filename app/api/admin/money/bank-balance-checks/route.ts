import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BankBalanceCheckPayload = {
  id?: string;
  year?: string;
  real_bank_balance_pence?: number;
  realBankBalancePence?: number;
  notes?: string;
};

type MoneyTransactionRow = {
  id?: string | null;
  type?: string | null;
  category?: string | null;
  source?: string | null;
  amount_pence?: number | null;
  payment_method?: string | null;
  transaction_date?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
  sponsor_id?: string | null;
  sponsor_name?: string | null;
  sponsorship_note?: string | null;
  is_personal_funds?: boolean | null;
  personal_funds_repaid?: boolean | null;
};

type MoneyRefundRow = {
  id?: string | null;
  year?: number | string | null;
  refund_date?: string | null;
  created_at?: string | null;
  refund_type?: "money_received_back" | "money_sent_back" | string | null;
  amount_pence?: number | null;
  status?: "pending" | "completed" | "cancelled" | string | null;
  is_hidden?: boolean | null;
};

type TrackerBreakdown = {
  year: string;

  opening_balance_pence: number;

  ordinary_money_in_pence: number;
  ordinary_money_out_pence: number;

  refunds_received_back_pence: number;
  refunds_sent_back_pence: number;
  net_refund_adjustment_pence: number;

  /**
   * These are the numbers that must be shown in the Money In and Money Out
   * cards. They include completed refund adjustments exactly once.
   */
  money_in_including_refunds_pence: number;
  money_out_including_refunds_pence: number;

  available_balance_pence: number;

  current_year_transaction_count: number;
  current_year_refund_count: number;
  completed_current_year_refund_count: number;
};

function jsonError(message: string, details?: unknown, status = 500) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      details:
        details instanceof Error
          ? details.message
          : typeof details === "string"
            ? details
            : details || null,
    },
    { status },
  );
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function toPence(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return 0;

  return Math.round(numberValue);
}

function getCurrentYear() {
  return String(new Date().getFullYear());
}

function isValidYear(value: string) {
  return /^\d{4}$/.test(value) && Number(value) >= 2000 && Number(value) <= 2200;
}

function parseLimit(value: string | null, fallback = 20) {
  const parsed = Number(value || fallback);

  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;

  return Math.min(Math.floor(parsed), 100);
}

function getUserName(user: Awaited<ReturnType<typeof currentUser>>) {
  if (!user) return "Unknown user";

  const fullName = `${user.firstName || ""} ${user.lastName || ""}`
    .replace(/\s+/g, " ")
    .trim();

  if (fullName) return fullName;

  const email = user.emailAddresses?.[0]?.emailAddress || "";

  if (email) {
    return email
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .trim();
  }

  return "Unknown user";
}

function getUserEmail(user: Awaited<ReturnType<typeof currentUser>>) {
  return user?.emailAddresses?.[0]?.emailAddress || null;
}

async function getSignedInUser() {
  const user = await currentUser();

  if (!user?.id) {
    throw new Error("You must be signed in to use bank balance checks.");
  }

  return {
    userId: user.id,
    userName: getUserName(user),
    userEmail: getUserEmail(user),
  };
}

function getDateYear(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return String(date.getFullYear());
  }

  return String(value).slice(0, 4);
}

function getTransactionYear(row: MoneyTransactionRow) {
  return getDateYear(row.transaction_date || row.created_at);
}

function getRefundYear(row: MoneyRefundRow) {
  if (row.year !== undefined && row.year !== null && String(row.year).trim()) {
    return String(row.year).trim();
  }

  return getDateYear(row.refund_date || row.created_at);
}

function isRestrictedFundingTransaction(row: MoneyTransactionRow) {
  const category = String(row.category || "").trim().toLowerCase();
  const source = String(row.source || "").trim().toLowerCase();

  return Boolean(
    row.sponsor_id ||
      row.sponsor_name ||
      row.sponsorship_note ||
      source === "sponsorship" ||
      source === "grant" ||
      source === "loan" ||
      source === "restricted_funding" ||
      source === "restricted funding" ||
      category === "sponsorship" ||
      category === "grant" ||
      category === "loan" ||
      category === "restricted" ||
      category === "restricted funding",
  );
}

function isPersonalFundsTransaction(row: MoneyTransactionRow) {
  return Boolean(
    row.is_personal_funds ||
      String(row.payment_method || "").trim().toLowerCase() === "personal funds",
  );
}

function transactionAffectsGeneralBalance(row: MoneyTransactionRow) {
  if (row.deleted_at) return false;
  if (isRestrictedFundingTransaction(row)) return false;

  if (
    row.type === "expense" &&
    isPersonalFundsTransaction(row) &&
    row.personal_funds_repaid !== true
  ) {
    return false;
  }

  return row.type === "income" || row.type === "expense";
}

function refundAffectsGeneralBalance(row: MoneyRefundRow) {
  return row.status === "completed" && !row.is_hidden;
}

function applyTransaction(
  totals: { income: number; expense: number },
  row: MoneyTransactionRow,
) {
  if (!transactionAffectsGeneralBalance(row)) return totals;

  const amount = Number(row.amount_pence || 0);

  if (row.type === "income") totals.income += amount;
  if (row.type === "expense") totals.expense += amount;

  return totals;
}

function applyRefund(
  totals: { receivedBack: number; sentBack: number },
  row: MoneyRefundRow,
) {
  if (!refundAffectsGeneralBalance(row)) return totals;

  const amount = Number(row.amount_pence || 0);

  if (row.refund_type === "money_received_back") {
    totals.receivedBack += amount;
  }

  if (row.refund_type === "money_sent_back") {
    totals.sentBack += amount;
  }

  return totals;
}

async function getTrackerBreakdown(year: string): Promise<TrackerBreakdown> {
  const [transactionResult, refundResult] = await Promise.all([
    supabaseAdmin
      .from("money_transactions")
      .select(
        `
          id,
          type,
          category,
          source,
          amount_pence,
          payment_method,
          transaction_date,
          created_at,
          deleted_at,
          sponsor_id,
          sponsor_name,
          sponsorship_note,
          is_personal_funds,
          personal_funds_repaid
        `,
      )
      .is("deleted_at", null),

    supabaseAdmin
      .from("money_refunds")
      .select(
        `
          id,
          year,
          refund_date,
          created_at,
          refund_type,
          amount_pence,
          status,
          is_hidden
        `,
      ),
  ]);

  if (transactionResult.error) {
    throw new Error(
      `Could not load money_transactions: ${transactionResult.error.message}`,
    );
  }

  if (refundResult.error) {
    throw new Error(`Could not load money_refunds: ${refundResult.error.message}`);
  }

  const transactions = (transactionResult.data || []) as MoneyTransactionRow[];
  const refunds = (refundResult.data || []) as MoneyRefundRow[];

  const previousTransactions = transactions.filter((row) => {
    const rowYear = getTransactionYear(row);
    return rowYear && rowYear < year;
  });

  const currentTransactions = transactions.filter(
    (row) => getTransactionYear(row) === year,
  );

  const previousRefunds = refunds.filter((row) => {
    const rowYear = getRefundYear(row);
    return rowYear && rowYear < year;
  });

  const currentRefunds = refunds.filter((row) => getRefundYear(row) === year);

  const previousTransactionTotals = previousTransactions.reduce(
    applyTransaction,
    { income: 0, expense: 0 },
  );

  const previousRefundTotals = previousRefunds.reduce(applyRefund, {
    receivedBack: 0,
    sentBack: 0,
  });

  const openingBalance =
    previousTransactionTotals.income -
    previousTransactionTotals.expense +
    previousRefundTotals.receivedBack -
    previousRefundTotals.sentBack;

  const currentTransactionTotals = currentTransactions.reduce(applyTransaction, {
    income: 0,
    expense: 0,
  });

  const currentRefundTotals = currentRefunds.reduce(applyRefund, {
    receivedBack: 0,
    sentBack: 0,
  });

  const netRefundAdjustment =
    currentRefundTotals.receivedBack - currentRefundTotals.sentBack;

  const moneyInIncludingRefunds =
    currentTransactionTotals.income + currentRefundTotals.receivedBack;

  const moneyOutIncludingRefunds =
    currentTransactionTotals.expense + currentRefundTotals.sentBack;

  const availableBalance =
    openingBalance + moneyInIncludingRefunds - moneyOutIncludingRefunds;

  return {
    year,

    opening_balance_pence: openingBalance,

    ordinary_money_in_pence: currentTransactionTotals.income,
    ordinary_money_out_pence: currentTransactionTotals.expense,

    refunds_received_back_pence: currentRefundTotals.receivedBack,
    refunds_sent_back_pence: currentRefundTotals.sentBack,
    net_refund_adjustment_pence: netRefundAdjustment,

    money_in_including_refunds_pence: moneyInIncludingRefunds,
    money_out_including_refunds_pence: moneyOutIncludingRefunds,

    available_balance_pence: availableBalance,

    current_year_transaction_count: currentTransactions.length,
    current_year_refund_count: currentRefunds.filter((refund) => !refund.is_hidden)
      .length,
    completed_current_year_refund_count: currentRefunds.filter(
      refundAffectsGeneralBalance,
    ).length,
  };
}

function getBalanceStatus(differencePence: number) {
  return differencePence === 0 ? "matches" : "difference_found";
}

async function writeAuditLog({
  action,
  userId,
  userName,
  userEmail,
  beforeData,
  afterData,
  changedFields,
  metadata,
}: {
  action: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  changedFields?: unknown;
  metadata?: unknown;
}) {
  const payload = {
    action,
    actor_user_id: userId,
    actor_name: userName,
    actor_email: userEmail,
    before_data: beforeData || null,
    after_data: afterData || null,
    changed_fields: changedFields || null,
    metadata: metadata || {},
    created_at: new Date().toISOString(),
  };

  const { error: primaryError } = await supabaseAdmin
    .from("admin_money_audit_logs")
    .insert(payload);

  if (!primaryError) return;

  console.error(
    "Failed to write admin_money_audit_logs entry. Trying legacy table:",
    primaryError,
  );

  const { error: legacyError } = await supabaseAdmin
    .from("money_audit_logs")
    .insert(payload);

  if (legacyError) {
    console.error("Bank balance check audit log failed:", legacyError);
  }
}

function buildChangedFields(beforeData: any, afterData: any) {
  if (!beforeData) {
    return {
      created: {
        before: null,
        after: true,
      },
    };
  }

  const fields = [
    "year",
    "real_bank_balance_pence",
    "money_tracker_balance_pence",
    "difference_pence",
    "status",
    "notes",
  ];

  const changed: Record<string, { before: unknown; after: unknown }> = {};

  for (const field of fields) {
    const beforeValue = beforeData?.[field] ?? null;
    const afterValue = afterData?.[field] ?? null;

    if (beforeValue !== afterValue) {
      changed[field] = {
        before: beforeValue,
        after: afterValue,
      };
    }
  }

  return changed;
}

export async function GET(request: Request) {
  try {
    await getSignedInUser();

    const url = new URL(request.url);
    const year = cleanText(url.searchParams.get("year")) || getCurrentYear();

    if (!isValidYear(year)) {
      return jsonError("The year must be a four-digit number.", null, 400);
    }

    const limit = parseLimit(url.searchParams.get("limit"));

    const [{ data, error }, trackerBreakdown] = await Promise.all([
      supabaseAdmin
        .from("money_bank_balance_checks")
        .select("*")
        .eq("year", year)
        .order("created_at", { ascending: false })
        .limit(limit),

      getTrackerBreakdown(year),
    ]);

    if (error) {
      return jsonError("Failed to load bank balance checks.", error);
    }

    return NextResponse.json(
      {
        ok: true,
        year,
        trackerBalancePence: trackerBreakdown.money_in_including_refunds_pence,
        trackerBreakdown,
        checks: data || [],
        latestCheck: data?.[0] || null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return jsonError("Failed to load bank balance checks.", error);
  }
}

export async function POST(request: Request) {
  try {
    const { userId, userName, userEmail } = await getSignedInUser();

    const body = (await request.json()) as BankBalanceCheckPayload;
    const year = cleanText(body.year) || getCurrentYear();

    if (!isValidYear(year)) {
      return jsonError("The year must be a four-digit number.", null, 400);
    }

    const realBankBalancePence = toPence(
      body.real_bank_balance_pence ?? body.realBankBalancePence,
    );

    const trackerBreakdown = await getTrackerBreakdown(year);
    const trackerBalancePence = trackerBreakdown.money_in_including_refunds_pence;
    const differencePence = realBankBalancePence - trackerBalancePence;
    const status = getBalanceStatus(differencePence);
    const notes = cleanText(body.notes);
    const now = new Date().toISOString();

    const insertPayload = {
      year,
      real_bank_balance_pence: realBankBalancePence,
      money_tracker_balance_pence: trackerBalancePence,
      difference_pence: differencePence,
      status,
      notes: notes || null,
      checked_by_user_id: userId,
      checked_by_name: userName,
      checked_by_email: userEmail,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabaseAdmin
      .from("money_bank_balance_checks")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      return jsonError("Failed to save bank balance check.", error);
    }

    await writeAuditLog({
      action: "bank_balance_check_create",
      userId,
      userName,
      userEmail,
      beforeData: null,
      afterData: data,
      changedFields: buildChangedFields(null, data),
      metadata: {
        area: "bank_balance_checks",
        source: "money_tracker",
        audit_event: "manual_bank_balance_check",
        year,
        tracker_breakdown: trackerBreakdown,
      },
    });

    return NextResponse.json({
      ok: true,
      check: data,
      trackerBalancePence,
      trackerBreakdown,
      message:
        differencePence === 0
          ? "Bank balance check saved. The real bank balance matches Money In."
          : "Bank balance check saved. A difference was found.",
    });
  } catch (error) {
    return jsonError("Failed to save bank balance check.", error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId, userName, userEmail } = await getSignedInUser();

    const body = (await request.json()) as BankBalanceCheckPayload;
    const id = cleanText(body.id);

    if (!id) {
      return jsonError("Missing bank balance check ID.", null, 400);
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("money_bank_balance_checks")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      return jsonError("Failed to find bank balance check.", existingError);
    }

    if (!existing) {
      return jsonError("Bank balance check was not found.", null, 404);
    }

    const year = cleanText(body.year) || existing.year || getCurrentYear();

    if (!isValidYear(year)) {
      return jsonError("The year must be a four-digit number.", null, 400);
    }

    const realBankBalancePence =
      body.real_bank_balance_pence !== undefined ||
      body.realBankBalancePence !== undefined
        ? toPence(body.real_bank_balance_pence ?? body.realBankBalancePence)
        : Number(existing.real_bank_balance_pence || 0);

    const trackerBreakdown = await getTrackerBreakdown(year);
    const trackerBalancePence = trackerBreakdown.money_in_including_refunds_pence;
    const differencePence = realBankBalancePence - trackerBalancePence;
    const status = getBalanceStatus(differencePence);

    const notes =
      body.notes !== undefined ? cleanText(body.notes) : existing.notes || "";

    const updatePayload = {
      year,
      real_bank_balance_pence: realBankBalancePence,
      money_tracker_balance_pence: trackerBalancePence,
      difference_pence: differencePence,
      status,
      notes: notes || null,
      checked_by_user_id: userId,
      checked_by_name: userName,
      checked_by_email: userEmail,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("money_bank_balance_checks")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return jsonError("Failed to update bank balance check.", error);
    }

    await writeAuditLog({
      action: "bank_balance_check_update",
      userId,
      userName,
      userEmail,
      beforeData: existing,
      afterData: data,
      changedFields: buildChangedFields(existing, data),
      metadata: {
        area: "bank_balance_checks",
        source: "money_tracker",
        audit_event: "manual_bank_balance_check_updated",
        year,
        check_id: id,
        tracker_breakdown: trackerBreakdown,
      },
    });

    return NextResponse.json({
      ok: true,
      check: data,
      trackerBalancePence,
      trackerBreakdown,
      message:
        differencePence === 0
          ? "Bank balance check updated. The real bank balance matches Money In."
          : "Bank balance check updated. A difference was found.",
    });
  } catch (error) {
    return jsonError("Failed to update bank balance check.", error);
  }
}
