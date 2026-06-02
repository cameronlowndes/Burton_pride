import Stripe from "stripe";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16" as any,
});

const FIRST_TICKET_NUMBER = 1001;
const LAST_TICKET_NUMBER = 9999;

function isOver18(dateOfBirth: string) {
  if (!dateOfBirth) return false;

  const dob = new Date(dateOfBirth);

  if (Number.isNaN(dob.getTime())) {
    return false;
  }

  const today = new Date();

  const eighteenthBirthday = new Date(
    dob.getFullYear() + 18,
    dob.getMonth(),
    dob.getDate()
  );

  return today >= eighteenthBirthday;
}

function isValidDateOfBirth(dateOfBirth: string) {
  if (!dateOfBirth) return false;

  const dob = new Date(dateOfBirth);

  if (Number.isNaN(dob.getTime())) {
    return false;
  }

  const today = new Date();

  if (dob > today) {
    return false;
  }

  return true;
}

function getCleanAppUrl() {
  const appUrl =
    process.env.NEXT_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL;

  if (!appUrl) {
    throw new Error(
      "Missing app URL. Add NEXT_PUBLIC_URL or NEXT_PUBLIC_APP_URL to your environment variables."
    );
  }

  return appUrl.replace(/\/$/, "");
}

async function getNextTicketNumbers(quantity: number) {
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

  const ticketNumbers: number[] = [];

  for (
    let ticketNumber = FIRST_TICKET_NUMBER;
    ticketNumber <= LAST_TICKET_NUMBER;
    ticketNumber += 1
  ) {
    if (!used.has(ticketNumber)) {
      ticketNumbers.push(ticketNumber);
    }

    if (ticketNumbers.length === quantity) {
      break;
    }
  }

  if (ticketNumbers.length < quantity) {
    throw new Error("There are not enough raffle ticket numbers left.");
  }

  return ticketNumbers;
}

