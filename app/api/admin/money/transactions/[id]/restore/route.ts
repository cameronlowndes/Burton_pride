import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getActorName(user: Awaited<ReturnType<typeof currentUser>>) {
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

function getActorEmail(user: Awaited<ReturnType<typeof currentUser>>) {
  return user?.emailAddresses?.[0]?.emailAddress || null;
}

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

export async function PATCH(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
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

    const user = await currentUser();

    const actorUserId = user?.id || null;
    const actorName = getActorName(user);
    const actorEmail = getActorEmail(user);

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

    const { data: restoredTransaction, error: restoreError } =
      await supabaseAdmin
        .from("money_transactions")
        .update({
          deleted_at: null,
          deleted_by: null,
          updated_at: new Date().toISOString(),
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
        restored_at: new Date().toISOString(),
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
          auditPayload,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      transaction: restoredTransaction,
      auditLog,
      message: "Transaction restored and audit log saved successfully.",
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