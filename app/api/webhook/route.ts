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

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err?.message || err);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  console.log("✅ Stripe webhook received:", event.type);

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  const sessionEmail =
    session.customer_details?.email || session.customer_email || undefined;

  let entryId = session.metadata?.entryId;

  if (!entryId && session.payment_intent) {
    try {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
      entryId = pi.metadata?.entryId;
    } catch (e: any) {
      console.error("❌ Failed to retrieve PaymentIntent:", e?.message || e);
    }
  }

  if (!entryId) {
    console.warn("⚠️ No entryId found");
    return NextResponse.json({ received: true });
  }

  const db = supabaseAdmin();

  // Mark as paid
  await db
    .from("competition_entries")
    .update({ payment_status: "paid" })
    .eq("id", entryId);

  // Fetch entry
  const { data: entry, error: entryError } = await db
    .from("competition_entries")
    .select(
      "id, business_name, contact_name, email, phone, address, website, image_url, confirmation_email_sent_at"
    )
    .eq("id", entryId)
    .single();

  if (entryError || !entry) {
    console.error("❌ Supabase fetch entry error:", entryError);
    return NextResponse.json({ received: true });
  }

  // Stop double email
  if (entry.confirmation_email_sent_at) {
    console.log("ℹ️ Email already sent for entry:", entryId);
    return NextResponse.json({ received: true });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("❌ RESEND_API_KEY missing");
    return NextResponse.json({ received: true });
  }

  const resend = new Resend(resendKey);

  // ✅ Proper Burton Pride sender
  const FROM = process.env.EMAIL_FROM?.trim();
  if (!FROM) {
    console.error("❌ EMAIL_FROM missing in Vercel env vars");
    return NextResponse.json({ received: true });
  }

  const REPLY_TO =
    process.env.EMAIL_REPLY_TO?.trim() || "prideburton@gmail.com";

  const adminEmail =
    process.env.BURTON_PRIDE_NOTIFY_EMAIL?.trim() || "prideburton@gmail.com";

  // Convert Google Drive link for email preview
  const imageUrl = (() => {
    const url = String(entry.image_url || "").trim();
    if (!url) return "";

    if (url.includes("drive.google.com/uc?")) return url;

    const m = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (m?.[1]) return `https://drive.google.com/uc?export=view&id=${m[1]}`;

    return url;
  })();

  try {
    // Email entrant
    await resend.emails.send({
      from: FROM,
      to: entry.email || sessionEmail,
      replyTo: REPLY_TO,
      subject: "Payment received — you’re entered! 🎉",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>You’re officially entered 🎉</h2>
          <p>Hi ${entry.contact_name || "there"},</p>
          <p>Your entry for <strong>${entry.business_name}</strong> is confirmed.</p>
          <p>Thank you for supporting Burton Pride 🌈</p>
        </div>
      `,
    });

    // Email Burton Pride admin
    await resend.emails.send({
      from: FROM,
      to: adminEmail,
      replyTo: REPLY_TO,
      subject: "✅ New PAID Windows of Hope entry",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>New PAID Entry</h2>

          <p><strong>Business:</strong> ${entry.business_name}</p>
          <p><strong>Contact:</strong> ${entry.contact_name}</p>
          <p><strong>Email:</strong> ${entry.email}</p>
          <p><strong>Phone:</strong> ${entry.phone}</p>
          <p><strong>Address:</strong> ${entry.address}</p>
          ${entry.website ? `<p><strong>Website:</strong> ${entry.website}</p>` : ""}

          ${
            imageUrl
              ? `<img src="${imageUrl}" style="max-width:600px;width:100%;border-radius:12px;" />`
              : "<p>No image uploaded</p>"
          }
        </div>
      `,
    });

    // Mark email sent
    await db
      .from("competition_entries")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", entryId);
  } catch (err: any) {
    console.error("❌ Email send failed:", err?.message || err);
  }

  return NextResponse.json({ received: true });
}