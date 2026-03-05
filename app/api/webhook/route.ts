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

function getSiteUrl(req: Request) {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    "";
  if (envUrl) return envUrl.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`.replace(/\/+$/, "");

  return "";
}

async function loadLogoBase64(req: Request) {
  // ✅ NEW LOGO PATH:
  // public/logo/WindowsOfHopeLogoReal.png
  const relPath = ["public", "logo", "WindowsOfHopeLogoReal.png"];
  const diskPath = path.join(process.cwd(), ...relPath);

  // 1) Try FS (local, and sometimes on deploy)
  try {
    if (fs.existsSync(diskPath)) {
      return fs.readFileSync(diskPath).toString("base64");
    }
  } catch (e: any) {
    console.error("❌ Logo fs read failed:", e?.message || e);
  }

  // 2) Fallback: fetch from deployed site (reliable on Vercel)
  try {
    const siteUrl = getSiteUrl(req);
    if (!siteUrl) return "";

    // public/ maps to /
    const url = `${siteUrl}/logo/WindowsOfHopeLogoReal.png`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error("❌ Logo fetch failed:", res.status, res.statusText, url);
      return "";
    }

    const buf = Buffer.from(await res.arrayBuffer());
    return buf.toString("base64");
  } catch (e: any) {
    console.error("❌ Logo fetch error:", e?.message || e);
    return "";
  }
}

function parseEmailList(value: string | undefined) {
  const raw = (value || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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
    return NextResponse.json({ error: `Webhook Error: ${err?.message || err}` }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const sessionEmail = session.customer_details?.email || session.customer_email || "";

  // ✅ Get entryId from metadata (session first, then payment intent)
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

  const db = supabaseAdmin;

  // ✅ Update payment status
  const { error: paidErr } = await db
    .from("competition_entries")
    .update({ payment_status: "paid" })
    .eq("id", entryId);

  if (paidErr) {
    console.error("❌ Failed to update payment_status:", paidErr);
  }

  const { data: entry, error: entryError } = await db
    .from("competition_entries")
    .select(
      "id, business_name, contact_name, email, phone, address, website, image_url, confirmation_email_sent_at"
    )
    .eq("id", entryId)
    .single();

  if (entryError || !entry) {
    console.error("❌ Could not load entry:", entryError);
    return NextResponse.json({ received: true });
  }

  // ✅ Prevent duplicates
  if (entry.confirmation_email_sent_at) {
    return NextResponse.json({ received: true });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("❌ Missing RESEND_API_KEY");
    return NextResponse.json({ received: true });
  }

  const resend = new Resend(resendKey);

  // ✅ Sender must be verified in Resend
  const FROM = process.env.EMAIL_FROM?.trim() || "Burton Pride <noreply@burtonpride.co.uk>";
  const REPLY_TO = process.env.EMAIL_REPLY_TO?.trim() || "prideburton@gmail.com";

  // ✅ Admin recipients (comma-separated supported)
  const adminList =
    parseEmailList(process.env.BURTON_PRIDE_NOTIFY_EMAILS) ||
    parseEmailList(process.env.BURTON_PRIDE_NOTIFY_EMAIL);

  const adminRecipients = adminList.length ? adminList : ["prideburton@gmail.com"];

  // ✅ Load logo (FS first, then fetch)
  const logoBase64 = await loadLogoBase64(req);

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

  const footerHtml = `
    <div style="padding:14px 20px;background:#f9fafb;color:#6b7280;font-size:12px;border-top:1px solid #eef2f7;">
      Burton Pride C.I.C • Burton-on-Trent<br/>
      If you need help, email us at ${escapeHtml(REPLY_TO)}.
    </div>
  `;

  const headerHtml = `
    <div style="padding:18px 20px;background:linear-gradient(90deg,#ec4899,#8b5cf6,#3b82f6);color:#fff;">
      <div style="display:flex;align-items:center;gap:18px;">
        ${
          logoBase64
            ? `<img src="cid:bp-logo" alt="Burton Pride" width="44" height="44"
                 style="display:block;border-radius:10px;background:#fff;padding:6px;object-fit:contain" />`
            : `<div style="width:44px;height:44px;border-radius:10px;background:#fff;opacity:.9"></div>`
        }
        <div>
          <div style="font-size:16px;font-weight:800;">Burton Pride C.I.C</div>
          <div style="font-size:13px;opacity:.95;">Windows of Hope Competition 2026</div>
        </div>
      </div>
    </div>
  `;

  const customerSubject = "Payment received — your Windows of Hope entry is confirmed";
  const customerText = `Hi ${entry.contact_name || "there"},
Your payment has been received and your entry for "${entry.business_name || ""}" is confirmed.
If you need help, email us at ${REPLY_TO}.
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

          <p style="margin:0;color:#374151;">Thank you for supporting Burton Pride 🌈</p>
        </div>
        ${footerHtml}
      </div>
    </div>
  `;

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
              : `<p><em>Please check Google Drive for the image. If it isn’t there, please email the customer back to let them know the image is missing.</em></p>`
          }
        </div>
        ${footerHtml}
      </div>
    </div>
  `;

  const headers = {
    "List-Unsubscribe": `<mailto:${REPLY_TO}?subject=unsubscribe>`,
  } as Record<string, string>;

  // ✅ Resend CID attachment (only if we have a logo)
  const attachments =
    logoBase64
      ? [
          {
            filename: "WindowsOfHopeLogoReal.png",
            content: logoBase64,
            contentType: "image/png",
            contentId: "bp-logo", // matches cid:bp-logo
          },
        ]
      : undefined;

  try {
    // Customer email
    if (customerEmail) {
      await resend.emails.send({
        from: FROM,
        to: customerEmail,
        replyTo: REPLY_TO,
        subject: customerSubject,
        text: customerText,
        html: customerHtml,
        headers,
        attachments,
      });
      console.log("✅ Customer email sent to:", customerEmail);
    } else {
      console.warn("⚠️ Customer email missing — skipped customer email send");
    }

    // Admin email
    await resend.emails.send({
      from: FROM,
      to: adminRecipients,
      replyTo: REPLY_TO,
      subject: adminSubject,
      text: adminText,
      html: adminHtml,
      headers,
      attachments,
    });
    console.log("✅ Admin email sent to:", adminRecipients.join(", "));

    // Mark confirmation as sent
    const { error: sentErr } = await db
      .from("competition_entries")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", entryId);

    if (sentErr) console.error("❌ Failed to set confirmation_email_sent_at:", sentErr);
  } catch (err: any) {
    console.error("❌ Email send failed:", err?.message || err);
  }

  return NextResponse.json({ received: true });
}