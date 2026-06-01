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

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing transaction ID." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));

    if (body.confirmText !== "DELETE") {
      return NextResponse.json(
        {
          ok: false,
          error: "Please type DELETE in capital letters to confirm.",
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
          error: beforeError.message || "Failed to load transaction.",
          details: beforeError,
        },
        { status: 500 }
      );
    }

    if (!beforeTransaction) {
      return NextResponse.json(
        { ok: false, error: "Transaction not found." },
        { status: 404 }
      );
    }

    if (!beforeTransaction.deleted_at) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This payment is not hidden. Only hidden payments can be permanently deleted from this page.",
        },
        { status: 400 }
      );
    }

    const auditPayload = {
      action: "delete",
      transaction_id: beforeTransaction.id,
      transaction_title: beforeTransaction.title || null,
      actor_user_id: actorUserId,
      actor_name: actorName,
      actor_email: actorEmail,
      before_data: beforeTransaction,
      after_data: null,
      changed_fields: {
        permanent_delete: {
          before: false,
          after: true,
        },
      },
      metadata: {
        source: "money_tracker",
        route: "/api/admin/money/transactions/[id]/permanent",
        permanentDelete: true,
        permanently_deleted_from_hidden: true,
        deleted_after_soft_delete: true,
        confirmed_with: "DELETE",
        deleted_at: new Date().toISOString(),
      },
    };

    const { error: auditError } = await supabaseAdmin
      .from("admin_money_audit_logs")
      .insert(auditPayload);

    if (auditError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            auditError.message ||
            "Could not save the audit log, so the permanent delete was stopped.",
          details: auditError,
          auditPayload,
        },
        { status: 500 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("money_transactions")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json(
        {
          ok: false,
          error: deleteError.message || "Failed to permanently delete payment.",
          details: deleteError,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Payment permanently deleted.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Something went wrong.",
      },
      { status: 500 }
    );
  }
}