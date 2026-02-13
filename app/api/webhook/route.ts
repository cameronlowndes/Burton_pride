//hello
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16" as any,
});

/**
 * Server-side Supabase client (admin).
 * Uses service role key when available.
 */
function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || // ✅ best (legacy name)
    process.env.SUPABASE_SECRET_KEY ||       // ✅ fallback (new name some people use)
    process.env.SUPABASE_ANON_KEY ||         // ⚠️ last resort (won’t bypass RLS)
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error("SUPABASE_URL is missing");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function POST(req: Request) {
  const body = await req.text();

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

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

  // ✅ Only act on successful checkout
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

    const supabaseAdmin = getSupabaseAdmin();

    // 1) Mark as paid
    const { error: updatePaidError } = await supabaseAdmin
      .from("competition_entries")
      .update({ payment_status: "paid" })
      .eq("id", entryId);

    if (updatePaidError) {
      console.error("Supabase update paid error:", updatePaidError);
      // continue anyway
    }

    // 2) Fetch entry details
    const { data: entry, error: entryError } = await supabaseAdmin
      .from("competition_entries")
      .select("id, business_name, contact_name, email, confirmation_email_sent_at")
      .eq("id", entryId)
      .single();

    if (entryError || !entry) {
      console.error("Supabase fetch entry error:", entryError);
      return NextResponse.json({ received: true });
    }

    const toEmail = entry.email || email;
    if (!toEmail) {
      console.warn("No email found on entry or Stripe session");
      return NextResponse.json({ received: true });
    }

    // 3) Idempotency: only send once
    if (entry.confirmation_email_sent_at) {
      return NextResponse.json({ received: true });
    }

    // 4) Send email
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.error("Missing RESEND_API_KEY");
      return NextResponse.json({ received: true });
    }

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

      // 5) Mark email as sent
      const { error: markSentError } = await supabaseAdmin
        .from("competition_entries")
        .update({ confirmation_email_sent_at: new Date().toISOString() })
        .eq("id", entryId);

      if (markSentError) {
        console.error("Supabase mark email sent error:", markSentError);
      }
    } catch (emailErr) {
      console.error("Resend send error:", emailErr);
    }
  }

  return NextResponse.json({ received: true });
}
