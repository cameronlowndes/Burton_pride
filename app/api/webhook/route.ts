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

function parseEmailList(value: string | undefined) {
  const raw = (value || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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

function loadQrBase64() {
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "PosterPicturePng",
      "WindowsOfHopeQR.png"
    );

    if (!fs.existsSync(filePath)) {
      console.error("❌ QR image not found at:", filePath);
      return "";
    }

    return fs.readFileSync(filePath).toString("base64");
  } catch (e: any) {
    console.error("❌ Failed to read QR image:", e?.message || e);
    return "";
  }
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

  if (entry.confirmation_email_sent_at) {
    return NextResponse.json({ received: true });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("❌ Missing RESEND_API_KEY");
    return NextResponse.json({ received: true });
  }

  const resend = new Resend(resendKey);

  const FROM = process.env.EMAIL_FROM?.trim() || "Burton Pride <noreply@burtonpride.co.uk>";
  const REPLY_TO = process.env.EMAIL_REPLY_TO?.trim() || "prideburton@gmail.com";

  const adminList = parseEmailList(process.env.BURTON_PRIDE_NOTIFY_EMAILS).length
    ? parseEmailList(process.env.BURTON_PRIDE_NOTIFY_EMAILS)
    : parseEmailList(process.env.BURTON_PRIDE_NOTIFY_EMAIL);

  const adminRecipients = adminList.length ? adminList : ["prideburton@gmail.com"];

  const customerEmail = String(entry.email || sessionEmail || "")
    .trim()
    .toLowerCase();

  const imageUrl = drivePreviewUrl(entry.image_url || "");
  const siteUrl = getSiteUrl(req);
  const cleanSiteUrl = siteUrl.replace(/\/+$/, "");
  const voteUrl = cleanSiteUrl ? `${cleanSiteUrl}/Competition/vote` : "";
  const qrBase64 = loadQrBase64();

  const safeBusiness = escapeHtml(entry.business_name || "");
  const safeContact = escapeHtml(entry.contact_name || "");
  const safeEmail = escapeHtml(entry.email || "");
  const safePhone = escapeHtml(entry.phone || "");
  const safeAddress = escapeHtml(entry.address || "");
  const safeWebsite = escapeHtml(entry.website || "");
  const safeVoteUrl = escapeHtml(voteUrl);

  const footerHtml = `
    <div style="padding:14px 20px;background:#f9fafb;color:#6b7280;font-size:12px;border-top:1px solid #eef2f7;">
      Burton Pride C.I.C • Burton-on-Trent<br/>
      If you need help, email us at ${escapeHtml(REPLY_TO)}.
    </div>
  `;

  const headerHtml = `
    <div style="padding:18px 20px;background:linear-gradient(90deg,#ec4899,#8b5cf6,#3b82f6);color:#fff;">
      <div>
        <div style="font-size:16px;font-weight:800;">Burton Pride C.I.C</div>
        <div style="font-size:13px;opacity:.95;">Windows of Hope Competition 2026</div>
      </div>
    </div>
  `;

  const customerSubject = "Payment received — your Windows of Hope entry is confirmed";
  const customerText = `Hi ${entry.contact_name || "there"},

Your payment has been received and your entry for "${entry.business_name || ""}" is confirmed.

Your uploaded window photo is shown below.
Please display the QR poster so people can vote for your window.

Vote here:
${voteUrl || "Competition voting page"}

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

          ${
            imageUrl
              ? `
                <div style="margin:18px 0;">
                  <div style="font-size:16px;font-weight:700;margin:0 0 10px;">This is your window photo</div>
                  <p style="margin:0 0 12px;color:#374151;">
                    Please check this is the image you want displayed for the competition.
                  </p>
                  <img
                    src="${imageUrl}"
                    alt="Your uploaded window photo"
                    style="display:block;width:100%;max-width:100%;border-radius:12px;border:1px solid #e5e7eb;"
                  />
                </div>
              `
              : `
                <div style="margin:18px 0;padding:14px;background:#fff7ed;border:1px solid #fdba74;border-radius:12px;color:#9a3412;">
                  We could not display your image in this email. If your image is missing, please reply to this email.
                </div>
              `
          }

          ${
            qrBase64
              ? `
                <div style="margin:20px 0;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;text-align:center;">
                  <div style="font-size:16px;font-weight:700;margin-bottom:10px;">
                    Display this QR code so people can vote for your window
                  </div>

                  <p style="margin:0 0 14px;color:#374151;">
                    Print this poster or display it in your window so visitors can scan and vote.
                  </p>

                  <img
                    src="cid:windows-hope-qr"
                    alt="Windows of Hope Voting QR Code"
                    style="max-width:260px;width:100%;border-radius:12px;border:1px solid #e5e7eb;"
                  />

                  <div style="margin-top:10px;font-size:12px;color:#6b7280;">
                    Scan to vote in the Windows of Hope competition
                  </div>
                </div>
              `
              : `
                <div style="margin:20px 0;padding:14px;background:#fff7ed;border:1px solid #fdba74;border-radius:12px;color:#9a3412;">
                  We could not attach the QR poster image to this email.
                </div>
              `
          }

          ${
            voteUrl
              ? `
                <div style="margin:18px 0;padding:16px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:12px;">
                  <div style="font-size:16px;font-weight:700;margin:0 0 8px;">People can vote for your window</div>
                  <p style="margin:0 0 12px;color:#374151;">
                    Please share the competition voting page so people can vote for your window.
                  </p>
                  <a
                    href="${safeVoteUrl}"
                    style="display:inline-block;padding:12px 18px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;"
                  >
                    Vote for your favourite window
                  </a>
                  <div style="margin-top:10px;font-size:12px;color:#6b7280;word-break:break-all;">
                    ${safeVoteUrl}
                  </div>
                </div>
              `
              : ""
          }

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

  const qrAttachment = qrBase64
    ? [
        {
          filename: "WindowsOfHopeQR.png",
          content: qrBase64,
          contentType: "image/png",
          contentId: "windows-hope-qr",
        },
      ]
    : undefined;

  try {
    if (customerEmail) {
      await resend.emails.send({
        from: FROM,
        to: customerEmail,
        replyTo: REPLY_TO,
        subject: customerSubject,
        text: customerText,
        html: customerHtml,
        headers,
        attachments: qrAttachment,
      });
      console.log("✅ Customer email sent to:", customerEmail);
    } else {
      console.warn("⚠️ Customer email missing — skipped customer email send");
    }

    await resend.emails.send({
      from: FROM,
      to: adminRecipients,
      replyTo: REPLY_TO,
      subject: adminSubject,
      text: adminText,
      html: adminHtml,
      headers,
    });
    console.log("✅ Admin email sent to:", adminRecipients.join(", "));

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