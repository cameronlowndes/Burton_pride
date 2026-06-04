import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { createMoneyAuditLog } from "@/lib/money/adminMoneyAudit";
import { requireAdmin } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type Actor = {
  userId: string | null;
  name: string;
  email: string | null;
};

function formatNameFromEmail(email?: string | null) {
  const cleanEmail = String(email || "").trim();

  if (!cleanEmail || !cleanEmail.includes("@")) {
    return null;
  }

  const namePart = cleanEmail.split("@")[0] || "";

  const name = namePart
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();

  return name || null;
}

async function getActor(): Promise<Actor> {
  const admin = await requireAdmin();
  const safeAdmin = admin as any;

  const actorEmail = safeAdmin?.email || null;

  const actorName =
    safeAdmin?.name ||
    safeAdmin?.full_name ||
    safeAdmin?.fullName ||
    safeAdmin?.username ||
    safeAdmin?.display_name ||
    formatNameFromEmail(actorEmail) ||
    "Unknown admin";

  return {
    userId: safeAdmin?.id || null,
    name: String(actorName).trim() || "Unknown admin",
    email: actorEmail,
  };
}

function normalise(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function canActorUncheckTransaction(beforeData: any, actor: Actor) {
  const checkedByUserId = beforeData?.checked_by_user_id || null;
  const checkedByEmail = beforeData?.checked_by_email || null;
  const checkedByName =
    beforeData?.checked_by || beforeData?.checked_by_name || null;

  const hasStoredUserId = Boolean(checkedByUserId);
  const hasStoredEmail = Boolean(checkedByEmail);

  if (hasStoredUserId && actor.userId && checkedByUserId === actor.userId) {
    return true;
  }

  if (
    hasStoredEmail &&
    actor.email &&
    normalise(checkedByEmail) === normalise(actor.email)
  ) {
    return true;
  }

  if (!hasStoredUserId && !hasStoredEmail && checkedByName) {
    return normalise(checkedByName) === normalise(actor.name);
  }

  return false;
}

async function loadAttachmentsForTransaction(transactionId: string) {
  const { data, error } = await supabaseAdmin
    .from("money_transaction_attachments")
    .select("*")
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load transaction attachments:", error);
    return [];
  }

  return data || [];
}

export async function POST(_req: Request, context: RouteContext) {
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

    const actor = await getActor();

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

    if (!beforeData) {
      return NextResponse.json(
        {
          ok: false,
          error: "Transaction not found.",
        },
        { status: 404 }
      );
    }

    if (beforeData.deleted_at) {
      return NextResponse.json(
        {
          ok: false,
          error: "This transaction is in the deleted area and cannot be checked.",
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const wasChecked = Boolean(beforeData.checked_at);

    if (wasChecked) {
      const canUncheck = canActorUncheckTransaction(beforeData, actor);

      if (!canUncheck) {
        return NextResponse.json(
          {
            ok: false,
            error: `Only ${
              beforeData.checked_by ||
              beforeData.checked_by_name ||
              "the admin who checked this transaction"
            } can uncheck this transaction.`,
            transaction: beforeData,
          },
          { status: 403 }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("money_transactions")
        .update({
          checked_at: null,
          checked_by: null,
          checked_by_name: null,
          checked_by_email: null,
          checked_by_user_id: null,
          updated_at: now,
        })
        .eq("id", id)
        .not("checked_at", "is", null)
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

      if (!data) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "This transaction may have already been unchecked. Refresh the page and try again.",
          },
          { status: 409 }
        );
      }

      const attachments = await loadAttachmentsForTransaction(id);

      const transactionWithAttachments = {
        ...data,
        attachments,
      };

      await createMoneyAuditLog({
        action: "edit",
        transactionId: id,
        transactionTitle: data?.title || beforeData?.title || null,
        beforeData,
        afterData: transactionWithAttachments,
        changedFields: {
          checked_at: {
            before: beforeData.checked_at || null,
            after: null,
          },
          checked_by: {
            before: beforeData.checked_by || null,
            after: null,
          },
          checked_by_name: {
            before: beforeData.checked_by_name || null,
            after: null,
          },
          checked_by_email: {
            before: beforeData.checked_by_email || null,
            after: null,
          },
          checked_by_user_id: {
            before: beforeData.checked_by_user_id || null,
            after: null,
          },
        },
        metadata: {
          source: "money_tracker",
          route: "/api/admin/money/transactions/[id]/checked",
          audit_event: "unchecked",
          transaction_reference:
            data?.transaction_reference ||
            beforeData?.transaction_reference ||
            null,
          unchecked_at: now,
          unchecked_by: actor.name,
          unchecked_by_email: actor.email,
          unchecked_by_user_id: actor.userId,
          previous_checked_at: beforeData.checked_at || null,
          previous_checked_by: beforeData.checked_by || null,
          previous_checked_by_email: beforeData.checked_by_email || null,
          previous_checked_by_user_id: beforeData.checked_by_user_id || null,
        },
      });

      return NextResponse.json({
        ok: true,
        transaction: transactionWithAttachments,
        message: `Transaction unchecked by ${actor.name}.`,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("money_transactions")
      .update({
        checked_at: now,
        checked_by: actor.name,
        checked_by_name: actor.name,
        checked_by_email: actor.email,
        checked_by_user_id: actor.userId,
        updated_at: now,
      })
      .eq("id", id)
      .is("checked_at", null)
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

    if (!data) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This transaction may have already been checked by another admin. Refresh the page and try again.",
        },
        { status: 409 }
      );
    }

    const attachments = await loadAttachmentsForTransaction(id);

    const transactionWithAttachments = {
      ...data,
      attachments,
    };

    await createMoneyAuditLog({
      action: "edit",
      transactionId: id,
      transactionTitle: data?.title || beforeData?.title || null,
      beforeData,
      afterData: transactionWithAttachments,
      changedFields: {
        checked_at: {
          before: beforeData.checked_at || null,
          after: now,
        },
        checked_by: {
          before: beforeData.checked_by || null,
          after: actor.name,
        },
        checked_by_name: {
          before: beforeData.checked_by_name || null,
          after: actor.name,
        },
        checked_by_email: {
          before: beforeData.checked_by_email || null,
          after: actor.email,
        },
        checked_by_user_id: {
          before: beforeData.checked_by_user_id || null,
          after: actor.userId,
        },
      },
      metadata: {
        source: "money_tracker",
        route: "/api/admin/money/transactions/[id]/checked",
        audit_event: "checked",
        transaction_reference:
          data?.transaction_reference ||
          beforeData?.transaction_reference ||
          null,
        checked_at: now,
        checked_by: actor.name,
        checked_by_email: actor.email,
        checked_by_user_id: actor.userId,
      },
    });

    return NextResponse.json({
      ok: true,
      transaction: transactionWithAttachments,
      message: `Transaction checked by ${actor.name}.`,
    });
  } catch (err) {
    console.error("Money transaction checked error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}