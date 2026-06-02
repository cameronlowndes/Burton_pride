import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { createMoneyAuditLog } from "@/lib/money/adminMoneyAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BankReconciliationStatus =
  | "unmatched"
  | "matched"
  | "needs_review"
  | "ignored";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

const allowedStatuses: BankReconciliationStatus[] = [
  "unmatched",
  "matched",
  "needs_review",
  "ignored",
];

function getUserName(user: any) {
  const firstName = user?.firstName || "";
  const lastName = user?.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName) return fullName;

  const email =
    user?.emailAddresses?.find(
      (item: any) => item.id === user.primaryEmailAddressId
    )?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    null;

  if (!email) return "Admin";

  return email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter: string) => letter.toUpperCase())
    .trim();
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "You must be signed in.",
        },
        { status: 401 }
      );
    }

    const user = await currentUser();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const status = clean(body.status) as BankReconciliationStatus;
    const note = clean(body.note || body.bank_reconciliation_note);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Transaction ID is required.",
        },
        { status: 400 }
      );
    }

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid bank reconciliation status.",
          allowedStatuses,
        },
        { status: 400 }
      );
    }

    const { data: beforeTransaction, error: beforeError } = await supabaseAdmin
      .from("money_transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (beforeError || !beforeTransaction) {
      return NextResponse.json(
        {
          ok: false,
          error: beforeError?.message || "Transaction could not be found.",
          details: beforeError,
        },
        { status: 404 }
      );
    }

    const reconciledAt =
      status === "matched" ? new Date().toISOString() : null;

    const reconciledBy = status === "matched" ? getUserName(user) : null;

    const updatePayload = {
      bank_reconciliation_status: status,
      bank_reconciliation_note: note || null,
      bank_reconciled_at: reconciledAt,
      bank_reconciled_by: reconciledBy,
    };

    const { data: updatedTransaction, error: updateError } = await supabaseAdmin
      .from("money_transactions")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError || !updatedTransaction) {
      return NextResponse.json(
        {
          ok: false,
          error:
            updateError?.message ||
            "Failed to update bank reconciliation status.",
          details: updateError,
        },
        { status: 500 }
      );
    }

    await createMoneyAuditLog({
      action: "edit",
      transactionId: updatedTransaction.id,
      transactionTitle: updatedTransaction.title || null,
      beforeData: beforeTransaction,
      afterData: updatedTransaction,
      changedFields: {
        bank_reconciliation_status: {
          before: beforeTransaction.bank_reconciliation_status || "unmatched",
          after: updatedTransaction.bank_reconciliation_status,
        },
        bank_reconciliation_note: {
          before: beforeTransaction.bank_reconciliation_note || null,
          after: updatedTransaction.bank_reconciliation_note || null,
        },
        bank_reconciled_at: {
          before: beforeTransaction.bank_reconciled_at || null,
          after: updatedTransaction.bank_reconciled_at || null,
        },
        bank_reconciled_by: {
          before: beforeTransaction.bank_reconciled_by || null,
          after: updatedTransaction.bank_reconciled_by || null,
        },
      },
      metadata: {
        source: "money_tracker",
        route: "/api/admin/money/transactions/[id]/bank-reconciliation",
        bank_reconciliation_status: status,
      },
    });

    return NextResponse.json({
      ok: true,
      transaction: updatedTransaction,
    });
  } catch (error) {
    console.error("Bank reconciliation update error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update bank reconciliation status.",
      },
      { status: 500 }
    );
  }
}