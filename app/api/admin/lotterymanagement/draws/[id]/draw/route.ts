import { NextResponse } from "next/server";
import { lotteryAdminDb, requireLotteryPermission } from "@/lib/lottery/adminAuth";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number((error as any).status) : 500;
  const message =
    status >= 500
      ? "The lottery draw list could not be loaded."
      : error instanceof Error
        ? error.message
        : "The request could not be completed.";
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    await requireLotteryPermission("lottery:view");
    const db = lotteryAdminDb();

    const { data: lotteries, error } = await db
      .from("lotteries")
      .select("id,title,slug,internal_reference,status,sales_close_at,draw_at")
      .in("status", ["scheduled", "live", "sales_closed", "draw_ready", "completed", "under_review"])
      .order("draw_at", { ascending: true, nullsFirst: false });

    if (error) throw error;

    const items = await Promise.all(
      (lotteries ?? []).map(async (lottery) => {
        const [
          paidOrders,
          eligibleTickets,
          excludedTickets,
          prizes,
          warnings,
          latestDraw,
        ] = await Promise.all([
          db.from("lottery_orders").select("id", { count: "exact", head: true })
            .eq("lottery_id", lottery.id).eq("payment_status", "paid"),
          db.from("lottery_tickets").select("id", { count: "exact", head: true })
            .eq("lottery_id", lottery.id).eq("status", "issued"),
          db.from("lottery_tickets").select("id", { count: "exact", head: true })
            .eq("lottery_id", lottery.id).in("status", ["void", "refunded", "test"]),
          db.from("lottery_prizes").select("id", { count: "exact", head: true })
            .eq("lottery_id", lottery.id).eq("status", "available_for_draw"),
          db.from("lottery_integrity_warnings").select("id", { count: "exact", head: true })
            .eq("lottery_id", lottery.id).eq("resolved", false),
          db.from("lottery_draws").select("id,status,completed_at")
            .eq("lottery_id", lottery.id).order("created_at", { ascending: false }).limit(1),
        ]);

        const latest = latestDraw.data?.[0] ?? null;
        let drawStatus: string = "upcoming";

        if (latest?.status === "completed") drawStatus = "completed";
        else if (latest?.status === "running") drawStatus = "running";
        else if ((warnings.count ?? 0) > 0 || lottery.status === "under_review") drawStatus = "under_review";
        else if (lottery.status === "draw_ready" || lottery.status === "sales_closed") drawStatus = "ready";
        else if (lottery.sales_close_at && new Date(lottery.sales_close_at).getTime() <= Date.now()) drawStatus = "ready";
        else drawStatus = "upcoming";

        return {
          id: lottery.id,
          title: lottery.title,
          slug: lottery.slug,
          internal_reference: lottery.internal_reference,
          lottery_status: lottery.status,
          draw_at: lottery.draw_at,
          sales_close_at: lottery.sales_close_at,
          paid_orders: paidOrders.count ?? 0,
          eligible_tickets: eligibleTickets.count ?? 0,
          excluded_tickets: excludedTickets.count ?? 0,
          prizes_available: prizes.count ?? 0,
          draw_status: drawStatus,
          latest_draw_id: latest?.id ?? null,
        };
      }),
    );

    return NextResponse.json({
      items,
      summary: {
        ready: items.filter((x) => x.draw_status === "ready").length,
        upcoming: items.filter((x) => ["upcoming", "not_ready"].includes(x.draw_status)).length,
        completed: items.filter((x) => x.draw_status === "completed").length,
        blocked: items.filter((x) => ["blocked", "under_review", "redraw_requested"].includes(x.draw_status)).length,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}