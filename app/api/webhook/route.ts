import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16" as any,
});

const resend = new Resend(process.env.RESEND_API_KEY!);

function formatAmount(amount?: number | null) {
  return ((amount || 0) / 100).toFixed(2);
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function drivePreviewUrl(url: string) {
  const u = String(url || "").trim();
  if (!u) return "";
  if (u.includes("drive.google.com/uc?")) return u;
  const m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (m?.[1]) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  return u;
}

function driveDownloadUrl(url: string) {
  const u = String(url || "").trim();
  if (!u) return "";
  const m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (m?.[1]) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
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

async function addDonationSessionToMoneyTracker(
  session: Stripe.Checkout.Session
) {
  try {
    const stripeSessionId = session.id;
    const amountPence = session.amount_total || 0;

    if (!stripeSessionId || amountPence <= 0) {
      console.log("Skipped checkout money tracker insert: missing amount/session");
      return;
    }

    const donorName =
      session.metadata?.fullName?.trim() ||
      session.customer_details?.name?.trim() ||
      "Supporter";

    const donorEmail =
      session.customer_details?.email?.trim() ||
      session.metadata?.email?.trim() ||
      "";

    const donorMessage = session.metadata?.message?.trim() || "";

    const donationType =
      session.mode === "subscription"
        ? "Monthly donation"
        : "One-time donation";

    const descriptionParts = [
      donorEmail ? `Email: ${donorEmail}` : "",
      donorMessage ? `Message: ${donorMessage}` : "",
      session.payment_status
        ? `Payment status: ${session.payment_status}`
        : "",
      session.mode ? `Stripe mode: ${session.mode}` : "",
      stripeSessionId ? `Stripe session: ${stripeSessionId}` : "",
    ].filter(Boolean);

    const stripeInvoiceId =
      typeof session.invoice === "string" ? session.invoice : null;

    const stripeCustomerId =
      typeof session.customer === "string" ? session.customer : null;

    const stripePaymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : null;

    const transactionDate = session.created
      ? new Date(session.created * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const { error } = await supabaseAdmin.from("money_transactions").upsert(
      {
        title: `${donationType} - ${donorName}`,
        description: descriptionParts.join("\n") || null,
        type: "income",
        category: "Donation",
        amount_pence: amountPence,
        payment_method: "Stripe",
        transaction_date: transactionDate,
        stripe_session_id: stripeSessionId,
        stripe_invoice_id: stripeInvoiceId,
        stripe_customer_id: stripeCustomerId,
        stripe_payment_intent_id: stripePaymentIntentId,
        source: "website_donation",
      },
      {
        onConflict: "stripe_session_id",
      }
    );

    if (error) {
      console.error("Failed to add checkout donation to money tracker:", {
        message: error.message,
        details: error,
        sessionId: stripeSessionId,
        amount: amountPence,
      });
      return;
    }

    console.log("Added checkout donation to money tracker:", stripeSessionId);
  } catch (error) {
    console.error("Money tracker checkout donation insert failed:", error);
  }
}

async function addPaidInvoiceToMoneyTracker(invoice: Stripe.Invoice) {
  try {
    const invoiceAny = invoice as any;

    if (invoice.billing_reason === "subscription_create") {
      console.log("Skipped invoice.paid because checkout session records first subscription payment");
      return;
    }

    const stripeInvoiceId = invoice.id;
    const amountPence = invoice.amount_paid || 0;

    if (!stripeInvoiceId || amountPence <= 0) {
      console.log("Skipped invoice money tracker insert: missing amount/invoice");
      return;
    }

    const stripeCustomerId =
      typeof invoice.customer === "string" ? invoice.customer : null;

    const donorEmail =
      invoice.customer_email?.trim() ||
      invoiceAny.customer_details?.email?.trim() ||
      "";

    const donorName =
      invoice.customer_name?.trim() ||
      invoiceAny.customer_details?.name?.trim() ||
      "Monthly supporter";

    const transactionDate = invoice.created
      ? new Date(invoice.created * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const descriptionParts = [
      donorEmail ? `Email: ${donorEmail}` : "",
      invoice.number ? `Invoice number: ${invoice.number}` : "",
      invoice.billing_reason
        ? `Billing reason: ${invoice.billing_reason}`
        : "",
      stripeInvoiceId ? `Stripe invoice: ${stripeInvoiceId}` : "",
    ].filter(Boolean);

    const { error } = await supabaseAdmin.from("money_transactions").upsert(
      {
        title: `Monthly donation - ${donorName}`,
        description: descriptionParts.join("\n") || null,
        type: "income",
        category: "Donation",
        amount_pence: amountPence,
        payment_method: "Stripe",
        transaction_date: transactionDate,
        stripe_invoice_id: stripeInvoiceId,
        stripe_customer_id: stripeCustomerId,
        source: "website_monthly_donation",
      },
      {
        onConflict: "stripe_invoice_id",
      }
    );

    if (error) {
      console.error("Failed to add paid invoice to money tracker:", {
        message: error.message,
        details: error,
        invoiceId: stripeInvoiceId,
        amount: amountPence,
      });
      return;
    }

    console.log("Added paid invoice to money tracker:", stripeInvoiceId);
  } catch (error) {
    console.error("Money tracker invoice insert failed:", error);
  }
}

async function addPaymentIntentToMoneyTracker(
  paymentIntent: Stripe.PaymentIntent
) {
  try {
    const stripePaymentIntentId = paymentIntent.id;
    const amountPence =
      paymentIntent.amount_received || paymentIntent.amount || 0;

    if (!stripePaymentIntentId || amountPence <= 0) {
      console.log("Skipped payment intent money tracker insert: missing amount/payment intent");
      return;
    }

    const donorEmail =
      paymentIntent.receipt_email?.trim() ||
      String(paymentIntent.metadata?.email || "").trim();

    const donorName =
      String(paymentIntent.metadata?.fullName || "").trim() ||
      String(paymentIntent.metadata?.name || "").trim() ||
      "Website donation";

    const donorMessage = String(paymentIntent.metadata?.message || "").trim();

    const descriptionParts = [
      donorEmail ? `Email: ${donorEmail}` : "",
      donorMessage ? `Message: ${donorMessage}` : "",
      paymentIntent.status ? `Payment status: ${paymentIntent.status}` : "",
      stripePaymentIntentId
        ? `Stripe payment intent: ${stripePaymentIntentId}`
        : "",
    ].filter(Boolean);

    const transactionDate = paymentIntent.created
      ? new Date(paymentIntent.created * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const { error } = await supabaseAdmin.from("money_transactions").upsert(
      {
        title: `Website donation - ${donorName}`,
        description: descriptionParts.join("\n") || null,
        type: "income",
        category: "Donation",
        amount_pence: amountPence,
        payment_method: "Stripe",
        transaction_date: transactionDate,
        stripe_payment_intent_id: stripePaymentIntentId,
        stripe_customer_id:
          typeof paymentIntent.customer === "string"
            ? paymentIntent.customer
            : null,
        source: "website_donation",
      },
      {
        onConflict: "stripe_payment_intent_id",
      }
    );

    if (error) {
      console.error("Failed to add PaymentIntent to money tracker:", {
        message: error.message,
        details: error,
        paymentIntentId: stripePaymentIntentId,
        amount: amountPence,
      });
      return;
    }

    console.log("Added payment intent to money tracker:", stripePaymentIntentId);
  } catch (error) {
    console.error("Money tracker PaymentIntent insert failed:", error);
  }
}

async function handleDonationSession(session: Stripe.Checkout.Session) {
  const donorName = session.metadata?.fullName?.trim() || "Supporter";
  const donorEmail =
    session.customer_details?.email?.trim() ||
    session.metadata?.email?.trim() ||
    "";
  const donorMessage = session.metadata?.message?.trim() || "";
  const donationAmount = formatAmount(session.amount_total);

  const safeDonorName = escapeHtml(donorName);
  const safeDonorEmail = escapeHtml(donorEmail);
  const safeDonorMessage = escapeHtml(donorMessage);

  const donationNotifyRecipients = [
    "info@burtonpride.co.uk",
    "prideburton@gmail.com",
  ];

  if (donorEmail) {
    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: donorEmail,
      subject: "Thank you for supporting Burton Pride C.I.C",
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.7; color: #111827; max-width: 640px; margin: 0 auto;">
          <div style="padding: 32px 24px; background: linear-gradient(135deg, #db2777, #a21caf, #2563eb); color: white; border-radius: 20px 20px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">Thank You For Your Donation</h1>
            <p style="margin: 12px 0 0; font-size: 16px; opacity: 0.95;">
              Burton Pride C.I.C
            </p>
          </div>

          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 20px 20px; padding: 32px 24px;">
            <p style="margin-top: 0;">Hi ${safeDonorName},</p>

            <p>
              Thank you so much for your donation of <strong>£${donationAmount}</strong> to Burton Pride C.I.C.
            </p>

            <p>
              Burton Pride is a grassroots, community-led organisation built by local people, for local people.
              Every donation helps us continue creating inclusive events, safer spaces, stronger visibility,
              accessibility support, and meaningful opportunities for the LGBTQIA+ community and allies in Burton on Trent.
            </p>

            <p>
              As a Community Interest Company, our focus is always on community impact. Your support helps us keep building
              something real, welcoming, and rooted in pride, care, and togetherness.
            </p>

            <p>
              Your kindness truly makes a difference, and we are very grateful for your support.
            </p>

            <p style="margin-bottom: 0;">
              With heartfelt thanks,<br />
              <strong>Burton Pride C.I.C</strong>
            </p>
          </div>
        </div>
      `,
      text: `Hi ${donorName},

Thank you so much for your donation of £${donationAmount} to Burton Pride C.I.C.

Your support helps us continue creating inclusive events, safer spaces, and meaningful opportunities for the LGBTQIA+ community and allies in Burton on Trent.

With heartfelt thanks,
Burton Pride C.I.C`,
    });
  }

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: donationNotifyRecipients,
    subject: `New donation received - £${donationAmount}`,
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.7; color: #111827; max-width: 640px; margin: 0 auto;">
        <div style="padding: 24px; background: #111827; color: white; border-radius: 20px 20px 0 0;">
          <h2 style="margin: 0;">New Burton Pride Donation</h2>
        </div>

        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 20px 20px; padding: 24px;">
          <p><strong>Name:</strong> ${safeDonorName}</p>
          <p><strong>Email:</strong> ${safeDonorEmail || "No email provided"}</p>
          <p><strong>Amount:</strong> £${donationAmount}</p>
          <p><strong>Stripe Session ID:</strong> ${escapeHtml(session.id)}</p>
          <p><strong>Payment Status:</strong> ${escapeHtml(session.payment_status || "unknown")}</p>
          <p><strong>Message:</strong><br />${safeDonorMessage || "No message provided"}</p>
        </div>
      </div>
    `,
    text: `New Burton Pride donation

Name: ${donorName}
Email: ${donorEmail || "No email provided"}
Amount: £${donationAmount}
Stripe Session ID: ${session.id}
Payment Status: ${session.payment_status || "unknown"}
Message: ${donorMessage || "No message provided"}`,
  });
}

async function handleCompetitionSession(session: Stripe.Checkout.Session) {
  let entryId = session.metadata?.entryId;

  if (!entryId && session.payment_intent) {
    try {
      const pi = await stripe.paymentIntents.retrieve(
        session.payment_intent as string
      );
      entryId = pi.metadata?.entryId;
    } catch (e: any) {
      console.error("Failed to retrieve PaymentIntent:", e?.message || e);
    }
  }

  if (!entryId) {
    return;
  }

  const db = supabaseAdmin;

  const { error: paidErr } = await db
    .from("competition_entries")
    .update({ payment_status: "paid" })
    .eq("id", entryId);

  if (paidErr) {
    console.error("Failed to update payment_status:", paidErr);
  }

  const { data: entry, error: entryError } = await db
    .from("competition_entries")
    .select(
      "id, business_name, contact_name, email, phone, address, website, image_url, confirmation_email_sent_at"
    )
    .eq("id", entryId)
    .single();

  if (entryError || !entry) {
    console.error("Could not load entry:", entryError);
    return;
  }

  if (entry.confirmation_email_sent_at) {
    return;
  }

  const FROM =
    process.env.EMAIL_FROM?.trim() ||
    "Burton Pride <noreply@burtonpride.co.uk>";
  const REPLY_TO =
    process.env.EMAIL_REPLY_TO?.trim() || "prideburton@gmail.com";

  const adminList = parseEmailList(process.env.BURTON_PRIDE_NOTIFY_EMAILS).length
    ? parseEmailList(process.env.BURTON_PRIDE_NOTIFY_EMAILS)
    : parseEmailList(process.env.BURTON_PRIDE_NOTIFY_EMAIL);

  const adminRecipients = adminList.length
    ? adminList
    : ["prideburton@gmail.com"];

  const customerEmail = String(
    entry.email || session.customer_details?.email || session.customer_email || ""
  )
    .trim()
    .toLowerCase();

  const rawImageUrl = String(entry.image_url || "").trim();
  const imageUrl = drivePreviewUrl(rawImageUrl);
  const imageDownloadUrl = driveDownloadUrl(rawImageUrl);

  const voteUrl = "https://burtonpride.co.uk/Competition/Vote";

  const rawQrImageUrl =
    "https://drive.google.com/file/d/1YrBOAbYH2NpLpE3qDCJGMRNovrvcQ8l_/view?usp=drive_link";
  const qrDownloadUrl = driveDownloadUrl(rawQrImageUrl);

  const safeBusiness = escapeHtml(entry.business_name || "");
  const safeContact = escapeHtml(entry.contact_name || "");
  const safeEmail = escapeHtml(entry.email || "");
  const safePhone = escapeHtml(entry.phone || "");
  const safeAddress = escapeHtml(entry.address || "");
  const safeWebsite = escapeHtml(entry.website || "");
  const safeVoteUrl = escapeHtml(voteUrl);
  const safeImageDownloadUrl = escapeHtml(imageDownloadUrl);
  const safeQrDownloadUrl = escapeHtml(qrDownloadUrl);

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

  const customerSubject =
    "Payment received — your Windows of Hope entry is confirmed";

  const customerText = `Hi ${entry.contact_name || "there"},

Your payment has been received and your entry for "${entry.business_name || ""}" is confirmed.

Download your window photo:
${imageDownloadUrl || "Image download link unavailable"}

Download the QR poster:
${qrDownloadUrl || "QR download link unavailable"}

Vote here:
${voteUrl}

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
                  ${
                    imageDownloadUrl
                      ? `
                        <div style="margin-top:14px;text-align:center;">
                          <a
                            href="${safeImageDownloadUrl}"
                            style="display:inline-block;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;"
                          >
                            Download your window photo
                          </a>
                        </div>
                      `
                      : ""
                  }
                </div>
              `
              : `
                <div style="margin:18px 0;padding:14px;background:#fff7ed;border:1px solid #fdba74;border-radius:12px;color:#9a3412;">
                  We could not display your image in this email. If your image is missing, please reply to this email.
                </div>
              `
          }

          <div style="margin:20px 0;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;text-align:center;">
            <div style="font-size:16px;font-weight:700;margin-bottom:10px;">
              Download your QR poster for voting
            </div>

            <p style="margin:0 0 14px;color:#374151;">
              Use this button to download the QR poster from Google Drive, then print it or display it in your window.
            </p>

            ${
              qrDownloadUrl
                ? `
                  <a
                    href="${safeQrDownloadUrl}"
                    style="display:inline-block;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;"
                  >
                    Download QR poster
                  </a>
                `
                : ""
            }
          </div>

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
Photo: ${imageUrl || "none"}
Download photo: ${imageDownloadUrl || "none"}
Download QR poster: ${qrDownloadUrl || "none"}`;

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
                <div style="margin-top:12px;">
                  <a
                    href="${safeImageDownloadUrl}"
                    style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;"
                  >
                    Download photo
                  </a>
                </div>
                <div style="margin-top:8px;font-size:12px;">
                  <a href="${imageUrl}">Open photo</a>
                </div>
              `
              : `<p><em>Please check Google Drive for the image. If it isn’t there, please email the customer back to let them know the image is missing.</em></p>`
          }

          ${
            qrDownloadUrl
              ? `
                <div style="margin-top:18px;">
                  <a
                    href="${safeQrDownloadUrl}"
                    style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;"
                  >
                    Download QR poster
                  </a>
                </div>
              `
              : ""
          }
        </div>
        ${footerHtml}
      </div>
    </div>
  `;

  const emailHeaders = {
    "List-Unsubscribe": `<mailto:${REPLY_TO}?subject=unsubscribe>`,
  } as Record<string, string>;

  try {
    if (customerEmail) {
      await resend.emails.send({
        from: FROM,
        to: customerEmail,
        replyTo: REPLY_TO,
        subject: customerSubject,
        text: customerText,
        html: customerHtml,
        headers: emailHeaders,
      });
      console.log("Customer email sent to:", customerEmail);
    }

    await resend.emails.send({
      from: FROM,
      to: adminRecipients,
      replyTo: REPLY_TO,
      subject: adminSubject,
      text: adminText,
      html: adminHtml,
      headers: emailHeaders,
    });

    const { error: sentErr } = await db
      .from("competition_entries")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", entryId);

    if (sentErr) {
      console.error("Failed to set confirmation_email_sent_at:", sentErr);
    }
  } catch (err: any) {
    console.error("Competition email send failed:", err?.message || err);
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return new NextResponse("Missing Stripe signature", { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return new NextResponse("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("Stripe webhook signature error:", error);
    return new NextResponse("Invalid webhook signature", { status: 400 });
  }

  try {
    console.log("Stripe webhook received:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log("Checkout session completed:", session.id);

      if (session.metadata?.entryId) {
        await handleCompetitionSession(session);
      } else {
        await handleDonationSession(session);
        await addDonationSessionToMoneyTracker(session);
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;

      console.log("Invoice paid:", invoice.id);

      await addPaidInvoiceToMoneyTracker(invoice);
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      console.log("Payment intent succeeded:", paymentIntent.id);

      await addPaymentIntentToMoneyTracker(paymentIntent);
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("Stripe webhook handler error:", error);
    return new NextResponse("Webhook handler failed", { status: 500 });
  }
}