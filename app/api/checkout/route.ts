import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16" as any,
});

export async function POST(req: NextRequest) {
  const { businessName, contactName, email, phone, address, entryId } = await req.json();

  if (!email || !entryId) {
    return NextResponse.json(
      { error: "Missing required fields (email or entryId)" },
      { status: 400 }
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Windows of Hope Competition Entry",
              description: `Entry by ${businessName || ""} (${contactName || ""})`,
            },
            unit_amount: 200, // £2 in pence
          },
          quantity: 1,
        },
      ],

      // ✅ IMPORTANT: include session_id so Success page can verify payment
      success_url: `${process.env.NEXT_PUBLIC_URL}/Competition/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/competition`,

      customer_email: email,

      // ✅ CRITICAL: Link Stripe -> your Supabase entry row
      metadata: {
        entryId: String(entryId), // <-- this is the key one
        businessName: businessName || "",
        contactName: contactName || "",
        phone: phone || "",
        address: address || "",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
