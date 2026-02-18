import Stripe from "stripe";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16" as any,
});

function escapeHtml(s: string) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function drivePreviewUrl(url: string) {
  const u = String(url || "").trim();
  if (!u) return "";
  if (u.includes("drive.google.com/uc?")) return u;
  const m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (m?.[1]) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  return u;
}

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

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const sessionEmail = session.customer_details?.email || session.customer_email || "";

  let entryId = session.metadata?.entryId;
  if (!entryId && session.payment_intent) {
    try {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
      entryId = pi.metadata?.entryId;
    } catch (e: any) {
      console.error("❌ Failed to retrieve PaymentIntent:", e?.message || e);
    }
  }

  if (!entryId) return NextResponse.json({ received: true });

  const db = supabaseAdmin();

  await db.from("competition_entries").update({ payment_status: "paid" }).eq("id", entryId);

  const { data: entry, error: entryError } = await db
    .from("competition_entries")
    .select(
      "id, business_name, contact_name, email, phone, address, website, image_url, confirmation_email_sent_at"
    )
    .eq("id", entryId)
    .single();

  if (entryError || !entry) return NextResponse.json({ received: true });

  if (entry.confirmation_email_sent_at) {
    return NextResponse.json({ received: true });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ received: true });

  const resend = new Resend(resendKey);

  // Verified sender
  const FROM = "Burton Pride <noreply@windowsofhope.burtonpride.co.uk>";
  const REPLY_TO = process.env.EMAIL_REPLY_TO?.trim() || "prideburton@gmail.com";
  const adminEmail = process.env.BURTON_PRIDE_NOTIFY_EMAIL?.trim() || "prideburton@gmail.com";

  // ✅ Embed logo into email (CID). This GUARANTEES the logo shows.
  // Make sure the file exists: /public/image/logo/WindowsHope.png
  let logoBase64 = "";
  try {
    const logoPath = path.join(process.cwd(), "public", "image", "logo", "WindowsHope.png");
    logoBase64 = fs.readFileSync(logoPath).toString("base64");
  } catch (e: any) {
    console.error("❌ Could not read logo file from /public/image/logo/WindowsHope.png:", e?.message || e);
  }

  const customerEmail = String(entry.email || sessionEmail || "")
    .trim()
    .toLowerCase();
  const imageUrl = drivePreviewUrl(entry.image_url || "");

  const safeBusiness = escapeHtml(entry.business_name || "");
  const safeContact = escapeHtml(entry.contact_name || "");
  const safeEmail = escapeHtml(entry.email || "");
  const safePhone = escapeHtml(entry.phone || "");
  const safeAddress = escapeHtml(entry.address || "");
  const safeWebsite = escapeHtml(entry.website || "");

  // Shared footer (helps trust + deliverability)
  const footerHtml = `
    <div style="padding:14px 20px;background:#f9fafb;color:#6b7280;font-size:12px;border-top:1px solid #eef2f7;">
      Burton Pride C.I.C • Burton-on-Trent<br/>
      If you need help, email us at prideburton@gmail.com.
    </div>
  `;

  const headerHtml = `
    <div style="padding:18px 20px;background:linear-gradient(90deg,#ec4899,#8b5cf6,#3b82f6);color:#fff;">
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="cid:bp-logo" alt="Burton Pride" width="44" height="44"
          style="display:block;border-radius:10px;background:#fff;padding:6px;object-fit:contain" />
        <div>
          <div style="font-size:16px;font-weight:700;">Burton Pride C.I.C</div>
          <div style="font-size:13px;opacity:.95;">Windows of Hope Competition 2026</div> 
        </div>
      </div>
    </div>
  `;

  // Customer email
  const customerSubject = "Payment received — your Windows of Hope entry is confirmed";
  const customerText = `Hi ${entry.contact_name || "there"},
Your payment has been received and your entry for "${entry.business_name || ""}" is confirmed.
If you need help, email us at prideburton@gmail.com.
— Burton Pride C.I.C`;

  const customerHtml = `
    <div style="background:#f6f7fb;padding:28px 12px;font-family:Arial,sans-serif;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e9e9ef;">
        ${headerHtml}
        <div style="padding:22px 20px;color:#111827;">
          <h2 style="margin:0 0 10px;font-size:22px;">Entry confirmed ✅</h2>
          <p style="margin:0 0 12px;">Hi ${safeContact || "there"},</p>
          <p style="margin:0 0 14px;">
            We’ve received your payment. Your entry for <strong>${safeBusiness}</strong> is confirmed.
          </p>

          <div style="background:#f9fafb;border:1px solid #eef2f7;border-radius:12px;padding:14px;margin:14px 0;">
            <div style="font-size:13px;color:#6b7280;margin-bottom:8px;">Your details</div>
            <div style="font-size:14px;"><strong>Business:</strong> ${safeBusiness}</div>
            <div style="font-size:14px;"><strong>Contact:</strong> ${safeContact}</div>
            <div style="font-size:14px;"><strong>Email:</strong> ${safeEmail}</div>
          </div>

          <p style="margin:0;color:#374151;">
            Thank you for supporting Burton Pride 🌈
          </p>
        </div>
        ${footerHtml}
      </div>
    </div>
  `;

  // Admin email
  const adminSubject = "New paid Windows of Hope entry (details inside)";
  const adminText = `New PAID entry:
Business: ${entry.business_name || ""}
Contact: ${entry.contact_name || ""}
Email: ${entry.email || ""}
Phone: ${entry.phone || ""}
Address: ${entry.address || ""}
Website: ${entry.website || ""}
Entry ID: ${entry.id}
Photo: ${imageUrl || "none"}`;

  const adminHtml = `
    <div style="background:#f6f7fb;padding:28px 12px;font-family:Arial,sans-serif;">
      <div style="max-width:700px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e9e9ef;">
        ${headerHtml}
        <div style="padding:22px 20px;color:#111827;">
          <h2 style="margin:0 0 12px;font-size:22px;">New paid entry ✅</h2>

          <div style="background:#f9fafb;border:1px solid #eef2f7;border-radius:12px;padding:14px;margin:14px 0;">
            <div style="font-size:14px;"><strong>Business:</strong> ${safeBusiness}</div>
            <div style="font-size:14px;"><strong>Contact:</strong> ${safeContact}</div>
            <div style="font-size:14px;"><strong>Email:</strong> ${safeEmail}</div>
            <div style="font-size:14px;"><strong>Phone:</strong> ${safePhone}</div>
            <div style="font-size:14px;"><strong>Address:</strong> ${safeAddress}</div>
            ${safeWebsite ? `<div style="font-size:14px;"><strong>Website:</strong> ${safeWebsite}</div>` : ""}
            <div style="font-size:14px;"><strong>Entry ID:</strong> ${escapeHtml(entry.id)}</div>
          </div>

          ${
            imageUrl
              ? `
                <h3 style="margin:18px 0 10px;font-size:16px;">Photo</h3>
                <img src="${imageUrl}" alt="Uploaded photo" style="max-width:100%;border-radius:12px;border:1px solid #eee;" />
                <div style="margin-top:8px;font-size:12px;">
                  <a href="${imageUrl}">Open photo</a>
                </div>
              `
              : `<p><em>No image uploaded.</em></p>`
          }
        </div>
        ${footerHtml}
      </div>
    </div>
  `;

  try {
    const headers = {
      "List-Unsubscribe": `<mailto:${REPLY_TO}?subject=unsubscribe>`,
    } as Record<string, string>;

    const logoAttachment =
      logoBase64
        ? [
            {
              filename: "WindowsHope.png",
              content: logoBase64,
              contentType: "image/png",
              content_id: "bp-logo", // matches cid:bp-logo in HTML
            },
          ]
        : undefined;

    // Send customer email
    if (customerEmail) {
      await resend.emails.send({
        from: FROM,
        to: customerEmail,
        replyTo: REPLY_TO,
        subject: customerSubject,
        text: customerText,
        html: customerHtml,
        headers,
        attachments: logoAttachment,
      });
      console.log("✅ Customer email sent");
    } else {
      console.warn("⚠️ Customer email missing — skipped customer email send");
    }

    // Send admin email
    await resend.emails.send({
      from: FROM,
      to: adminEmail,
      replyTo: REPLY_TO,
      subject: adminSubject,
      text: adminText,
      html: adminHtml,
      headers,
      attachments: logoAttachment,
    });
    console.log("✅ Admin email sent");

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
