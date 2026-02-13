import Stripe from "stripe";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16" as any,
});

export async function POST(req: Request) {
  const body = await req.text();

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const entryId = session.metadata?.entryId;
    const email =
      session.customer_details?.email ||
      session.customer_email ||
      undefined;

    if (!entryId) {
      console.warn("checkout.session.completed missing metadata.entryId");
      return NextResponse.json({ received: true });
    }

    const db = supabaseAdmin();

    // 1) Mark as paid
    const { error: updatePaidError } = await db
      .from("competition_entries")
      .update({ payment_status: "paid" })
      .eq("id", entryId);

    if (updatePaidError) console.error("Supabase update paid error:", updatePaidError);

    // 2) Fetch entry
    const { data: entry, error: entryError } = await db
      .from("competition_entries")
      .select("id, business_name, contact_name, email, confirmation_email_sent_at")
      .eq("id", entryId)
      .single();

    if (entryError || !entry) {
      console.error("Supabase fetch entry error:", entryError);
      return NextResponse.json({ received: true });
    }

    const toEmail = entry.email || email;
    if (!toEmail) return NextResponse.json({ received: true });

    // Idempotency
    if (entry.confirmation_email_sent_at) return NextResponse.json({ received: true });

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return NextResponse.json({ received: true });

    const resend = new Resend(resendKey);

    try {
      await resend.emails.send({
        from: "Burton Pride <noreply@windowsofhope.burtonpride.co.uk>",
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

      // Mark sent
      const { error: markSentError } = await db
        .from("competition_entries")
        .update({ confirmation_email_sent_at: new Date().toISOString() })
        .eq("id", entryId);

      if (markSentError) console.error("Supabase mark email sent error:", markSentError);
    } catch (emailErr) {
      console.error("Resend send error:", emailErr);
    }
  }

  return NextResponse.json({ received: true });
}
