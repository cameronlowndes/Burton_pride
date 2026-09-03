import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  let adminResult = await supabaseAdmin
    .from("admin_users")
    .select("id,email,full_name,role,is_active")
    .eq("supabase_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!adminResult.data) {
    adminResult = await supabaseAdmin
      .from("admin_users")
      .select("id,email,full_name,role,is_active")
      .ilike("email", user.email)
      .eq("is_active", true)
      .maybeSingle();
  }

  return adminResult.data || null;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireActiveAdmin();

    if (!admin) {
      return json({ ok: false, error: "Unauthorized." }, 401);
    }

    const lotteryId = request.nextUrl.searchParams.get("lottery_id")?.trim();
    const limitValue = Number(request.nextUrl.searchParams.get("limit") || 1000);
    const limit = Number.isInteger(limitValue)
      ? Math.min(2000, Math.max(1, limitValue))
      : 1000;

    let acceptanceQuery = supabaseAdmin
      .from("lottery_acceptances")
      .select(
        "id,lottery_id,order_id,acceptance_type,version,accepted,accepted_at,ip_address,created_at",
      )
      .order("accepted_at", { ascending: false })
      .limit(limit);

    if (lotteryId) acceptanceQuery = acceptanceQuery.eq("lottery_id", lotteryId);

    const { data: acceptances, error: acceptanceError } = await acceptanceQuery;

    if (acceptanceError) {
      console.error("Lottery acceptances load failed:", acceptanceError);
      return json({ ok: false, error: "Unable to load declaration records." }, 500);
    }

    const orderIds = Array.from(
      new Set((acceptances || []).map((item) => item.order_id).filter(Boolean)),
    );
    const lotteryIds = Array.from(
      new Set((acceptances || []).map((item) => item.lottery_id).filter(Boolean)),
    );

    const [ordersResult, lotteriesResult] = await Promise.all([
      orderIds.length
        ? supabaseAdmin
            .from("lottery_orders")
            .select(
              "id,order_reference,purchaser_name,purchaser_email,payment_status,quantity,total_amount,currency,created_at",
            )
            .in("id", orderIds)
        : Promise.resolve({ data: [], error: null }),
      lotteryIds.length
        ? supabaseAdmin
            .from("lotteries")
            .select("id,title,slug")
            .in("id", lotteryIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (ordersResult.error || lotteriesResult.error) {
      console.error("Lottery acceptance relationship load failed:", {
        ordersError: ordersResult.error,
        lotteriesError: lotteriesResult.error,
      });
      return json({ ok: false, error: "Unable to load linked order details." }, 500);
    }

    const orders = new Map((ordersResult.data || []).map((row) => [row.id, row]));
    const lotteries = new Map(
      (lotteriesResult.data || []).map((row) => [row.id, row]),
    );

    const items = (acceptances || []).map((acceptance) => ({
      ...acceptance,
      order: orders.get(acceptance.order_id) || null,
      lottery: lotteries.get(acceptance.lottery_id) || null,
    }));

    return json({
      ok: true,
      items,
      count: items.length,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Lottery acceptances API error:", error);
    return json({ ok: false, error: "Unable to load declaration records." }, 500);
  }
}
