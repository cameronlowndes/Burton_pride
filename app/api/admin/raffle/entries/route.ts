import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

const FIRST_TICKET_NUMBER = 1001;
const LAST_TICKET_NUMBER = 9999;

type RaffleTicket = {
  id: string;
  raffle_entry_id: string;
  ticket_number: number;
  created_at?: string;
};

type RaffleEntry = {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  ticket_amount: string | null;
  message: string | null;
  status: string | null;
  payment_status: string | null;
  amount_pence: number | null;
  currency: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;

  consent_given: boolean | null;
  age_confirmed: boolean | null;
  terms_accepted: boolean | null;
  eligibility_confirmed: boolean | null;

  raffle_winner_position: number | null;
  raffle_won_at: string | null;
  raffle_draw_notes: string | null;

  raffle_tickets?: RaffleTicket[];
};

type TicketPoolItem = {
  entry: RaffleEntry;
  ticketNumber: number;
  raffleTicketId: string;
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

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as any).message === "string"
  ) {
    return (error as any).message;
  }

  return "Something went wrong";
}

function getEntryTicketNumbers(entry: RaffleEntry) {
  return (entry.raffle_tickets || [])
    .map((ticket) => Number(ticket.ticket_number))
    .filter((number) => Number.isFinite(number))
    .sort((a, b) => a - b);
}

function formatEntryTicketNumbers(entry: RaffleEntry) {
  const numbers = getEntryTicketNumbers(entry);

  if (numbers.length === 0) {
    return "No ticket numbers found";
  }

  return numbers.map((number) => `#${number}`).join(", ");
}

function buildStats(safeEntries: RaffleEntry[]) {
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
    .reduce((total, entry) => {
      const realTicketCount = getEntryTicketNumbers(entry).length;
      return total + (realTicketCount || ticketCount(entry.ticket_amount));
    }, 0);

  const totalRaisedPence = paidEntries.reduce(
    (total, entry) => total + Number(entry.amount_pence || 0),
    0
  );

  return {
    totalEntries: safeEntries.length,
    paidEntries: paidEntries.length,
    checkoutStartedEntries: checkoutStartedEntries.length,
    totalTickets,
    totalRaisedPence,
    winners,
  };
}

async function getNextRaffleTicketNumbers(quantity: number) {
  const { data: usedTickets, error } = await supabaseAdmin
    .from("raffle_tickets")
    .select("ticket_number")
    .gte("ticket_number", FIRST_TICKET_NUMBER)
    .lte("ticket_number", LAST_TICKET_NUMBER)
    .order("ticket_number", { ascending: true });

  if (error) {
    throw new Error(error.message || "Could not check raffle ticket numbers.");
  }

  const used = new Set<number>(
    (usedTickets || [])
      .map((ticket) => Number(ticket.ticket_number))
      .filter((number) => Number.isInteger(number))
  );

  const numbers: number[] = [];

  for (
    let number = FIRST_TICKET_NUMBER;
    number <= LAST_TICKET_NUMBER;
    number += 1
  ) {
    if (!used.has(number)) {
      numbers.push(number);
    }

    if (numbers.length === quantity) {
      break;
    }
  }

  if (numbers.length < quantity) {
    throw new Error("There are not enough raffle ticket numbers left.");
  }

  return numbers;
}

async function createTicketNumbersForEntry(
  raffleEntryId: string,
  quantity: number
) {
  let attempt = 0;

  while (attempt < 5) {
    attempt += 1;

    const ticketNumbers = await getNextRaffleTicketNumbers(quantity);

    const { data, error } = await supabaseAdmin
      .from("raffle_tickets")
      .insert(
        ticketNumbers.map((ticketNumber) => ({
          raffle_entry_id: raffleEntryId,
          ticket_number: ticketNumber,
        }))
      )
      .select("*");

    if (!error) {
      return {
        ticketNumbers,
        tickets: data || [],
      };
    }

    /**
     * 23505 = duplicate key.
     * If two actions happen at the same time and hit the same next number,
     * try again and fetch the next available numbers.
     */
    if (error.code !== "23505") {
      throw new Error(error.message);
    }
  }

  throw new Error(
    "Could not safely create raffle ticket numbers. Please try again."
  );
}

