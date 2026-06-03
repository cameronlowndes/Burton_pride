import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{
    id: string;
  }>;
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

async function getCurrentAdmin() {
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

async function makeCashTinReferenceBase(year: string) {
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

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { userId, actorName, actorEmail } = await getCurrentAdmin();
    const { id } = await params;

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

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("money_cash_tin_days")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        {
          ok: false,
          error: "Cash tin record could not be found.",
          details: existingError?.message,
        },
        { status: 404 }
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

    const description = buildTransactionDescription(cashTinRow);
    let bankedTransactionId = existing.money_transaction_id || null;
    let spentTransactionId = existing.cash_spent_transaction_id || null;

    if (bankedTransactionId) {
      const { error: updateBankedError } = await supabaseAdmin
        .from("money_transactions")
        .update({
          title: `Cash fundraising banked - ${cashTinRow.title}`,
          description,
          type: "income",
          category: "Cash Fundraising",
          amount_pence: cashTinRow.money_banked_pence,
          payment_method: "Cash",
          transaction_date: cashTinRow.banked_at || cashTinRow.event_date,
          source: "cash_tin",
          deleted_at: null,
          deleted_by: null,
        })
        .eq("id", bankedTransactionId);

      if (updateBankedError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to update linked money in transaction.",
            details: updateBankedError.message,
          },
          { status: 500 }
        );
      }
    } else {
      const referenceBase = await makeCashTinReferenceBase(year);

      const { data: bankedTransaction, error: createBankedError } =
        await supabaseAdmin
          .from("money_transactions")
          .insert({
            transaction_reference: `${referenceBase}-IN`,
            title: `Cash fundraising banked - ${cashTinRow.title}`,
            description,
            type: "income",
            category: "Cash Fundraising",
            amount_pence: cashTinRow.money_banked_pence,
            payment_method: "Cash",
            transaction_date: cashTinRow.banked_at || cashTinRow.event_date,
            source: "cash_tin",
            deleted_at: null,
            deleted_by: null,
          })
          .select("*")
          .single();

      if (createBankedError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to create linked money in transaction.",
            details: createBankedError.message,
          },
          { status: 500 }
        );
      }

      bankedTransactionId = bankedTransaction.id;
    }

    if (cashTinRow.cash_spent_pence > 0) {
      if (spentTransactionId) {
        const { error: updateSpentError } = await supabaseAdmin
          .from("money_transactions")
          .update({
            title: `Cash spent from tin - ${cashTinRow.title}`,
            description,
            type: "expense",
            category: "Cash Fundraising Expense",
            amount_pence: cashTinRow.cash_spent_pence,
            payment_method: "Cash",
            transaction_date: cashTinRow.event_date,
            source: "cash_tin",
            deleted_at: null,
            deleted_by: null,
          })
          .eq("id", spentTransactionId);

        if (updateSpentError) {
          return NextResponse.json(
            {
              ok: false,
              error: "Failed to update linked money out transaction.",
              details: updateSpentError.message,
            },
            { status: 500 }
          );
        }
      } else {
        const referenceBase = await makeCashTinReferenceBase(year);

        const { data: spentTransaction, error: createSpentError } =
          await supabaseAdmin
            .from("money_transactions")
            .insert({
              transaction_reference: `${referenceBase}-OUT`,
              title: `Cash spent from tin - ${cashTinRow.title}`,
              description,
              type: "expense",
              category: "Cash Fundraising Expense",
              amount_pence: cashTinRow.cash_spent_pence,
              payment_method: "Cash",
              transaction_date: cashTinRow.event_date,
              source: "cash_tin",
              deleted_at: null,
              deleted_by: null,
            })
            .select("*")
            .single();

        if (createSpentError) {
          return NextResponse.json(
            {
              ok: false,
              error: "Failed to create linked money out transaction.",
              details: createSpentError.message,
            },
            { status: 500 }
          );
        }

        spentTransactionId = spentTransaction.id;
      }
    } else if (spentTransactionId) {
      await supabaseAdmin
        .from("money_transactions")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: actorName,
        })
        .eq("id", spentTransactionId);

      spentTransactionId = null;
    }

    const { data, error } = await supabaseAdmin
      .from("money_cash_tin_days")
      .update({
        ...cashTinRow,
        money_transaction_id: bankedTransactionId,
        cash_spent_transaction_id: spentTransactionId,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to update cash tin record.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    await createCashTinAuditLog({
      action: "edit",
      transactionId: bankedTransactionId,
      transactionTitle: `Cash fundraising banked - ${cashTinRow.title}`,
      actorUserId: userId,
      actorName,
      actorEmail,
      beforeData: existing,
      afterData: data,
      changedFields: {
        money_banked_pence: {
          before: existing.money_banked_pence,
          after: data.money_banked_pence,
        },
        cash_spent_pence: {
          before: existing.cash_spent_pence,
          after: data.cash_spent_pence,
        },
        money_transaction_id: {
          before: existing.money_transaction_id,
          after: data.money_transaction_id,
        },
        cash_spent_transaction_id: {
          before: existing.cash_spent_transaction_id,
          after: data.cash_spent_transaction_id,
        },
        updated_at: {
          before: existing.updated_at,
          after: data.updated_at,
        },
      },
      metadata: {
        route: "/api/admin/money/cash-tins/[id]",
        cash_tin_id: id,
        money_transaction_id: bankedTransactionId,
        cash_spent_transaction_id: spentTransactionId,
        accounting_note:
          "Cash tin edits keep money in as money banked and money out as cash spent.",
      },
    });

    return NextResponse.json({
      ok: true,
      cashTinDay: data,
      message:
        "Cash tin record updated. Money in is the banked amount and money out is the cash spent amount.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update cash tin record.",
      },
      {
        status:
          error?.message === "You must be signed in." ||
          error?.message === "No active admin account is linked to this Supabase user."
            ? 401
            : 500,
      }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { userId, actorName, actorEmail } = await getCurrentAdmin();
    const { id } = await params;

    const deletedAt = new Date().toISOString();

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("money_cash_tin_days")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        {
          ok: false,
          error: "Cash tin record could not be found.",
          details: existingError?.message,
        },
        { status: 404 }
      );
    }

    const { error: cashTinSoftDeleteError } = await supabaseAdmin
      .from("money_cash_tin_days")
      .update({
        deleted_at: deletedAt,
        deleted_by: actorName,
        updated_at: deletedAt,
      })
      .eq("id", id);

    if (cashTinSoftDeleteError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to hide cash tin record.",
          details: cashTinSoftDeleteError.message,
        },
        { status: 500 }
      );
    }

    const linkedTransactionIds = [
      existing.money_transaction_id,
      existing.cash_spent_transaction_id,
    ].filter(Boolean);

    if (linkedTransactionIds.length > 0) {
      const { error: transactionSoftDeleteError } = await supabaseAdmin
        .from("money_transactions")
        .update({
          deleted_at: deletedAt,
          deleted_by: actorName,
        })
        .in("id", linkedTransactionIds);

      if (transactionSoftDeleteError) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Cash tin was hidden, but the linked money transactions could not be moved to hidden transactions.",
            details: transactionSoftDeleteError.message,
          },
          { status: 500 }
        );
      }
    }

    await createCashTinAuditLog({
      action: "delete",
      transactionId: existing.money_transaction_id || null,
      transactionTitle: existing.title
        ? `Cash tin hidden - ${existing.title}`
        : "Cash tin hidden",
      actorUserId: userId,
      actorName,
      actorEmail,
      beforeData: existing,
      afterData: {
        ...existing,
        deleted_at: deletedAt,
        deleted_by: actorName,
      },
      changedFields: {
        deleted_at: {
          before: existing.deleted_at || null,
          after: deletedAt,
        },
        deleted_by: {
          before: existing.deleted_by || null,
          after: actorName,
        },
        linked_transactions_hidden: {
          before: [],
          after: linkedTransactionIds,
        },
      },
      metadata: {
        route: "/api/admin/money/cash-tins/[id]",
        cash_tin_id: id,
        money_transaction_id: existing.money_transaction_id || null,
        cash_spent_transaction_id:
          existing.cash_spent_transaction_id || null,
        moved_to_hidden_transactions: true,
        soft_delete: true,
        accounting_note:
          "Cash tin soft delete hides both the banked money in and cash spent money out transactions.",
      },
    });

    return NextResponse.json({
      ok: true,
      message:
        "Cash tin record hidden. Linked money in and money out transactions moved to hidden transactions.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to hide cash tin record.",
      },
      {
        status:
          error?.message === "You must be signed in." ||
          error?.message === "No active admin account is linked to this Supabase user."
            ? 401
            : 500,
      }
    );
  }
}