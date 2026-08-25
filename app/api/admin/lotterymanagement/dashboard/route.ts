// app/api/admin/lottery/dashboard/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const [
      lotteriesResult,
      ordersResult,
      entriesResult,
      winnersResult,
    ] = await Promise.all([
      supabase
        .from("lotteries")
        .select("id, status, created_at"),

      supabase
        .from("lottery_orders")
        .select("id, total_amount, payment_status, created_at"),

      supabase
        .from("lottery_entries")
        .select("id, lottery_id, created_at"),

      supabase
        .from("lottery_winners")
        .select("id, lottery_id, created_at"),
    ]);

    if (lotteriesResult.error) {
      console.error(
        "Lottery dashboard lotteries error:",
        lotteriesResult.error
      );

      return NextResponse.json(
        { error: "Unable to load lottery dashboard" },
        { status: 500 }
      );
    }

    if (ordersResult.error) {
      console.error(
        "Lottery dashboard orders error:",
        ordersResult.error
      );

      return NextResponse.json(
        { error: "Unable to load lottery dashboard" },
        { status: 500 }
      );
    }

    if (entriesResult.error) {
      console.error(
        "Lottery dashboard entries error:",
        entriesResult.error
      );

      return NextResponse.json(
        { error: "Unable to load lottery dashboard" },
        { status: 500 }
      );
    }

    if (winnersResult.error) {
      console.error(
        "Lottery dashboard winners error:",
        winnersResult.error
      );

      return NextResponse.json(
        { error: "Unable to load lottery dashboard" },
        { status: 500 }
      );
    }

    const lotteries = lotteriesResult.data ?? [];
    const orders = ordersResult.data ?? [];
    const entries = entriesResult.data ?? [];
    const winners = winnersResult.data ?? [];

    const paidOrders = orders.filter(
      (order) => order.payment_status === "paid"
    );

    const totalRevenue = paidOrders.reduce(
      (total, order) => total + Number(order.total_amount ?? 0),
      0
    );

    const dashboard = {
      totalLotteries: lotteries.length,

      liveLotteries: lotteries.filter(
        (lottery) => lottery.status === "live"
      ).length,

      draftLotteries: lotteries.filter(
        (lottery) => lottery.status === "draft"
      ).length,

      scheduledLotteries: lotteries.filter(
        (lottery) => lottery.status === "scheduled"
      ).length,

      completedLotteries: lotteries.filter(
        (lottery) => lottery.status === "completed"
      ).length,

      totalOrders: orders.length,

      paidOrders: paidOrders.length,

      totalEntries: entries.length,

      totalWinners: winners.length,

      totalRevenue,

      recentLotteries: [...lotteries]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        )
        .slice(0, 5),
    };

    return NextResponse.json({
      success: true,
      dashboard,
    });
  } catch (error) {
    console.error("Lottery dashboard API error:", error);

    return NextResponse.json(
      { error: "Unable to load lottery dashboard" },
      { status: 500 }
    );
  }
}