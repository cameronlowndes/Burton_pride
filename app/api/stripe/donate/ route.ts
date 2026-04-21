import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

function getStripe() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(stripeSecretKey);
}

function parseAmountToPence(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;

  const raw = String(value).trim().replace("£", "");
  if (!raw) return null;

  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount < 1) {
    return null;
  }

  return Math.round(amount * 100);
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Stripe donation API is live" });
}

export async function POST(req: NextRequest) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_URL;

    if (!appUrl) {
      return NextResponse.json(
        { ok: false, error: "Missing NEXT_PUBLIC_URL" },
        { status: 500 }
      );
    }

    const stripe = getStripe();
    const body = await req.json();

    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim();
    const message = String(body.message || "").trim();
    const selectedAmount = String(body.selectedAmount || "").trim();
    const customAmount = String(body.customAmount || "").trim();

    let unitAmount: number | null = null;

    if (selectedAmount && selectedAmount !== "Custom") {
      unitAmount = parseAmountToPence(selectedAmount);
    } else {
      unitAmount = parseAmountToPence(customAmount);
    }

    if (!unitAmount) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid donation amount." },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Donation to Burton Pride",
              description: "Supporting Burton Pride C.I.C",
            },
            unit_amount: unitAmount,
          },
        },
      ],
      success_url: `${appUrl}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/donate?cancelled=1`,
      customer_email: email || undefined,
      submit_type: "donate",
      metadata: {
        donor_name: fullName || "",
        donor_email: email || "",
        donor_message: message || "",
        selected_amount: selectedAmount || "",
        custom_amount: customAmount || "",
      },
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
    });
  } catch (error) {
    console.error("Stripe donation route error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: false, error: "Failed to create donation checkout session." },
      { status: 500 }
    );
  }
}