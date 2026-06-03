import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CurrentAdmin = {
  userId: string;
  actorName: string;
  actorEmail: string | null;
};

function poundsToPence(value: unknown) {
  const amount = Number(String(value || "0").replace(/,/g, ""));

  if (!Number.isFinite(amount)) return 0;

  return Math.round(amount * 100);
}

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function formatPounds(pence: number) {
  return `£${((Number(pence) || 0) / 100).toFixed(2)}`;
}

function nameFromEmail(email?: string | null) {
  const cleanEmail = cleanString(email);

  if (!cleanEmail || !cleanEmail.includes("@")) return "";

  return cleanEmail
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

async function getCurrentAdmin(): Promise<CurrentAdmin> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("You must be signed in.");
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("admin_users")
    .select("id, email, name, full_name, role, is_active")
    .eq("supabase_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError) {
    throw new Error(adminError.message || "Failed to load admin account.");
  }

  if (!admin) {
    throw new Error("No active admin account is linked to this Supabase user.");
  }

  const actorEmail = cleanString(admin.email || user.email) || null;
  const actorName =
    cleanString(admin.name) ||
    cleanString(admin.full_name) ||
    nameFromEmail(actorEmail) ||
    "Unknown admin";

  return {
    userId: user.id,
    actorName,
    actorEmail,
  };
}

async function createCashTinAuditLog({
  action,
  transactionId,
  transactionTitle,
  actorUserId,
  actorName,
  actorEmail,
  beforeData,
  afterData,
  changedFields,
  metadata,
}: {
  action: "create" | "edit" | "delete" | "restore" | "permanent_delete";
  transactionId?: string | null;
  transactionTitle?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  beforeData?: any;
  afterData?: any;
  changedFields?: any;
  metadata?: any;
}) {
  const { error } = await supabaseAdmin.from("admin_money_audit_logs").insert({
    action,
    transaction_id: transactionId || null,
    transaction_title: transactionTitle || null,
    actor_user_id: actorUserId || null,
    actor_name: actorName || "Unknown admin",
    actor_email: actorEmail || null,
    before_data: beforeData || null,
    after_data: afterData || null,
    changed_fields: changedFields || null,
    metadata: {
      source: "cash_tin_tracker",
      source_label: "Cash Tin Tracker",
      ...metadata,
    },
  });

  if (error) {
    console.error("Failed to create cash tin audit log:", error);
  }
}

async function makeCashTinReference(year: string) {
  const { count, error } = await supabaseAdmin
    .from("money_transactions")
    .select("id", { count: "exact", head: true })
    .eq("source", "cash_tin")
    .gte("transaction_date", `${year}-01-01`)
    .lte("transaction_date", `${year}-12-31`);

  if (error) {
    const fallback = Date.now().toString().slice(-6);
    return `CASH-${year}-${fallback}`;
  }

  const nextNumber = String((count || 0) + 1).padStart(4, "0");
  return `CASH-${year}-${nextNumber}`;
}

