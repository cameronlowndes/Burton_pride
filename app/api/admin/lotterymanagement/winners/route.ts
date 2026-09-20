import { NextResponse } from "next/server";
import {
  lotteryAdminDb,
  requireLotteryPermission,
} from "@/lib/lottery/adminAuth";

export const dynamic = "force-dynamic";

type WinnerRow = {
  id: string;
  lottery_id: string;
  draw_id: string;
  prize_id: string;
  ticket_id: string;
  order_id: string | null;
  status: string;
  selected_at: string;
  contacted_at: string | null;
  eligibility_confirmed_at: string | null;
  claimed_at: string | null;
  fulfilled_at: string | null;
  unclaimed_at: string | null;
  disqualified_at: string | null;
  replaced_at: string | null;
  collection_delivery_date: string | null;
  fulfilment_method: string | null;
  fulfilment_notes: string | null;
  internal_notes: string | null;
  public_display_mode: string | null;
  public_display_consent: boolean;
  public_results_published_at: string | null;
  replacement_winner_id: string | null;
  original_winner_id: string | null;
  created_at: string;
  updated_at: string;
};

type DatabaseError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

function databaseErrorResponse(
  error: DatabaseError,
  userMessage: string,
  context: string,
) {
  console.error(context, error);

  return NextResponse.json(
    {
      ok: false,
      error: userMessage,
      code: error.code || "DATABASE_ERROR",
      // These fields are for the authenticated Lottery Management admin page.
      // They allow the TSX error panel to show the exact Supabase failure.
      details: error.message || error.details || "No database detail was returned.",
      hint: error.hint || error.details || null,
    },
    { status: 500 },
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET() {
  try {
    await requireLotteryPermission("lottery:winners:manage");
    const supabase = lotteryAdminDb();

    const { data: winners, error: winnersError } = await supabase
      .from("lottery_winners")
      .select(`
        id, lottery_id, draw_id, prize_id, ticket_id, order_id, status,
        selected_at, contacted_at, eligibility_confirmed_at, claimed_at,
        fulfilled_at, unclaimed_at, disqualified_at, replaced_at,
        collection_delivery_date, fulfilment_method, fulfilment_notes,
        internal_notes, public_display_mode, public_display_consent,
        public_results_published_at, replacement_winner_id,
        original_winner_id, created_at, updated_at
      `)
      .order("selected_at", { ascending: false });

    if (winnersError) {
      return databaseErrorResponse(
        winnersError,
        "Could not load winners.",
        "Lottery winners GET error:",
      );
    }

    const rows = (winners ?? []) as WinnerRow[];

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: true, items: [] },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const lotteryIds = [...new Set(rows.map((x) => x.lottery_id).filter(Boolean))];
    const prizeIds = [...new Set(rows.map((x) => x.prize_id).filter(Boolean))];
    const ticketIds = [...new Set(rows.map((x) => x.ticket_id).filter(Boolean))];
    const orderIds = [
      ...new Set(rows.map((x) => x.order_id).filter((x): x is string => Boolean(x))),
    ];
    const winnerIds = rows.map((x) => x.id);

    const [
      lotteriesResult,
      prizesResult,
      ticketsResult,
      ordersResult,
      contactAttemptsResult,
    ] = await Promise.all([
      lotteryIds.length
        ? supabase.from("lotteries").select("id,title,slug").in("id", lotteryIds)
        : Promise.resolve({ data: [], error: null }),

      prizeIds.length
        ? supabase
            .from("lottery_prizes")
            .select("id,name,declared_value")
            .in("id", prizeIds)
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
            .select("id,order_reference,purchaser_name,purchaser_email,purchaser_phone")
            .in("id", orderIds)
        : Promise.resolve({ data: [], error: null }),

      winnerIds.length
        ? supabase
            .from("lottery_winner_contact_attempts")
            .select("id,winner_id,method,outcome,notes,attempted_at,admin_name")
            .in("winner_id", winnerIds)
            .order("attempted_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    const relationError =
      lotteriesResult.error ||
      prizesResult.error ||
      ticketsResult.error ||
      ordersResult.error;

    if (relationError) {
      return databaseErrorResponse(
        relationError,
        "Could not load complete winner records.",
        "Lottery winners relation load error:",
      );
    }

    // This table may not exist in an older database. Keep the register usable.
    if (contactAttemptsResult.error) {
      console.warn(
        "Lottery winner contact attempts unavailable:",
        contactAttemptsResult.error,
      );
    }

    const lotteries = new Map((lotteriesResult.data ?? []).map((x: any) => [x.id, x]));
    const prizes = new Map((prizesResult.data ?? []).map((x: any) => [x.id, x]));
    const tickets = new Map((ticketsResult.data ?? []).map((x: any) => [x.id, x]));
    const orders = new Map((ordersResult.data ?? []).map((x: any) => [x.id, x]));
    const attemptsByWinner = new Map<string, any[]>();

    for (const attempt of contactAttemptsResult.data ?? []) {
      const winnerId = (attempt as any).winner_id as string;
      const attempts = attemptsByWinner.get(winnerId) ?? [];
      attempts.push(attempt);
      attemptsByWinner.set(winnerId, attempts);
    }

    const items = rows.map((winner) => {
      const lottery = lotteries.get(winner.lottery_id);
      const prize = prizes.get(winner.prize_id);
      const ticket = tickets.get(winner.ticket_id);
      const order = winner.order_id ? orders.get(winner.order_id) : null;

      return {
        id: winner.id,
        lottery_id: winner.lottery_id,
        lottery_title: lottery?.title ?? "Unknown lottery",
        lottery_slug: lottery?.slug ?? "",
        draw_id: winner.draw_id,
        // The schema has no draw_reference column; the TSX falls back to draw_id.
        draw_reference: null,
        prize_id: winner.prize_id,
        prize_name: prize?.name ?? "Unknown prize",
        prize_value:
          prize?.declared_value === null || prize?.declared_value === undefined
            ? null
            : Number(prize.declared_value),
        ticket_id: winner.ticket_id,
        ticket_number: ticket?.ticket_number ?? "Unknown ticket",
        order_id: winner.order_id,
        order_reference: order?.order_reference ?? null,
        entrant_name: order?.purchaser_name ?? null,
        entrant_email: order?.purchaser_email ?? null,
        entrant_phone: order?.purchaser_phone ?? null,
        status: winner.status,
        selected_at: winner.selected_at,
        contacted_at: winner.contacted_at,
        eligibility_confirmed_at: winner.eligibility_confirmed_at,
        claimed_at: winner.claimed_at,
        fulfilled_at: winner.fulfilled_at,
        unclaimed_at: winner.unclaimed_at,
        disqualified_at: winner.disqualified_at,
        replaced_at: winner.replaced_at,
        collection_delivery_date: winner.collection_delivery_date,
        fulfilment_method: winner.fulfilment_method,
        fulfilment_notes: winner.fulfilment_notes,
        internal_notes: winner.internal_notes,
        public_display_mode: winner.public_display_mode ?? "first_name",
        public_display_consent: winner.public_display_consent ?? false,
        public_results_published_at: winner.public_results_published_at ?? null,
        replacement_winner_id: winner.replacement_winner_id,
        original_winner_id: winner.original_winner_id,
        contact_attempts: attemptsByWinner.get(winner.id) ?? [],
        created_at: winner.created_at,
        updated_at: winner.updated_at,
      };
    });

    return NextResponse.json(
      { ok: true, items },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    const message = errorMessage(error);
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("unauthor") || lowerMessage.includes("permission")) {
      return NextResponse.json(
        {
          ok: false,
          error: "You do not have permission to view winner records.",
          code: "LOTTERY_PERMISSION_DENIED",
          details: message,
          hint: "Sign in again and confirm the account has lottery:winners:manage.",
        },
        { status: 403 },
      );
    }

    console.error("Lottery winners GET unexpected error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not load winners.",
        code: "UNEXPECTED_WINNERS_GET_ERROR",
        details: message,
        hint: "Check the Next.js server logs for the full stack trace.",
      },
      { status: 500 },
    );
  }
}
