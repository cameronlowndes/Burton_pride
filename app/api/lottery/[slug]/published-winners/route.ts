import { NextRequest, NextResponse } from "next/server";
import { lotteryAdminDb } from "@/lib/lottery/adminAuth";

export const dynamic = "force-dynamic";

type PublicDisplayMode = "full_name" | "first_name" | "ticket_number" | "none";

function publicLabel({
  mode,
  purchaserName,
  ticketNumber,
}: {
  mode: PublicDisplayMode;
  purchaserName: string | null;
  ticketNumber: string | null;
}) {
  if (mode === "ticket_number") {
    return ticketNumber ? `Ticket ${ticketNumber}` : "Winning ticket";
  }

  const name = purchaserName?.trim() || "Winner";
  if (mode === "first_name") return name.split(/\s+/)[0] || "Winner";
  if (mode === "full_name") return name;
  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = lotteryAdminDb();

  const { data: lottery, error: lotteryError } = await supabase
    .from("lotteries")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (lotteryError) {
    console.error("Public published winners lottery lookup failed:", lotteryError);
    return NextResponse.json(
      { ok: false, error: "The published results are unavailable." },
      { status: 500 },
    );
  }

  if (!lottery) {
    return NextResponse.json(
      { ok: false, error: "Lottery not found." },
      { status: 404 },
    );
  }

  // This explicit publication timestamp is the safety gate. A winner is not
  // public merely because they have been selected or contacted.
  const { data: winners, error: winnersError } = await supabase
    .from("lottery_winners")
    .select("id,prize_id,ticket_id,order_id,public_display_mode,public_display_consent,public_results_published_at")
    .eq("lottery_id", lottery.id)
    .eq("public_display_consent", true)
    .not("public_results_published_at", "is", null)
    .neq("public_display_mode", "none")
    .order("public_results_published_at", { ascending: true });

  if (winnersError) {
    console.error("Public published winners lookup failed:", winnersError);
    return NextResponse.json(
      { ok: false, error: "The published results are unavailable." },
      { status: 500 },
    );
  }

  const rows = winners ?? [];
  const prizeIds = [...new Set(rows.map((winner: any) => winner.prize_id))];
  const ticketIds = [...new Set(rows.map((winner: any) => winner.ticket_id))];
  const orderIds = [
    ...new Set(
      rows
        .map((winner: any) => winner.order_id)
        .filter((orderId: string | null): orderId is string => Boolean(orderId)),
    ),
  ];

  const [prizesResult, ticketsResult, ordersResult] = await Promise.all([
    prizeIds.length
      ? supabase.from("lottery_prizes").select("id,name").in("id", prizeIds)
      : Promise.resolve({ data: [], error: null }),
    ticketIds.length
      ? supabase
          .from("lottery_tickets")
          .select("id,ticket_number")
          .in("id", ticketIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? supabase
          .from("lottery_orders")
          .select("id,purchaser_name")
          .in("id", orderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const relationError = prizesResult.error || ticketsResult.error || ordersResult.error;
  if (relationError) {
    console.error("Public published winners relation lookup failed:", relationError);
    return NextResponse.json(
      { ok: false, error: "The published results are unavailable." },
      { status: 500 },
    );
  }

  const prizes = new Map((prizesResult.data ?? []).map((prize: any) => [prize.id, prize]));
  const tickets = new Map((ticketsResult.data ?? []).map((ticket: any) => [ticket.id, ticket]));
  const orders = new Map((ordersResult.data ?? []).map((order: any) => [order.id, order]));

  const results = rows.flatMap((winner: any, index: number) => {
    const label = publicLabel({
      mode: winner.public_display_mode as PublicDisplayMode,
      purchaserName: winner.order_id
        ? orders.get(winner.order_id)?.purchaser_name ?? null
        : null,
      ticketNumber: tickets.get(winner.ticket_id)?.ticket_number ?? null,
    });

    if (!label) return [];

    return [
      {
        id: winner.id,
        display_order: index + 1,
        prize_label: prizes.get(winner.prize_id)?.name ?? "Prize winner",
        winner_display_label: label,
        published_at: winner.public_results_published_at,
      },
    ];
  });

  return NextResponse.json(
    { ok: true, results },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
