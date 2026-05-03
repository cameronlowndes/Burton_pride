import Stripe from "stripe";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16" as any,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const ticketAmount = Number(body.ticketAmount || 1);
    const message = String(body.message || "").trim();

    if (!fullName || !email || !phone) {
      return NextResponse.json(
        { ok: false, error: "Name, email and phone are required" },
        { status: 400 }
      );
    }

    if (!ticketAmount || ticketAmount < 1) {
      return NextResponse.json(
        { ok: false, error: "Please choose at least 1 ticket" },
        { status: 400 }
      );
    }

    /**
     * ✅ ONE-TIME ONLY CHECK
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

    const appUrl =
      process.env.NEXT_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL;

    if (!appUrl) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing app URL. Add NEXT_PUBLIC_URL or NEXT_PUBLIC_APP_URL to your environment variables.",
        },
        { status: 500 }
      );
    }

    const metadata = {
      fullName,
      email,
      phone,
      ticketAmount: String(ticketAmount),
      message,
      source: "website_raffle",
      amountPence: String(amountPence),
    };

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      success_url: `${appUrl}/Raffle/Success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/Raffle`,
      metadata,
      payment_intent_data: {
        metadata,
      },
      line_items: [
        {
          quantity: ticketAmount,
          price_data: {
            currency: "gbp",
            unit_amount: 100,
            product_data: {
              name: "Burton Pride Raffle Ticket",
              description: "£1 raffle ticket supporting Burton Pride C.I.C",
              metadata,
            },
          },
        },
      ],
    });

    const { error: insertError } = await supabaseAdmin
      .from("raffle_entries")
      .insert({
        full_name: fullName,
        email,
        phone,
        ticket_amount: String(ticketAmount),
        message: message || null,
        consent_given: true,

        status: "checkout_started",
        payment_status: "checkout_started",
        amount_pence: amountPence,
        currency: "gbp",

        stripe_checkout_session_id: checkoutSession.id,
        source: "website_raffle",
      });

    if (insertError) {
      return NextResponse.json(
        {
          ok: false,
          error: insertError.message,
          details: insertError,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
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