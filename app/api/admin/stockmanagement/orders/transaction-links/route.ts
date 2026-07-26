import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminIdentity = {
  id?: string | null;
  email?: string | null;
};

type RequestBody = {
  transactionIds?: unknown;
};

function clean(value: unknown, max = 200) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function requireAdmin() {
  const admin =
    (await getCurrentAdmin()) as AdminIdentity | null;

  return admin?.id || admin?.email
    ? admin
    : null;
}

function mapOrder(row: Record<string, unknown>) {
  return {
    id: String(row.id || ""),
    orderNumber: String(
      row.order_number || "",
    ),
    title: String(row.title || ""),
    status: String(
      row.status || "draft",
    ),
    supplierName:
      row.supplier_name
        ? String(row.supplier_name)
        : null,
    estimatedTotal:
      Number(row.estimated_total || 0),
    actualTotal:
      row.actual_total === null ||
      row.actual_total === undefined
        ? null
        : Number(row.actual_total),
    expectedDeliveryDate:
      row.expected_delivery_date
        ? String(
            row.expected_delivery_date,
          )
        : null,
    moneyTransactionId: String(
      row.money_transaction_id || "",
    ),
  };
}

export async function POST(
  request: NextRequest,
) {
  const admin = await requireAdmin();

  if (!admin) {
    return json(
      {
        ok: false,
        error:
          "Unauthorised. Sign in as an administrator.",
        code: "UNAUTHORISED",
      },
      401,
    );
  }

  const body =
    (await request.json().catch(() => null)) as
      | RequestBody
      | null;

  const transactionIds = Array.isArray(
    body?.transactionIds,
  )
    ? Array.from(
        new Set(
          body.transactionIds
            .map((value) => clean(value, 100))
            .filter(Boolean),
        ),
      ).slice(0, 1000)
    : [];

  if (transactionIds.length === 0) {
    return json({
      ok: true,
      links: {},
      orders: [],
      count: 0,
    });
  }

  const { data, error } =
    await supabaseAdmin
      .from("stock_orders")
      .select(
        `
          id,
          order_number,
          title,
          status,
          supplier_name,
          estimated_total,
          actual_total,
          expected_delivery_date,
          money_transaction_id
        `,
      )
      .in(
        "money_transaction_id",
        transactionIds,
      )
      .order("created_at", {
        ascending: false,
      });

  if (error) {
    return json(
      {
        ok: false,
        error:
          "Stock Order transaction links could not be loaded.",
        code:
          error.code ||
          "STOCK_ORDER_LINKS_LOAD_FAILED",
        details:
          error.details ||
          error.message ||
          null,
        hint:
          error.hint ||
          "Confirm public.stock_orders has money_transaction_id and created_at columns.",
        field:
          "money_transaction_id",
      },
      500,
    );
  }

  const orders = (data || []).map(
    (row) =>
      mapOrder(
        row as Record<string, unknown>,
      ),
  );

  const links: Record<
    string,
    typeof orders
  > = {};

  for (const order of orders) {
    if (!order.moneyTransactionId) {
      continue;
    }

    links[order.moneyTransactionId] = [
      ...(links[order.moneyTransactionId] || []),
      order,
    ];
  }

  return json({
    ok: true,
    links,
    orders,
    count: orders.length,
    linkedTransactionCount:
      Object.keys(links).length,
  });
}
