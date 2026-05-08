import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createMoneyAuditLog } from "@/lib/adminMoneyAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing transaction ID",
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const repaid = Boolean(body.repaid);

    const { data: beforeData, error: loadError } = await supabaseAdmin
      .from("money_transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (loadError) {
      return NextResponse.json(
        {
          ok: false,
          error: loadError.message,
          details: loadError,
        },
        { status: 500 }
      );
    }

    if (beforeData?.deleted_at) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This transaction is in the deleted area. Restore it before changing repayment status.",
        },
        { status: 400 }
      );
    }

    const isPersonalFunds =
      beforeData?.type === "expense" &&
      (beforeData?.is_personal_funds === true ||
        String(beforeData?.payment_method || "").toLowerCase() ===
          "personal funds");

    if (!isPersonalFunds) {
      return NextResponse.json(
        {
          ok: false,
          error: "Only personal funds transactions can be marked paid back.",
        },
        { status: 400 }
      );
    }

    const updatedAt = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("money_transactions")
      .update({
        personal_funds_repaid: repaid,
        personal_funds_repaid_at: repaid ? updatedAt : null,
        updated_at: updatedAt,
      })
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error,
        },
        { status: 500 }
      );
    }

    await createMoneyAuditLog({
      action: repaid ? "mark_paid_back" : "mark_not_paid_back",
      transactionId: id,
      transactionTitle: data?.title || beforeData?.title || null,
      beforeData,
      afterData: data,
      metadata: {
        source: "money_tracker",
        route: "/api/admin/money/transactions/[id]/repayment",
        personal_funds_repaid: repaid,
      },
    });

    return NextResponse.json({
      ok: true,
      transaction: data,
      message: repaid
        ? "Personal funds marked as paid back"
        : "Personal funds marked as not paid back",
    });
  } catch (err) {
    console.error("Money repayment PATCH error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}