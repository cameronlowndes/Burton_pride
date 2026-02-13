import Stripe from "stripe";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16" as any,
});

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    console.error("❌ Missing stripe-signature header");
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("❌ Missing STRIPE_WEBHOOK_SECRET env var");
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const body = await req.text(); // ✅ raw body for signature verification

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err?.message || err);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  console.log("✅ Stripe webhook received:", event.type);

  // Only handle the event we care about
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Email may be here (depends how checkout was created)
  const sessionEmail =
    session.customer_details?.email || session.customer_email || undefined;

  // --- ✅ FIX: Get entryId from Session metadata OR PaymentIntent metadata ---
  let entryId = session.metadata?.entryId;

  // If missing, pull from PaymentIntent metadata (because you set it there earlier)
  if (!entryId && session.payment_intent) {
    try {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
      entryId = pi.metadata?.entryId;
      console.log("ℹ️ entryId from payment_intent metadata:", entryId);
    } catch (e: any) {
      console.error("❌ Failed to retrieve PaymentIntent:", e?.message || e);
    }
  }

  console.log("ℹ️ Session email:", sessionEmail);
  console.log("ℹ️ EntryId:", entryId);

  if (!entryId) {
    console.warn("⚠️ No entryId found (session.metadata or payment_intent.metadata)");
    return NextResponse.json({ received: true });
  }

  const db = supabaseAdmin();

  // 1) Mark as paid
  const { error: updatePaidError } = await db
    .from("competition_entries")
    .update({ payment_status: "paid" })
    .eq("id", entryId);

  if (updatePaidError) console.error("❌ Supabase update paid error:", updatePaidError);

  // 2) Fetch entry
  const { data: entry, error: entryError } = await db
    .from("competition_entries")
    .select("id, business_name, contact_name, email, confirmation_email_sent_at")
    .eq("id", entryId)
    .single();

  if (entryError || !entry) {
    console.error("❌ Supabase fetch entry error:", entryError);
    return NextResponse.json({ received: true });
  }

  const toEmail = entry.email || sessionEmail;
  if (!toEmail) {
    console.error("❌ No recipient email found (db or session)");
    return NextResponse.json({ received: true });
  }

  // Idempotency: don’t send twice
  if (entry.confirmation_email_sent_at) {
    console.log("ℹ️ Email already sent for entry:", entryId);
    return NextResponse.json({ received: true });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("❌ RESEND_API_KEY missing in environment variables");
    return NextResponse.json({ received: true });
  }

  const resend = new Resend(resendKey);

  // ✅ While testing: use Resend default sender (avoids domain verification issues)
  // Later (live), switch back to your custom domain once verified in Resend.
  const FROM =
    process.env.EMAIL_FROM?.trim() ||
    "Burton Pride <onboarding@resend.dev>";

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: "Payment received — you’re entered! 🎉",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>You’re officially entered 🎉</h2>
          <p>Hi ${entry.contact_name || "there"},</p>
          <p>
            We’ve received your payment and confirmed your entry for
            <strong>${entry.business_name || "your business"}</strong>
            in the <strong>Windows of Hope Competition 2026</strong>.
          </p>
          <p><strong>Next step:</strong> upload your competition image on the success page after checkout.</p>
          <p style="margin-top: 18px;">
            Good luck, and thank you for supporting Burton Pride C.I.C 🌈<br/>
            <strong>— Burton Pride Team</strong>
          </p>
        </div>
      `,
    });

    console.log("✅ Resend send result:", result);

    // Mark sent
    const { error: markSentError } = await db
      .from("competition_entries")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", entryId);

    if (markSentError) console.error("❌ Supabase mark email sent error:", markSentError);
  } catch (emailErr: any) {
    console.error("❌ Resend send error:", emailErr?.message || emailErr, emailErr);
  }

  return NextResponse.json({ received: true });
}
