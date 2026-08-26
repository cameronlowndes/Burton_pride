import { NextResponse } from "next/server";
import {
  lotteryAdminDb,
  requireLotteryPermission,
} from "@/lib/lottery/adminAuth";

export const dynamic = "force-dynamic";

function numberValue(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  try {
    await requireLotteryPermission("lottery:finance:view");
    const supabase = lotteryAdminDb();

    const { data: lotteries, error: lotteriesError } = await supabase
      .from("lotteries")
      .select(`
        id,
        title,
        name,
        slug,
        status,
        lottery_type,
        created_at,
        sales_open_at,
        starts_at,
        sales_close_at,
        ends_at,
        draw_at
      `)
      .order("created_at", { ascending: false });

    if (lotteriesError) {
      console.error("Lottery reports lotteries error:", lotteriesError);

      return NextResponse.json(
        {
          ok: false,
          error: "Could not load lottery report data.",
        },
        { status: 500 },
      );
    }

    const lotteryIds = (lotteries ?? []).map((item: any) => item.id);

    if (!lotteryIds.length) {
      return NextResponse.json(
        {
          ok: true,
          items: [],
        },
        {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const [
      ordersResult,
      ticketsResult,
      refundsResult,
      prizesResult,
      winnersResult,
      warningsResult,
    ] = await Promise.all([
      supabase
        .from("lottery_orders")
        .select("id,lottery_id,total_amount,payment_status")
        .in("lottery_id", lotteryIds),

      supabase
        .from("lottery_tickets")
        .select("id,lottery_id,status")
        .in("lottery_id", lotteryIds),

      supabase
        .from("lottery_refunds")
        .select("id,lottery_id,amount,status")
        .in("lottery_id", lotteryIds),

      supabase
        .from("lottery_prizes")
        .select(
          "id,lottery_id,declared_value,quantity,is_donated,status",
        )
        .in("lottery_id", lotteryIds),

      supabase
        .from("lottery_winners")
        .select("id,lottery_id,status")
        .in("lottery_id", lotteryIds),

      supabase
        .from("lottery_integrity_warnings")
        .select("id,lottery_id,severity,resolved")
        .in("lottery_id", lotteryIds),
    ]);

    const relationError =
      ordersResult.error ||
      ticketsResult.error ||
      refundsResult.error ||
      prizesResult.error ||
      winnersResult.error ||
      warningsResult.error;

    if (relationError) {
      console.error("Lottery reports relation error:", relationError);

      return NextResponse.json(
        {
          ok: false,
          error: "Could not load complete lottery report data.",
        },
        { status: 500 },
      );
    }

    const orders = ordersResult.data ?? [];
    const tickets = ticketsResult.data ?? [];
    const refunds = refundsResult.data ?? [];
    const prizes = prizesResult.data ?? [];
    const winners = winnersResult.data ?? [];
    const warnings = warningsResult.data ?? [];

    const items = (lotteries ?? []).map((lottery: any) => {
      const lotteryOrders = orders.filter(
        (item: any) => item.lottery_id === lottery.id,
      );

      const paidOrders = lotteryOrders.filter(
        (item: any) => item.payment_status === "paid",
      );

      const grossProceeds = paidOrders.reduce(
        (sum: number, item: any) => sum + numberValue(item.total_amount),
        0,
      );

      const failedPayments = lotteryOrders.filter(
        (item: any) => item.payment_status === "failed",
      ).length;

      const disputedPayments = lotteryOrders.filter(
        (item: any) => item.payment_status === "disputed",
      ).length;

      const lotteryTickets = tickets.filter(
        (item: any) => item.lottery_id === lottery.id,
      );

      const ticketsSold = lotteryTickets.filter((item: any) =>
        ["issued", "winner"].includes(item.status),
      ).length;

      const lotteryRefunds = refunds.filter(
        (item: any) => item.lottery_id === lottery.id,
      );

      const refundTotal = lotteryRefunds
        .filter((item: any) =>
          ["completed", "succeeded", "paid", "refunded"].includes(
            String(item.status || "").toLowerCase(),
          ),
        )
        .reduce(
          (sum: number, item: any) => sum + numberValue(item.amount),
          0,
        );

      const lotteryPrizes = prizes.filter(
        (item: any) => item.lottery_id === lottery.id,
      );

      // Only purchased prizes count as an organisation prize cost here.
      // Donated prizes retain their declared value but do not reduce funds.
      const prizeCosts = lotteryPrizes
        .filter((item: any) => !item.is_donated)
        .reduce(
          (sum: number, item: any) =>
            sum +
            numberValue(item.declared_value) *
              Math.max(1, numberValue(item.quantity)),
          0,
        );

      const lotteryWinners = winners.filter(
        (item: any) => item.lottery_id === lottery.id,
      );

      const winnerCount = lotteryWinners.length;

      const unclaimedPrizes = lotteryWinners.filter(
        (item: any) => item.status === "unclaimed",
      ).length;

      const complianceWarnings = warnings.filter(
        (item: any) =>
          item.lottery_id === lottery.id && item.resolved !== true,
      ).length;

      // There is currently no payment-fee column/table in the live schema.
      // Return zero rather than estimating provider fees.
      const paymentFees = 0;

      const netFunds = grossProceeds - refundTotal - paymentFees;
      const goodCauseAmount = Math.max(0, netFunds - prizeCosts);

      return {
        lottery_id: lottery.id,
        lottery_title: lottery.title || lottery.name || "Untitled lottery",
        lottery_slug: lottery.slug || "",
        lottery_status: lottery.status || "unknown",
        lottery_type: lottery.lottery_type || "unknown",
        created_at: lottery.created_at,
        sales_open_at: lottery.sales_open_at || lottery.starts_at || null,
        sales_close_at: lottery.sales_close_at || lottery.ends_at || null,
        draw_at: lottery.draw_at || null,

        gross_proceeds: grossProceeds,
        paid_orders: paidOrders.length,
        tickets_sold: ticketsSold,
        average_order_value:
          paidOrders.length > 0 ? grossProceeds / paidOrders.length : 0,
        refunds: refundTotal,
        payment_fees: paymentFees,
        net_funds: netFunds,
        prize_costs: prizeCosts,
        good_cause_amount: goodCauseAmount,

        winners: winnerCount,
        unclaimed_prizes: unclaimedPrizes,
        failed_payments: failedPayments,
        disputed_payments: disputedPayments,
        compliance_warnings: complianceWarnings,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        items,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: any) {
    const message =
      typeof error?.message === "string" ? error.message : "";

    if (
      message.toLowerCase().includes("unauthor") ||
      message.toLowerCase().includes("permission")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "You do not have permission to view lottery reports.",
        },
        { status: 403 },
      );
    }

    console.error("Lottery reports GET unexpected error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not load lottery reports.",
      },
      { status: 500 },
    );
  }
}