function buildTransactionDescription(row: {
  title: string;
  location: string;
  starting_cash_pence: number;
  money_received_pence: number;
  cash_spent_pence: number;
  money_banked_pence: number;
  counted_by: string;
  second_counter: string;
  banked_by: string;
  banked_at: string | null;
  notes: string;
}) {
  const difference =
    row.money_banked_pence -
    (row.money_received_pence - row.cash_spent_pence);

  return [
    `Cash tin fundraising record: ${row.title}`,
    row.location ? `Location: ${row.location}` : "",
    `Starting cash: ${formatPounds(row.starting_cash_pence)}`,
    `Money received: ${formatPounds(row.money_received_pence)}`,
    `Cash spent: ${formatPounds(row.cash_spent_pence)}`,
    `Money banked: ${formatPounds(row.money_banked_pence)}`,
    `Difference: ${formatPounds(difference)}`,
    row.counted_by ? `Counted by: ${row.counted_by}` : "",
    row.second_counter ? `Second counter: ${row.second_counter}` : "",
    row.banked_by ? `Banked by: ${row.banked_by}` : "",
    row.banked_at ? `Date banked: ${row.banked_at}` : "",
    row.notes ? `Notes: ${row.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function GET(req: Request) {
  try {
    await getCurrentAdmin();

    const { searchParams } = new URL(req.url);

    const year =
      searchParams.get("year") || new Date().getFullYear().toString();

    const { data, error } = await supabaseAdmin
      .from("money_cash_tin_days")
      .select("*")
      .eq("year", year)
      .is("deleted_at", null)
      .order("event_date", { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to load cash tin records.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      cashTinDays: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load cash tin records.",
      },
      { status: error?.message === "You must be signed in." ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId, actorName, actorEmail } = await getCurrentAdmin();

    const body = await req.json();

    const eventDate = cleanString(body.eventDate);
    const title = cleanString(body.title);
    const year = cleanString(body.year) || eventDate.slice(0, 4);

    if (!eventDate) {
      return NextResponse.json(
        { ok: false, error: "Please choose the fundraising date." },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { ok: false, error: "Please enter a title for this cash tin day." },
        { status: 400 }
      );
    }

    const cashTinRow = {
      year,
      event_date: eventDate,
      title,
      location: cleanString(body.location),
      starting_cash_pence: poundsToPence(body.startingCash),
      money_received_pence: poundsToPence(body.moneyReceived),
      cash_spent_pence: poundsToPence(body.cashSpent),
      money_banked_pence: poundsToPence(body.moneyBanked),
      counted_by: cleanString(body.countedBy) || actorName,
      second_counter: cleanString(body.secondCounter),
      banked_by: cleanString(body.bankedBy),
      banked_at: cleanString(body.bankedAt) || null,
      notes: cleanString(body.notes),
      deleted_at: null,
      deleted_by: null,
      updated_at: new Date().toISOString(),
    };

    const transactionReference = await makeCashTinReference(year);
    const description = buildTransactionDescription(cashTinRow);

    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from("money_transactions")
      .insert({
        transaction_reference: transactionReference,
        title: `Cash fundraising - ${cashTinRow.title}`,
        description,
        type: "income",
        category: "Cash Fundraising",
        amount_pence: cashTinRow.money_received_pence,
        payment_method: "Cash",
        transaction_date: cashTinRow.event_date,
        source: "cash_tin",
        deleted_at: null,
        deleted_by: null,
      })
      .select("*")
      .single();

    if (transactionError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to add cash tin money into the money tracker.",
          details: transactionError.message,
        },
        { status: 500 }
      );
    }

    const { data: cashTinDay, error: cashTinError } = await supabaseAdmin
      .from("money_cash_tin_days")
      .insert({
        ...cashTinRow,
        money_transaction_id: transaction.id,
      })
      .select("*")
      .single();

    if (cashTinError) {
      await supabaseAdmin
        .from("money_transactions")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: "System rollback",
        })
        .eq("id", transaction.id);

      return NextResponse.json(
        {
          ok: false,
          error: "Failed to save cash tin record.",
          details: cashTinError.message,
        },
        { status: 500 }
      );
    }

    await createCashTinAuditLog({
      action: "create",
      transactionId: transaction.id,
      transactionTitle: transaction.title,
      actorUserId: userId,
      actorName,
      actorEmail,
      beforeData: null,
      afterData: {
        cashTinDay,
        moneyTransaction: transaction,
      },
      changedFields: {
        cash_tin_created: {
          before: null,
          after: cashTinDay.id,
        },
        money_transaction_created: {
          before: null,
          after: transaction.id,
        },
        transaction_reference: {
          before: null,
          after: transaction.transaction_reference,
        },
        amount_pence: {
          before: null,
          after: transaction.amount_pence,
        },
      },
      metadata: {
        route: "/api/admin/money/cash-tins",
        cash_tin_id: cashTinDay.id,
        money_transaction_id: transaction.id,
        event_date: cashTinDay.event_date,
        title: cashTinDay.title,
        location: cashTinDay.location,
        message:
          "Cash tin record created and linked money tracker income created.",
      },
    });

    return NextResponse.json({
      ok: true,
      cashTinDay,
      moneyTransaction: transaction,
      message:
        "Cash tin record saved and added to money tracker as money coming in.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to save cash tin record.",
      },
      { status: error?.message === "You must be signed in." ? 401 : 500 }
    );
  }
}