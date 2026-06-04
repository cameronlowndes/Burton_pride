import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { requireAdmin } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildChangedFields(beforeData: any, afterData: any) {
  return {
    deleted_at: {
      before: beforeData?.deleted_at ?? null,
      after: afterData?.deleted_at ?? null,
    },
    deleted_by: {
      before: beforeData?.deleted_by ?? null,
      after: afterData?.deleted_by ?? null,
    },
    updated_at: {
      before: beforeData?.updated_at ?? null,
      after: afterData?.updated_at ?? null,
    },
  };
}

function isCashTinTransaction(transaction: any) {
  return (
    transaction?.source === "cash_tin" ||
    transaction?.category === "Cash Fundraising" ||
    transaction?.payment_method === "Cash"
  );
}

async function getActor() {
  const admin = await requireAdmin();
  const safeAdmin = admin as any;

  const actorName =
    safeAdmin?.name ||
    safeAdmin?.full_name ||
    safeAdmin?.fullName ||
    safeAdmin?.username ||
    safeAdmin?.display_name ||
    "Unknown admin";

  const actorEmail = safeAdmin?.email || null;
  const actorUserId = safeAdmin?.id || null;

  return {
    actorUserId,
    actorName,
    actorEmail,
  };
}

export async function PATCH(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { actorUserId, actorName, actorEmail } = await getActor();

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing transaction ID.",
        },
        { status: 400 }
      );
    }

    const { data: beforeTransaction, error: beforeError } = await supabaseAdmin
      .from("money_transactions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (beforeError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            beforeError.message ||
            "Failed to load transaction before restore.",
          details: beforeError,
        },
        { status: 500 }
      );
    }

    if (!beforeTransaction) {
      return NextResponse.json(
        {
          ok: false,
          error: "Transaction not found.",
        },
        { status: 404 }
      );
    }

    if (!beforeTransaction.deleted_at) {
      return NextResponse.json(
        {
          ok: false,
          error: "This transaction is not hidden, so it cannot be restored.",
        },
        { status: 400 }
      );
    }

    const restoredAt = new Date().toISOString();

    const { data: restoredTransaction, error: restoreError } =
      await supabaseAdmin
        .from("money_transactions")
        .update({
          deleted_at: null,
          deleted_by: null,
          updated_at: restoredAt,
        })
        .eq("id", id)
        .select("*")
        .single();

    if (restoreError) {
      return NextResponse.json(
        {
          ok: false,
          error: restoreError.message || "Failed to restore transaction.",
          details: restoreError,
        },
        { status: 500 }
      );
    }

    let restoredCashTinRecord: any = null;

    if (isCashTinTransaction(restoredTransaction)) {
      const { data: cashTinRecord, error: cashTinRestoreError } =
        await supabaseAdmin
          .from("money_cash_tin_days")
          .update({
            deleted_at: null,
            deleted_by: null,
            updated_at: restoredAt,
          })
          .eq("money_transaction_id", restoredTransaction.id)
          .select("*")
          .maybeSingle();

      if (cashTinRestoreError) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Transaction was restored, but the linked cash tin record could not be restored.",
            details: cashTinRestoreError,
            transaction: restoredTransaction,
          },
          { status: 500 }
        );
      }

      restoredCashTinRecord = cashTinRecord;
    }

    const changedFields = buildChangedFields(
      beforeTransaction,
      restoredTransaction
    );

    const auditPayload = {
      action: "restore",
      transaction_id: restoredTransaction.id,
      transaction_title:
        restoredTransaction.title || beforeTransaction.title || null,
      actor_user_id: actorUserId,
      actor_name: actorName,
      actor_email: actorEmail,
      before_data: beforeTransaction,
      after_data: restoredTransaction,
      changed_fields: changedFields,
      metadata: {
        source: "money_tracker",
        route: "/api/admin/money/transactions/[id]/restore",
        restored_from_hidden: true,
        restored_cash_tin_record: Boolean(restoredCashTinRecord),
        restored_cash_tin_record_id: restoredCashTinRecord?.id || null,
        restored_at: restoredAt,
      },
    };

    const { data: auditLog, error: auditError } = await supabaseAdmin
      .from("admin_money_audit_logs")
      .insert(auditPayload)
      .select("*")
      .single();

    if (auditError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            auditError.message ||
            "Transaction was restored, but the audit log could not be saved.",
          details: auditError,
          transaction: restoredTransaction,
          restoredCashTinRecord,
          auditPayload,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      transaction: restoredTransaction,
      restoredCashTinRecord,
      auditLog,
      message: restoredCashTinRecord
        ? "Transaction restored, cash tin record returned to Cash Tin Tracker, and audit log saved successfully."
        : "Transaction restored and audit log saved successfully.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Something went wrong restoring transaction.",
      },
      { status: 500 }
    );
  }
}