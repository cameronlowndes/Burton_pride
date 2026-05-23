import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BankBalanceCheckPayload = {
  year?: string;
  real_bank_balance_pence?: number;
  realBankBalancePence?: number;
  money_tracker_balance_pence?: number;
  moneyTrackerBalancePence?: number;
  notes?: string;
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
    user,
    userId: user.id,
    userName: getUserName(user),
    userEmail: getUserEmail(user),
  };
}

function getBalanceStatus(differencePence: number) {
  if (differencePence === 0) return "matches";
  return "difference_found";
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
  beforeData?: any;
  afterData?: any;
  changedFields?: any;
  metadata?: any;
}) {
  try {
    await supabaseAdmin.from("money_audit_logs").insert({
      action,
      actor_user_id: userId,
      actor_name: userName,
      actor_email: userEmail,
      before_data: beforeData || null,
      after_data: afterData || null,
      changed_fields: changedFields || null,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Bank balance check audit log failed:", error);
  }
}

async function getMoneyTrackerBalance(year: string) {
  const { data, error } = await supabaseAdmin
    .from("money_transactions")
    .select("type, amount_pence, transaction_date, created_at, deleted_at")
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  const rows = data || [];

  const yearRows = rows.filter((item) => {
    const dateValue = item.transaction_date || item.created_at;

    if (!dateValue) return false;

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return String(dateValue).slice(0, 4) === year;
    }

    return String(date.getFullYear()) === year;
  });

  const income = yearRows
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount_pence || 0), 0);

  const expense = yearRows
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount_pence || 0), 0);

  return income - expense;
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

  const changed: Record<string, { before: any; after: any }> = {};

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
    const limit = Math.min(Number(url.searchParams.get("limit") || 20), 100);

    const { data, error } = await supabaseAdmin
      .from("money_bank_balance_checks")
      .select("*")
      .eq("year", year)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return jsonError("Failed to load bank balance checks.", error);
    }

    const trackerBalance = await getMoneyTrackerBalance(year);

    return NextResponse.json({
      ok: true,
      year,
      trackerBalancePence: trackerBalance,
      checks: data || [],
      latestCheck: data?.[0] || null,
    });
  } catch (error) {
    return jsonError("Failed to load bank balance checks.", error);
  }
}

export async function POST(request: Request) {
  try {
    const { userId, userName, userEmail } = await getSignedInUser();

    const body = (await request.json()) as BankBalanceCheckPayload;

    const year = cleanText(body.year) || getCurrentYear();

    const realBankBalancePence = toPence(
      body.real_bank_balance_pence ?? body.realBankBalancePence,
    );

    const moneyTrackerBalancePence =
      body.money_tracker_balance_pence !== undefined ||
      body.moneyTrackerBalancePence !== undefined
        ? toPence(
            body.money_tracker_balance_pence ?? body.moneyTrackerBalancePence,
          )
        : await getMoneyTrackerBalance(year);

    const differencePence = realBankBalancePence - moneyTrackerBalancePence;
    const status = getBalanceStatus(differencePence);
    const notes = cleanText(body.notes);

    const insertPayload = {
      year,
      real_bank_balance_pence: realBankBalancePence,
      money_tracker_balance_pence: moneyTrackerBalancePence,
      difference_pence: differencePence,
      status,
      notes: notes || null,
      checked_by_user_id: userId,
      checked_by_name: userName,
      checked_by_email: userEmail,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
        real_bank_balance_pence: realBankBalancePence,
        money_tracker_balance_pence: moneyTrackerBalancePence,
        difference_pence: differencePence,
        status,
      },
    });

    return NextResponse.json({
      ok: true,
      check: data,
      message:
        differencePence === 0
          ? "Bank balance check saved. The real bank balance matches the money tracker balance."
          : "Bank balance check saved. A difference was found.",
    });
  } catch (error) {
    return jsonError("Failed to save bank balance check.", error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId, userName, userEmail } = await getSignedInUser();

    const body = await request.json();

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

    const realBankBalancePence =
      body.real_bank_balance_pence !== undefined ||
      body.realBankBalancePence !== undefined
        ? toPence(body.real_bank_balance_pence ?? body.realBankBalancePence)
        : Number(existing.real_bank_balance_pence || 0);

    const moneyTrackerBalancePence =
      body.money_tracker_balance_pence !== undefined ||
      body.moneyTrackerBalancePence !== undefined
        ? toPence(
            body.money_tracker_balance_pence ?? body.moneyTrackerBalancePence,
          )
        : await getMoneyTrackerBalance(year);

    const differencePence = realBankBalancePence - moneyTrackerBalancePence;
    const status = getBalanceStatus(differencePence);
    const notes =
      body.notes !== undefined ? cleanText(body.notes) : existing.notes || "";

    const updatePayload = {
      year,
      real_bank_balance_pence: realBankBalancePence,
      money_tracker_balance_pence: moneyTrackerBalancePence,
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
        real_bank_balance_pence: realBankBalancePence,
        money_tracker_balance_pence: moneyTrackerBalancePence,
        difference_pence: differencePence,
        status,
      },
    });

    return NextResponse.json({
      ok: true,
      check: data,
      message:
        differencePence === 0
          ? "Bank balance check updated. The real bank balance matches the money tracker balance."
          : "Bank balance check updated. A difference was found.",
    });
  } catch (error) {
    return jsonError("Failed to update bank balance check.", error);
  }
}