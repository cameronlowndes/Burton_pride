import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY is missing");

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2023-08-16" as any,
});

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const db = supabaseAdmin();

    const body = await req.json();
    const entryId = String(body.entryId || "").trim();
    const email = String(body.email || "").trim().toLowerCase();

    const businessName = body.businessName || "";
    const contactName = body.contactName || "";
    const phone = body.phone || "";
    const address = body.address || "";

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

    // ✅ 1) Load entry from DB
    const { data: entry, error: entryErr } = await db
      .from("competition_entries")
      .select("id, email, payment_status")
      .eq("id", entryId)
      .single();

    if (entryErr || !entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    // ✅ 2) Ensure the email matches the entry (prevents tampering)
    if (String(entry.email || "").toLowerCase() !== email) {
      return NextResponse.json(
        { error: "Email does not match this entry." },
        { status: 403 }
      );
    }

    // ✅ 3) Block if already paid
    if (entry.payment_status === "paid") {
      return NextResponse.json(
        { error: "This entry has already been paid.", code: "ALREADY_PAID" },
        { status: 409 }
      );
    }

    // ✅ 4) (Recommended) Block if ANY paid entry exists for this email
    // Remove this block if you want to allow same email to enter multiple times.
    const { data: paidExisting, error: paidErr } = await db
      .from("competition_entries")
      .select("id")
      .eq("email", email)
      .eq("payment_status", "paid")
      .limit(1)
      .maybeSingle();

    if (paidErr) {
      console.error("Paid duplicate check error:", paidErr);
      return NextResponse.json({ error: paidErr.message }, { status: 500 });
    }

    if (paidExisting) {
      return NextResponse.json(
        {
          error:
            "An entry using this email has already been paid. Please contact us if you think this is a mistake.",
          code: "DUPLICATE_PAID_EMAIL",
        },
        { status: 409 }
      );
    }

    // ✅ 5) Create Stripe session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Windows of Hope Competition Entry",
              description: `Entry by ${businessName} (${contactName})`,
            },
            unit_amount: 200,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/Competition/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/competition`,
      customer_email: email,
      payment_intent_data: {
        metadata: {
          entryId,
          businessName,
          contactName,
          phone,
          address,
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
    console.error("Stripe session create error:", err?.message, err);
    return NextResponse.json(
      { error: err?.message || "Stripe session create failed" },
      { status: 500 }
    );
  }
}
