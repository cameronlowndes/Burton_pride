import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function requireActiveAdmin() {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user?.email) return null;

  let result = await supabaseAdmin
    .from("admin_users")
    .select("id")
    .eq("supabase_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!result.data) {
    result = await supabaseAdmin
      .from("admin_users")
      .select("id")
      .ilike("email", user.email)
      .eq("is_active", true)
      .maybeSingle();
  }

  return result.data;
}

async function loadPaidOrders(lotteryId: string) {
  const rows: Array<{ id: string; order_reference: string }> = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await supabaseAdmin
      .from("lottery_orders")
      .select("id,order_reference")
      .eq("lottery_id", lotteryId)
      .eq("payment_status", "paid")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (result.error) throw result.error;
    rows.push(...(result.data || []));
    if ((result.data || []).length < PAGE_SIZE) break;
  }

  return rows;
}

async function loadIssuedTickets(lotteryId: string) {
  const rows: Array<{
    id: string;
    order_id: string;
    ticket_number: string;
    issued_at: string | null;
  }> = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await supabaseAdmin
      .from("lottery_tickets")
      .select("id,order_id,ticket_number,issued_at")
      .eq("lottery_id", lotteryId)
      .eq("status", "issued")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (result.error) throw result.error;
    rows.push(...(result.data || []));
    if ((result.data || []).length < PAGE_SIZE) break;
  }

  return rows;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireActiveAdmin();
    if (!admin) return json({ ok: false, error: "Unauthorized." }, 401);

    const lotteryId = request.nextUrl.searchParams.get("lottery_id")?.trim() || "";
    const lotteriesResult = await supabaseAdmin
      .from("lotteries")
      .select("id,title,slug,status,draw_at,sales_close_at")
      .order("title", { ascending: true });

    if (lotteriesResult.error) throw lotteriesResult.error;

    const lotteries = lotteriesResult.data || [];
    if (!lotteryId) {
      return json({ ok: true, lotteries, lottery: null, tickets: [] });
    }

    const lottery = lotteries.find((item) => item.id === lotteryId);
    if (!lottery) {
      return json({ ok: false, error: "The selected lottery was not found." }, 404);
    }

    const [paidOrders, issuedTickets] = await Promise.all([
      loadPaidOrders(lotteryId),
      loadIssuedTickets(lotteryId),
    ]);

    const orderReferences = new Map(
      paidOrders.map((order) => [order.id, order.order_reference]),
    );
    const collator = new Intl.Collator("en-GB", {
      numeric: true,
      sensitivity: "base",
    });

    const tickets = issuedTickets
      .filter((ticket) => orderReferences.has(ticket.order_id))
      .map((ticket) => ({
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        order_reference: orderReferences.get(ticket.order_id) || "",
        issued_at: ticket.issued_at,
      }))
      .sort((a, b) => collator.compare(a.ticket_number, b.ticket_number));

    return json({
      ok: true,
      lotteries,
      lottery,
      tickets,
      count: tickets.length,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[paper-draw][GET]", error);
    return json({ ok: false, error: "Unable to prepare paper draw tickets." }, 500);
  }
}