async function loadEntries() {
  const { data: entries, error } = await supabaseAdmin
    .from("raffle_entries")
    .select(
      `
      *,
      raffle_tickets (
        id,
        raffle_entry_id,
        ticket_number,
        created_at
      )
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (entries || []) as RaffleEntry[];
}

export async function GET() {
  try {
    const safeEntries = await loadEntries();

    return NextResponse.json({
      ok: true,
      entries: safeEntries,
      stats: buildStats(safeEntries),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(error),
        details: error,
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
          date_of_birth: "1990-01-01",
          ticket_amount: ticketAmount,
          message:
            "TEST ENTRY ONLY - delete this before the real official raffle draw.",

          consent_given: true,
          age_confirmed: true,
          terms_accepted: true,
          eligibility_confirmed: true,

          status: "test_entry",
          payment_status: "paid",
          amount_pence: amountPence,
          currency: "gbp",
          stripe_checkout_session_id: `test_session_${batchId}_${index + 1}`,
          stripe_payment_intent_id: `test_payment_${batchId}_${index + 1}`,
          raffle_winner_position: null,
          raffle_won_at: null,
          raffle_draw_notes: null,
          created_at: now,
          source: "admin_test_raffle",
        };
      });

      const { data: createdEntries, error } = await supabaseAdmin
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

      const created = (createdEntries || []) as RaffleEntry[];
      const allTicketNumbers: number[] = [];

      try {
        for (const entry of created) {
          const quantity = ticketCount(entry.ticket_amount);

          const { ticketNumbers } = await createTicketNumbersForEntry(
            entry.id,
            quantity
          );

          allTicketNumbers.push(...ticketNumbers);
        }
      } catch (ticketError) {
        const createdIds = created.map((entry) => entry.id);

        if (createdIds.length > 0) {
          await supabaseAdmin
            .from("raffle_tickets")
            .delete()
            .in("raffle_entry_id", createdIds);

          await supabaseAdmin
            .from("raffle_entries")
            .delete()
            .in("id", createdIds);
        }

        return NextResponse.json(
          {
            ok: false,
            error:
              ticketError instanceof Error
                ? ticketError.message
                : "Could not create ticket numbers for test entries.",
          },
          { status: 500 }
        );
      }

      const entriesWithTickets = await loadEntries();

      return NextResponse.json({
        ok: true,
        entries: entriesWithTickets.filter((entry) =>
          created.some((createdEntry) => createdEntry.id === entry.id)
        ),
        created: created.length,
        totalTickets: allTicketNumbers.length,
        ticketNumbers: allTicketNumbers.sort((a, b) => a - b),
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

      await supabaseAdmin
        .from("raffle_tickets")
        .delete()
        .eq("raffle_entry_id", entryId);

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
      const { data: testEntries, error: findError } = await supabaseAdmin
        .from("raffle_entries")
        .select("id")
        .or(
          "email.like.test-raffle-%,stripe_checkout_session_id.like.test_session_%,stripe_payment_intent_id.like.test_payment_%,source.eq.admin_test_raffle,status.eq.test_entry"
        );

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

      const ids = (testEntries || []).map((entry) => entry.id);

      if (ids.length === 0) {
        return NextResponse.json({
          ok: true,
          deleted: 0,
          deletedEntries: [],
        });
      }

      await supabaseAdmin
        .from("raffle_tickets")
        .delete()
        .in("raffle_entry_id", ids);

      const { data, error } = await supabaseAdmin
        .from("raffle_entries")
        .delete()
        .in("id", ids)
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
        .select(
          `
          *,
          raffle_tickets (
            id,
            raffle_entry_id,
            ticket_number,
            created_at
          )
        `
        )
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
        .select(
          `
          *,
          raffle_tickets (
            id,
            raffle_entry_id,
            ticket_number,
            created_at
          )
        `
        )
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
        message: `${prizeLabel(
          prizePosition
        )} has been reset and can be drawn again.`,
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
        .select(
          `
          *,
          raffle_tickets (
            id,
            raffle_entry_id,
            ticket_number,
            created_at
          )
        `
        )
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
          error: `${prizeLabel(
            prizePosition
          )} has already been drawn. Use Redo ${prizeLabel(
            prizePosition
          )} first if you need to draw again.`,
          existingWinner: existingPrizeWinner,
        },
        { status: 409 }
      );
    }

    const { data: paidEntries, error: paidError } = await supabaseAdmin
      .from("raffle_entries")
      .select(
        `
        *,
        raffle_tickets (
          id,
          raffle_entry_id,
          ticket_number,
          created_at
        )
      `
      )
      .eq("payment_status", "paid")
      .is("raffle_winner_position", null)
      .eq("age_confirmed", true)
      .eq("terms_accepted", true)
      .eq("eligibility_confirmed", true)
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
            "No paid eligible raffle entries are available to draw. Previous winners are excluded.",
        },
        { status: 400 }
      );
    }

    const ticketPool: TicketPoolItem[] = [];

    for (const entry of entries) {
      const raffleTickets = entry.raffle_tickets || [];

      for (const ticket of raffleTickets) {
        const ticketNumber = Number(ticket.ticket_number);

        if (
          Number.isFinite(ticketNumber) &&
          ticketNumber >= FIRST_TICKET_NUMBER &&
          ticketNumber <= LAST_TICKET_NUMBER
        ) {
          ticketPool.push({
            entry,
            ticketNumber,
            raffleTicketId: ticket.id,
          });
        }
      }
    }

    if (ticketPool.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No raffle ticket numbers found in the paid draw pool. Make sure paid entries have rows in raffle_tickets from 1001 upwards.",
        },
        { status: 400 }
      );
    }

    const randomWinningTicketIndex = randomInt(0, ticketPool.length);
    const winningTicket = ticketPool[randomWinningTicketIndex];
    const winner = winningTicket.entry;

    const drawnAt = new Date().toISOString();
    const winnerAllNumbers = formatEntryTicketNumbers(winner);

    const notes = `${prizeLabel(
      prizePosition
    )} drawn from ${entries.length} paid eligible people and ${
      ticketPool.length
    } paid ticket numbers. Winning raffle ticket number was #${
      winningTicket.ticketNumber
    }. Winner's full ticket numbers: ${winnerAllNumbers}. Drawn using crypto.randomInt on the server.`;

    const { data: updatedWinner, error: updateError } = await supabaseAdmin
      .from("raffle_entries")
      .update({
        raffle_winner_position: prizePosition,
        raffle_won_at: drawnAt,
        raffle_draw_notes: notes,
      })
      .eq("id", winner.id)
      .is("raffle_winner_position", null)
      .select(
        `
        *,
        raffle_tickets (
          id,
          raffle_entry_id,
          ticket_number,
          created_at
        )
      `
      )
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
        randomWinningTicketNumber: winningTicket.ticketNumber,
        randomWinningTicketIndex: randomWinningTicketIndex + 1,
        raffleTicketId: winningTicket.raffleTicketId,
        winnerAllTicketNumbers: getEntryTicketNumbers(winner),
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