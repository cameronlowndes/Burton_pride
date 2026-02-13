import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is missing");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2023-08-16" as any,
});

export async function POST(req: NextRequest) {
  try {
    const { businessName, contactName, email, phone, address, entryId } = await req.json();

    if (!email || !entryId) {
      return NextResponse.json(
        { error: "Missing required fields (email or entryId)" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_URL is missing in Vercel env vars" },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Windows of Hope Competition Entry",
              description: `Entry by ${businessName || ""} (${contactName || ""})`,
            },
            unit_amount: 200,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/Competition/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/competition`,
      customer_email: email,

      // ✅ best practice: metadata on payment intent
      payment_intent_data: {
        metadata: {
          entryId: String(entryId),
          businessName: businessName || "",
          contactName: contactName || "",
          phone: phone || "",
          address: address || "",
        },
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a session URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    // Show the real Stripe error in Vercel logs
    console.error("Stripe session create error:", err?.message, err);
    return NextResponse.json(
      { error: err?.message || "Stripe session create failed" },
      { status: 500 }
    );
  }
}
