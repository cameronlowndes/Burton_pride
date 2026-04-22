import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_URL;

    if (!appUrl || !/^https?:\/\//.test(appUrl)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "NEXT_PUBLIC_URL is missing or invalid. It must start with http:// or https://",
        },
        { status: 500 }
      );
    }

    const body = await req.json();

    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim();
    const message = String(body.message || "").trim();
    const selectedAmount = String(body.selectedAmount || "");
    const customAmount = String(body.customAmount || "");

    if (!fullName) {
      return NextResponse.json(
        { ok: false, error: "Full name is required" },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "Email address is required" },
        { status: 400 }
      );
    }

    let amountInPence = 0;

    if (selectedAmount === "Custom") {
      amountInPence = Math.round(Number(customAmount) * 100);
    } else {
      amountInPence = Math.round(Number(selectedAmount.replace("£", "")) * 100);
    }

    if (!amountInPence || amountInPence < 100) {
      return NextResponse.json(
        { ok: false, error: "Minimum donation is £1" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Donation to Burton Pride C.I.C",
              description: "Community donation",
            },
            unit_amount: amountInPence,
          },
          quantity: 1,
        },
      ],
      metadata: {
        fullName,
        email,
        message,
      },
      success_url: `${appUrl}/DonateToUs/Success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/DonateToUs?canceled=true`,
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Stripe donate route error:", error);

    return NextResponse.json(
      { ok: false, error: "Failed to create Stripe session" },
      { status: 500 }
    );
  }
}