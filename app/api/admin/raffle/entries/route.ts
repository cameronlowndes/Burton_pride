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
  status: string | null;
  payment_status: string | null;
  amount_pence: number | null;
  currency: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  raffle_winner_position: number | null;
  raffle_won_at: string | null;
  raffle_draw_notes: string | null;
};

function ticketCount(value: string | null) {
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
  return `${position} Prize`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

export async function GET() {
  try {
    const { data: entries, error } = await supabaseAdmin
      .from("raffle_entries")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error,
        },
        { status: 500 }
      );
    }

    const safeEntries = (entries || []) as RaffleEntry[];

    const paidEntries = safeEntries.filter(
      (entry) => entry.payment_status === "paid"
    );

    const checkoutStartedEntries = safeEntries.filter(
      (entry) => entry.payment_status === "checkout_started"
    );

    const winners = safeEntries
      .filter((entry) => entry.raffle_winner_position)
      .sort(
        (a, b) =>
          Number(a.raffle_winner_position || 0) -
          Number(b.raffle_winner_position || 0)
      );

    const totalTickets = paidEntries
      .filter((entry) => !entry.raffle_winner_position)
      .reduce((total, entry) => total + ticketCount(entry.ticket_amount), 0);

    const totalRaisedPence = paidEntries.reduce(
      (total, entry) => total + Number(entry.amount_pence || 0),
      0
    );

    return NextResponse.json({
      ok: true,
      entries: safeEntries,
      stats: {
        totalEntries: safeEntries.length,
        paidEntries: paidEntries.length,
        checkoutStartedEntries: checkoutStartedEntries.length,
        totalTickets,
        totalRaisedPence,
        winners,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.action === "create_test_entries") {
      const now = new Date().toISOString();
      const batchId = Date.now();

      const testEntries = Array.from({ length: 10 }).map((_, index) => {
        const ticketAmount = String((index % 5) + 1);
        const amountPence = Number(ticketAmount) * 100;

        return {
          full_name: `Test Raffle Person ${index + 1}`,
          email: `test-raffle-${batchId}-${index + 1}@example.com`,
          phone: `01283 0000${String(index + 1).padStart(2, "0")}`,
          ticket_amount: ticketAmount,
          message:
            "TEST ENTRY ONLY - delete this before the real official raffle draw.",
          status: "active",
          payment_status: "paid",
          amount_pence: amountPence,
          currency: "gbp",
          stripe_checkout_session_id: `test_session_${batchId}_${index + 1}`,
          stripe_payment_intent_id: `test_payment_${batchId}_${index + 1}`,
          raffle_winner_position: null,
          raffle_won_at: null,
          raffle_draw_notes: null,
          created_at: now,
        };
      });

      const { data, error } = await supabaseAdmin
        .from("raffle_entries")
        .insert(testEntries)
        .select("*");

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: error.message,
            details: error,
          },
          { status: 500 }
        );
      }

      const totalTickets = testEntries.reduce(
        (total, entry) => total + Number(entry.ticket_amount || 1),
        0
      );

      return NextResponse.json({
        ok: true,
        entries: data || [],
        created: data?.length || 0,
        totalTickets,
      });
    }

    if (body.action === "delete_entry") {
      const entryId = String(body.entryId || "");

      if (!entryId) {
        return NextResponse.json(
          {
            ok: false,
            error: "Missing raffle entry ID.",
          },
          { status: 400 }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("raffle_entries")
        .delete()
        .eq("id", entryId)
        .select("*")
        .single();

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: error.message,
            details: error,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        deletedEntry: data,
      });
    }

    if (body.action === "delete_all_test_entries") {
      const { data, error } = await supabaseAdmin
        .from("raffle_entries")
        .delete()
        .or(
          "email.like.test-raffle-%,stripe_checkout_session_id.like.test_session_%,stripe_payment_intent_id.like.test_payment_%"
        )
        .select("*");

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: error.message,
            details: error,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        deleted: data?.length || 0,
        deletedEntries: data || [],
      });
    }

    if (body.action === "redo_draw") {
      const prizePosition = Number(body.prizePosition);

      if (![1, 2, 3].includes(prizePosition)) {
        return NextResponse.json(
          {
            ok: false,
            error: "Invalid prize position. Use 1, 2, or 3.",
          },
          { status: 400 }
        );
      }

      const { data: existingWinner, error: findError } = await supabaseAdmin
        .from("raffle_entries")
        .select("*")
        .eq("raffle_winner_position", prizePosition)
        .maybeSingle();

      if (findError) {
        return NextResponse.json(
          {
            ok: false,
            error: findError.message,
            details: findError,
          },
          { status: 500 }
        );
      }

      if (!existingWinner) {
        return NextResponse.json(
          {
            ok: false,
            error: `${prizeLabel(prizePosition)} does not have a winner to redo.`,
          },
          { status: 404 }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("raffle_entries")
        .update({
          raffle_winner_position: null,
          raffle_won_at: null,
          raffle_draw_notes: null,
        })
        .eq("id", existingWinner.id)
        .select("*")
        .single();

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: error.message,
            details: error,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        resetWinner: data,
        prizePosition,
        message: `${prizeLabel(prizePosition)} has been reset and can be drawn again.`,
      });
    }

    if (body.action !== "draw") {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid action",
        },
        { status: 400 }
      );
    }

    const prizePosition = Number(body.prizePosition);

    if (![1, 2, 3].includes(prizePosition)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid prize position. Use 1, 2, or 3.",
        },
        { status: 400 }
      );
    }

    const { data: existingPrizeWinner, error: existingPrizeError } =
      await supabaseAdmin
        .from("raffle_entries")
        .select("*")
        .eq("raffle_winner_position", prizePosition)
        .maybeSingle();

    if (existingPrizeError) {
      return NextResponse.json(
        {
          ok: false,
          error: existingPrizeError.message,
          details: existingPrizeError,
        },
        { status: 500 }
      );
    }

    if (existingPrizeWinner) {
      return NextResponse.json(
        {
          ok: false,
          error: `${prizeLabel(prizePosition)} has already been drawn. Use Redo ${prizeLabel(
            prizePosition
          )} first if you need to draw again.`,
          existingWinner: existingPrizeWinner,
        },
        { status: 409 }
      );
    }

    const { data: paidEntries, error: paidError } = await supabaseAdmin
      .from("raffle_entries")
      .select("*")
      .eq("payment_status", "paid")
      .is("raffle_winner_position", null)
      .order("created_at", { ascending: true });

    if (paidError) {
      return NextResponse.json(
        {
          ok: false,
          error: paidError.message,
          details: paidError,
        },
        { status: 500 }
      );
    }

    const entries = (paidEntries || []) as RaffleEntry[];

    if (entries.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No paid raffle entries are available to draw. Previous winners are excluded.",
        },
        { status: 400 }
      );
    }

    const ticketPool: RaffleEntry[] = [];

    for (const entry of entries) {
      const count = ticketCount(entry.ticket_amount);

      for (let i = 0; i < count; i++) {
        ticketPool.push(entry);
      }
    }

    if (ticketPool.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No tickets found in the paid draw pool.",
        },
        { status: 400 }
      );
    }

    const randomWinningTicketIndex = randomInt(0, ticketPool.length);
    const winner = ticketPool[randomWinningTicketIndex];

    const drawnAt = new Date().toISOString();

    const notes = `${prizeLabel(
      prizePosition
    )} drawn from ${entries.length} paid people and ${
      ticketPool.length
    } paid tickets. Winning ticket number was ${
      randomWinningTicketIndex + 1
    } of ${ticketPool.length}. Drawn using crypto.randomInt on the server.`;

    const { data: updatedWinner, error: updateError } = await supabaseAdmin
      .from("raffle_entries")
      .update({
        raffle_winner_position: prizePosition,
        raffle_won_at: drawnAt,
        raffle_draw_notes: notes,
      })
      .eq("id", winner.id)
      .is("raffle_winner_position", null)
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
        totalPaidPeople: entries.length,
        totalTicketsInDraw: ticketPool.length,
        randomWinningTicketNumber: randomWinningTicketIndex + 1,
        drawnAt,
        notes,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}