async function createTicketNumbersForEntry(
  raffleEntryId: string,
  quantity: number
) {
  let attempt = 0;

  while (attempt < 5) {
    attempt += 1;

    const ticketNumbers = await getNextTicketNumbers(quantity);

    const { error } = await supabaseAdmin.from("raffle_tickets").insert(
      ticketNumbers.map((ticketNumber) => ({
        raffle_entry_id: raffleEntryId,
        ticket_number: ticketNumber,
      }))
    );

    if (!error) {
      return ticketNumbers;
    }

    /**
     * 23505 = duplicate key.
     * If two people buy at the same time and hit the same next number,
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

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const dateOfBirth = String(body.dateOfBirth || "").trim();
    const ticketAmount = Number(body.ticketAmount || 1);
    const message = String(body.message || "").trim();

    const ageConfirmed = body.ageConfirmed === true;
    const termsAccepted = body.termsAccepted === true;

    if (!fullName || !email || !phone) {
      return NextResponse.json(
        {
          ok: false,
          error: "Name, email and phone are required.",
        },
        { status: 400 }
      );
    }

    if (!dateOfBirth) {
      return NextResponse.json(
        {
          ok: false,
          error: "Date of birth is required.",
        },
        { status: 400 }
      );
    }

    if (!isValidDateOfBirth(dateOfBirth)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter a valid date of birth.",
        },
        { status: 400 }
      );
    }

    if (!isOver18(dateOfBirth)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You must be aged 18 or over to buy Burton Pride raffle tickets.",
        },
        { status: 400 }
      );
    }

    if (!ageConfirmed) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You must confirm that you are aged 18 or over, a resident of Great Britain, and buying the tickets for yourself.",
        },
        { status: 400 }
      );
    }

    if (!termsAccepted) {
      return NextResponse.json(
        {
          ok: false,
          error: "You must agree to the raffle terms before buying tickets.",
        },
        { status: 400 }
      );
    }

    if (!ticketAmount || ticketAmount < 1) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please choose at least 1 ticket.",
        },
        { status: 400 }
      );
    }

    if (![1, 2, 5].includes(ticketAmount)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid ticket amount selected.",
        },
        { status: 400 }
      );
    }

    /**
     * ONE-TIME ONLY CHECK
     * This stops someone using the same email more than once.
     */
    const { data: existingEntry, error: existingError } = await supabaseAdmin
      .from("raffle_entries")
      .select("id, email, payment_status, stripe_checkout_session_id")
      .eq("email", email)
      .in("payment_status", ["checkout_started", "paid"])
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          ok: false,
          error: existingError.message,
          details: existingError,
        },
        { status: 500 }
      );
    }

    if (existingEntry) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You have already entered the raffle with this email address. Only one raffle entry is allowed per person.",
        },
        { status: 400 }
      );
    }

    const amountPence = ticketAmount * 100;
    const appUrl = getCleanAppUrl();

    const metadata = {
      fullName,
      email,
      phone,
      dateOfBirth,
      ticketAmount: String(ticketAmount),
      message,
      source: "website_raffle",
      amountPence: String(amountPence),
      ageConfirmed: String(ageConfirmed),
      termsAccepted: String(termsAccepted),
      eligibilityConfirmed: "true",
      licenceNumber: "SL0507",
    };

    /**
     * Save raffle entry first.
     * Then create ticket numbers.
     * Then create Stripe checkout.
     */
    const { data: raffleEntry, error: insertError } = await supabaseAdmin
      .from("raffle_entries")
      .insert({
        full_name: fullName,
        email,
        phone,
        date_of_birth: dateOfBirth,
        ticket_amount: String(ticketAmount),
        message: message || null,

        consent_given: true,
        age_confirmed: ageConfirmed,
        terms_accepted: termsAccepted,
        eligibility_confirmed: true,

        status: "checkout_started",
        payment_status: "checkout_started",
        amount_pence: amountPence,
        currency: "gbp",

        source: "website_raffle",
      })
      .select("id")
      .single();

    if (insertError || !raffleEntry) {
      return NextResponse.json(
        {
          ok: false,
          error: insertError?.message || "Could not save raffle entry.",
          details: insertError,
        },
        { status: 500 }
      );
    }

    let ticketNumbers: number[] = [];

    try {
      ticketNumbers = await createTicketNumbersForEntry(
        raffleEntry.id,
        ticketAmount
      );
    } catch (ticketError) {
      await supabaseAdmin
        .from("raffle_entries")
        .delete()
        .eq("id", raffleEntry.id);

      return NextResponse.json(
        {
          ok: false,
          error:
            ticketError instanceof Error
              ? ticketError.message
              : "Could not create raffle ticket numbers.",
        },
        { status: 500 }
      );
    }

    const ticketNumbersText = ticketNumbers.join(", ");

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      success_url: `${appUrl}/Raffle/Success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/Raffle`,
      metadata: {
        ...metadata,
        raffleEntryId: raffleEntry.id,
        ticketNumbers: ticketNumbers.join(","),
      },
      payment_intent_data: {
        metadata: {
          ...metadata,
          raffleEntryId: raffleEntry.id,
          ticketNumbers: ticketNumbers.join(","),
        },
      },
      line_items: [
        {
          quantity: ticketAmount,
          price_data: {
            currency: "gbp",
            unit_amount: 100,
            product_data: {
              name:
                ticketAmount === 1
                  ? "Burton Pride Raffle Ticket"
                  : "Burton Pride Raffle Tickets",
              description: `£1 raffle ticket supporting Burton Pride C.I.C. Ticket number${
                ticketAmount > 1 ? "s" : ""
              }: ${ticketNumbersText}. Licensed by East Staffordshire Council under registration number SL0507.`,
              metadata: {
                ...metadata,
                raffleEntryId: raffleEntry.id,
                ticketNumbers: ticketNumbers.join(","),
              },
            },
          },
        },
      ],
    });

    const { error: updateError } = await supabaseAdmin
      .from("raffle_entries")
      .update({
        stripe_checkout_session_id: checkoutSession.id,
        raffle_ticket_numbers: ticketNumbers,
      })
      .eq("id", raffleEntry.id);

    if (updateError) {
      console.error("Could not update raffle entry with Stripe session:", updateError);
    }

    return NextResponse.json({
      ok: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
      raffleEntryId: raffleEntry.id,
      ticketNumbers,
    });
  } catch (error) {
    console.error("Raffle checkout error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create raffle checkout",
      },
      { status: 500 }
    );
  }
}