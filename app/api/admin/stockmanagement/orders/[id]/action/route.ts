import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { writeStockAuditLog } from "@/lib/stockManagement/writeStockAuditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminIdentity = {
  id?: string | null;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
};

type ActionBody = {
  action?: unknown;
  notes?: unknown;
  approvalNotes?: unknown;
  supplierOrderNumber?: unknown;
  invoiceNumber?: unknown;
  orderDate?: unknown;
  expectedDeliveryDate?: unknown;
  moneyBudgetId?: unknown;
  moneyTransactionId?: unknown;
  cancellationReason?: unknown;
};

function clean(value: unknown, max = 2000) {
  const result = typeof value === "string" ? value.trim() : "";
  return result ? result.slice(0, max) : "";
}

function name(admin: AdminIdentity) {
  return (
    clean(admin.full_name, 250) ||
    clean(admin.name, 250) ||
    clean(admin.email, 250) ||
    "Administrator"
  );
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const admin = (await getCurrentAdmin()) as AdminIdentity | null;

  if (!admin?.id && !admin?.email) {
    return json({ ok: false, error: "Unauthorised." }, 401);
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as ActionBody | null;
  const action = clean(body?.action, 100);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("stock_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return json(
      {
        ok: false,
        error: "The order could not be loaded.",
        code: existingError.code,
        details: existingError.details,
        hint: existingError.hint,
      },
      500,
    );
  }

  if (!existing) {
    return json({ ok: false, error: "Stock order not found." }, 404);
  }

  const now = new Date().toISOString();
  const adminName = name(admin);
  const updates: Record<string, unknown> = {
    updated_at: now,
    updated_by: admin.id || null,
    updated_by_name: adminName,
  };

  let actionKey = "";
  let actionLabel = "";
  let riskLevel: "low" | "medium" | "high" = "low";

  if (action === "submit") {
    if (existing.status !== "draft") {
      return json(
        { ok: false, error: "Only draft orders can be submitted." },
        409,
      );
    }

    updates.status = "awaiting_approval";
    updates.submitted_at = now;
    updates.submitted_by = admin.id || null;
    updates.submitted_by_name = adminName;
    actionKey = "stock_order_submitted";
    actionLabel = "Stock order submitted";
  } else if (action === "approve") {
    if (existing.status !== "awaiting_approval") {
      return json(
        {
          ok: false,
          error: "Only orders awaiting approval can be approved.",
        },
        409,
      );
    }

    updates.status = "approved";
    updates.approved_at = now;
    updates.approved_by = admin.id || null;
    updates.approved_by_name = adminName;
    updates.approval_notes = clean(body?.approvalNotes, 2000) || null;
    updates.money_budget_id = clean(body?.moneyBudgetId, 100) || null;
    actionKey = "stock_order_approved";
    actionLabel = "Stock order approved";
    riskLevel = "medium";
  } else if (action === "place") {
    if (existing.status !== "approved") {
      return json(
        {
          ok: false,
          error: "Only approved orders can be marked as ordered.",
        },
        409,
      );
    }

    updates.status = "ordered";
    updates.ordered_at = now;
    updates.ordered_by = admin.id || null;
    updates.ordered_by_name = adminName;
    updates.order_date =
      clean(body?.orderDate, 20) || now.slice(0, 10);
    updates.expected_delivery_date =
      clean(body?.expectedDeliveryDate, 20) ||
      existing.expected_delivery_date;
    updates.supplier_order_number =
      clean(body?.supplierOrderNumber, 250) || null;
    updates.invoice_number = clean(body?.invoiceNumber, 250) || null;
    actionKey = "stock_order_marked_ordered";
    actionLabel = "Stock order marked as ordered";
    riskLevel = "medium";
  } else if (action === "link_transaction") {
    updates.money_transaction_id =
      clean(body?.moneyTransactionId, 100) || null;
    actionKey = "stock_order_transaction_linked";
    actionLabel = "Money transaction linked";
    riskLevel = "medium";
  } else if (action === "cancel") {
    if (existing.status === "received") {
      return json(
        {
          ok: false,
          error:
            "A fully received order cannot be cancelled. Record a refund or return instead.",
        },
        409,
      );
    }

    const cancellationReason = clean(body?.cancellationReason, 2000);

    if (!cancellationReason) {
      return json(
        {
          ok: false,
          error: "A cancellation reason is required.",
        },
        400,
      );
    }

    updates.status = "cancelled";
    updates.cancelled_at = now;
    updates.cancelled_by = admin.id || null;
    updates.cancelled_by_name = adminName;
    updates.cancellation_reason = cancellationReason;
    actionKey = "stock_order_cancelled";
    actionLabel = "Stock order cancelled";
    riskLevel = "high";
  } else {
    return json({ ok: false, error: "Unknown order action." }, 400);
  }

  const { data, error } = await supabaseAdmin
    .from("stock_orders")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return json(
      {
        ok: false,
        error: "The order action could not be completed.",
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
      500,
    );
  }

  await writeStockAuditLog({
    actionKey,
    actionLabel,
    actionCategory:
      action === "cancel"
        ? "delete"
        : action === "approve"
          ? "update"
          : "update",
    module: "orders",
    status: "success",
    riskLevel,
    admin: {
      id: admin.id || null,
      name: adminName,
      email: admin.email || null,
      role: admin.role || null,
    },
    description: `${existing.order_number} changed from ${existing.status} to ${data.status}.`,
    reason:
      clean(body?.notes, 2000) ||
      clean(body?.approvalNotes, 2000) ||
      clean(body?.cancellationReason, 2000) ||
      null,
    recordType: "stock_order",
    recordId: id,
    recordName: existing.title,
    recordReference: existing.order_number,
    oldValues: existing,
    newValues: data,
    changedFields: Object.keys(updates),
    request,
    responseStatus: 200,
    apiEndpoint: request.nextUrl.pathname,
    metadata: {
      source: "stock_order_action_api",
      action,
      moneyBudgetId: data.money_budget_id || null,
      moneyTransactionId: data.money_transaction_id || null,
    },
  });

  return json({
    ok: true,
    order: data,
    message: `${existing.order_number} was updated successfully.`,
  });
}
