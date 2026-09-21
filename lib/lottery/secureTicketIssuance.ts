import {
  randomInt,
} from "node:crypto";

import {
  supabaseAdmin,
} from "@/lib/supabase/supabaseAdmin";

export type LotteryTicket = {
  id: string;
  ticket_number: string;
  status: string;
  issued_at: string | null;
};

export type PaidLotteryOrder = {
  id: string;
  lottery_id: string;
  quantity: number;
  payment_status: string;
};

export type TicketLottery = {
  id: string;
  max_tickets: number | null;
};

function parseNumericTicketNumber(
  value: unknown,
) {
  const text =
    String(
      value ?? "",
    ).trim();

  if (
    !/^[0-9]+$/.test(
      text,
    )
  ) {
    return null;
  }

  const number =
    Number(
      text,
    );

  return (
    Number.isSafeInteger(
      number,
    ) &&
    number >= 1
  )
    ? number
    : null;
}

function formatTicketNumber(
  ticketNumber: number,
  maxTickets: number,
) {
  return String(
    ticketNumber,
  ).padStart(
    Math.max(
      4,
      String(
        maxTickets,
      ).length,
    ),
    "0",
  );
}

async function getUsedNumbers(
  lotteryId: string,
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "lottery_tickets",
      )
      .select(
        "ticket_number",
      )
      .eq(
        "lottery_id",
        lotteryId,
      );

  if (
    error
  ) {
    throw new Error(
      `Could not read issued ticket numbers: ${error.message}`,
    );
  }

  return new Set(
    (data ?? [])
      .map(
        (ticket) =>
          parseNumericTicketNumber(
            ticket.ticket_number,
          ),
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      ),
  );
}

function pickRandomUnusedNumber(
  used: Set<number>,
  maxTickets: number,
) {
  const usedNumbers =
    Array.from(
      used,
    )
      .filter(
        (number) =>
          number >= 1 &&
          number <= maxTickets,
      )
      .sort(
        (first, second) =>
          first - second,
      );

  const availableCount =
    maxTickets -
    usedNumbers.length;

  if (
    availableCount < 1
  ) {
    return null;
  }

  // Node's crypto.randomInt is cryptographically secure. This maps a random
  // free position through the gaps, so it remains random without scanning the
  // entire ticket range.
  let freePosition =
    randomInt(
      availableCount,
    );

  let previous =
    0;

  for (
    const issued of
    usedNumbers
  ) {
    const gap =
      issued - previous - 1;

    if (
      freePosition < gap
    ) {
      return previous + freePosition + 1;
    }

    freePosition -= gap;
    previous = issued;
  }

  return previous + freePosition + 1;
}

/**
 * The one ticket allocator for the public checkout and Lottery Management.
 * It is server-only. Do not import this from a client component.
 */
export async function issueTicketsForPaidOrder(
  order: PaidLotteryOrder,
  lottery: TicketLottery,
) {
  if (
    order.payment_status !==
    "paid"
  ) {
    throw new Error(
      "Tickets can only be issued after payment is confirmed.",
    );
  }

  const maxTickets =
    Math.floor(
      Number(
        lottery.max_tickets ??
        0,
      ),
    );

  if (
    !Number.isSafeInteger(
      maxTickets,
    ) ||
    maxTickets < 1
  ) {
    throw new Error(
      "The lottery does not have a valid maximum ticket number.",
    );
  }

  const {
    data: existingTickets,
    error: existingTicketsError,
  } =
    await supabaseAdmin
      .from(
        "lottery_tickets",
      )
      .select(
        "id,ticket_number,status,issued_at",
      )
      .eq(
        "order_id",
        order.id,
      )
      .order(
        "issued_at",
        {
          ascending: true,
        },
      );

  if (
    existingTicketsError
  ) {
    throw new Error(
      `Could not read existing order tickets: ${existingTicketsError.message}`,
    );
  }

  const tickets =
    [
      ...(
        existingTickets ??
        []
      ),
    ] as LotteryTicket[];

  const missing =
    Math.max(
      0,
      Math.floor(
        Number(
          order.quantity ??
          0,
        ),
      ) - tickets.length,
    );

  if (
    missing === 0
  ) {
    return tickets;
  }

  const used =
    await getUsedNumbers(
      order.lottery_id,
    );

  for (
    let count = 0;
    count < missing;
    count += 1
  ) {
    let inserted:
      | LotteryTicket
      | null =
      null;

    /*
     * Do not stop after an arbitrary number of retries. A unique-number
     * collision can happen when another checkout issues a ticket at the same
     * time. Each 23505 response is added to `used`, so the next pick is from
     * the remaining numbers. At worst this checks the complete ticket range
     * and then returns an honest sold-out/all-numbers-conflict error.
     */
    for (
      let attempt = 0;
      attempt < maxTickets;
      attempt += 1
    ) {
      const number =
        pickRandomUnusedNumber(
          used,
          maxTickets,
        );

      if (
        number === null
      ) {
        throw new Error(
          "This lottery is sold out; no ticket numbers remain.",
        );
      }

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "lottery_tickets",
          )
          .insert({
            lottery_id: order.lottery_id,
            order_id: order.id,
            ticket_number: formatTicketNumber(
              number,
              maxTickets,
            ),
            status: "issued",
            issued_at: new Date().toISOString(),
          })
          .select(
            "id,ticket_number,status,issued_at",
          )
          .single();

      if (
        !error &&
        data
      ) {
        inserted =
          data as LotteryTicket;
        used.add(
          number,
        );
        break;
      }

      if (
        error?.code ===
        "23505"
      ) {
        const duplicateDetails =
          String(
            error.details ??
            "",
          );

        /*
         * A duplicate on ticket_number alone means an old database rule is
         * wrongly enforcing uniqueness across all lotteries. Retrying cannot
         * solve that configuration problem, so stop immediately instead of
         * keeping the admin waiting for a full ticket-range scan.
         */
        if (
          duplicateDetails.includes(
            "(ticket_number)",
          ) &&
          !duplicateDetails.includes(
            "lottery_id",
          )
        ) {
          throw new Error(
            "The database still has a global ticket_number unique rule. Run the lottery ticket-number database migration before issuing tickets.",
          );
        }

        // Another completed checkout received this number first. Pick again.
        used.add(
          number,
        );
        continue;
      }

      throw new Error(
        `Could not issue a random ticket: ${
          error?.message ??
          "Unknown database error"
        }`,
      );
    }

    if (
      !inserted
    ) {
      throw new Error(
        "Could not allocate a ticket number because no unique numbers remain in this lottery.",
      );
    }

    tickets.push(
      inserted,
    );
  }

  return tickets;
}
