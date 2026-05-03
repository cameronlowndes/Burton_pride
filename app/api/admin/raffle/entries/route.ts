import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type RaffleEntry = {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  ticket_amount: string | null;
  message: string | null;
  payment_status: string | null;
  amount_pence: number | null;
  raffle_winner_position: number | null;
  raffle_won_at: string | null;
  raffle_draw_notes: string | null;
};

function getTicketCount(value: string | null) {
  const n = Number(value || 1);

  if (!Number.isFinite(n) || n < 1) {
    return 1;
  }

  return Math.floor(n);
}

function prizeLabel(position: number) {
  if (position === 1) return "1st Prize";
  if (position === 2) return "2nd Prize";
  if (position === 3) return "3rd Prize";
  return `Prize ${position}`;
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("raffle_entries")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, details: error },
        { status: 500 }
      );
    }

    const entries = data || [];

    const paidEntries = entries.filter(
      (entry) => entry.payment_status === "paid"
    );

    const checkoutStartedEntries = entries.filter(
      (entry) => entry.payment_status === "checkout_started"
    );

    const totalTickets = paidEntries.reduce(
      (sum, entry) => sum + getTicketCount(entry.ticket_amount),
      0
    );

    const totalRaisedPence = paidEntries.reduce(
      (sum, entry) => sum + (entry.amount_pence || 0),
      0
    );

    const winners = entries
      .filter((entry) => entry.raffle_winner_position)
      .sort(
        (a, b) =>
          Number(a.raffle_winner_position || 999) -
          Number(b.raffle_winner_position || 999)
      );

    return NextResponse.json(
      {
        ok: true,
        entries,
        stats: {
          totalEntries: entries.length,
          paidEntries: paidEntries.length,
          checkoutStartedEntries: checkoutStartedEntries.length,
          totalTickets,
          totalRaisedPence,
          winners,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const action = String(body.action || "");
    const prizePosition = Number(body.prizePosition || 1);

    if (action !== "draw") {
      return NextResponse.json(
        { ok: false, error: "Invalid action" },
        { status: 400 }
      );
    }

    if (![1, 2, 3].includes(prizePosition)) {
      return NextResponse.json(
        { ok: false, error: "Prize position must be 1, 2 or 3" },
        { status: 400 }
      );
    }

    const { data: existingWinner, error: existingWinnerError } =
      await supabaseAdmin
        .from("raffle_entries")
        .select("*")
        .eq("raffle_winner_position", prizePosition)
        .maybeSingle();

    if (existingWinnerError) {
      return NextResponse.json(
        {
          ok: false,
          error: existingWinnerError.message,
          details: existingWinnerError,
        },
        { status: 500 }
      );
    }

    if (existingWinner) {
      return NextResponse.json(
        {
          ok: false,
          error: `${prizeLabel(prizePosition)} has already been drawn.`,
          winner: existingWinner,
        },
        { status: 400 }
      );
    }

    const { data: entries, error } = await supabaseAdmin
      .from("raffle_entries")
      .select("*")
      .eq("payment_status", "paid")
      .is("raffle_winner_position", null);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, details: error },
        { status: 500 }
      );
    }

    const paidEntries = (entries || []) as RaffleEntry[];

    if (paidEntries.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No paid raffle entries available to draw.",
        },
        { status: 400 }
      );
    }

    const ticketPool: RaffleEntry[] = [];

    for (const entry of paidEntries) {
      const count = getTicketCount(entry.ticket_amount);

      for (let i = 0; i < count; i++) {
        ticketPool.push(entry);
      }
    }

    if (ticketPool.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No tickets available in the draw pool.",
        },
        { status: 400 }
      );
    }

    const winningIndex = randomInt(0, ticketPool.length);
    const winner = ticketPool[winningIndex];

    const drawTime = new Date().toISOString();

    const drawNotes = `${prizeLabel(
      prizePosition
    )} drawn randomly from ${ticketPool.length} paid ticket(s). Winning ticket number: ${
      winningIndex + 1
    } of ${ticketPool.length}.`;

    const { data: updatedWinner, error: updateError } = await supabaseAdmin
      .from("raffle_entries")
      .update({
        raffle_winner_position: prizePosition,
        raffle_won_at: drawTime,
        raffle_draw_notes: drawNotes,
      })
      .eq("id", winner.id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          ok: false,
          error: updateError.message,
          details: updateError,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      winner: updatedWinner,
      draw: {
        prizePosition,
        prize: prizeLabel(prizePosition),
        totalPaidPeople: paidEntries.length,
        totalTicketsInDraw: ticketPool.length,
        randomWinningTicketNumber: winningIndex + 1,
        drawnAt: drawTime,
        notes: drawNotes,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}