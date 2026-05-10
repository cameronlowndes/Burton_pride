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

function escapeHtml(value: string | null | undefined) {
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

function safeTicketCount(value: string | number | null | undefined) {
  const n = Number(value || 1);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function raffleTicketEmailHtml({
  fullName,
  email,
  phone,
  ticketNumbers,
  ticketCount,
}: {
  fullName: string;
  email: string;
  phone: string;
  ticketNumbers: number[];
  ticketCount: number;
}) {
  if (!ticketNumbers.length) {
    return `
      <div style="margin:24px 0;padding:20px;border-radius:18px;background:#fff7ed;border:1px solid #fed7aa;text-align:center;">
        <p style="margin:0;font-weight:900;color:#9a3412;">
          Your raffle ticket numbers are being confirmed.
        </p>
      </div>
    `;
  }

  const count = safeTicketCount(ticketCount);
  const ticketLabel = count === 5 ? "BOOK OF 5" : `${count} TICKET${count === 1 ? "" : "S"}`;
  const priceLabel = count === 5 ? "FOR £5.00" : `FOR £${count}.00`;
  const stubPriceLabel = count === 5 ? "BOOK OF 5<br />£5.00" : `${count} TICKET${count === 1 ? "" : "S"}<br />£${count}.00`;

  return ticketNumbers
    .map((number) => {
      const safeNumber = escapeHtml(String(number).padStart(4, "0"));
      const safeName = escapeHtml(fullName || "Supporter");
      const safeEmail = escapeHtml(email || "No email provided");
      const safePhone = escapeHtml(phone || "No phone provided");

      return `
        <div style="
          margin:24px 0;
          border:3px solid #7e22ce;
          border-radius:18px;
          overflow:hidden;
          background:#ffffff;
          color:#111827;
          font-family:Arial, Helvetica, sans-serif;
        ">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
            <tr>
              <td width="34%" style="
                vertical-align:top;
                border-right:2px dashed #111827;
                background:#f8fafc;
              ">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;height:100%;">
                  <tr>
                    <td width="24" style="
                      background:linear-gradient(180deg,#ef4444,#f97316,#facc15,#22c55e,#3b82f6,#7c3aed,#db2777);
                    ">&nbsp;</td>

                    <td style="padding:16px;vertical-align:top;">
                      <p style="
                        margin:0 0 12px;
                        font-size:12px;
                        font-weight:900;
                        letter-spacing:0.12em;
                        color:#111827;
                      ">
                        RAFFLE TICKET STUB
                      </p>

                      <p style="
                        margin:0 0 14px;
                        font-size:11px;
                        font-weight:900;
                        color:#4c1d95;
                      ">
                        BURTON PRIDE C.I.C
                      </p>

                      <div style="border-bottom:1px solid #111827;padding-bottom:8px;margin-bottom:10px;">
                        <p style="margin:0;font-size:10px;font-weight:900;text-transform:uppercase;">Name</p>
                        <p style="margin:2px 0 0;font-size:13px;font-weight:800;word-break:break-word;">${safeName}</p>
                      </div>

                      <div style="border-bottom:1px solid #111827;padding-bottom:8px;margin-bottom:10px;">
                        <p style="margin:0;font-size:10px;font-weight:900;text-transform:uppercase;">Phone</p>
                        <p style="margin:2px 0 0;font-size:13px;font-weight:800;word-break:break-word;">${safePhone}</p>
                      </div>

                      <div style="border-bottom:1px solid #111827;padding-bottom:8px;margin-bottom:14px;">
                        <p style="margin:0;font-size:10px;font-weight:900;text-transform:uppercase;">Email</p>
                        <p style="margin:2px 0 0;font-size:12px;font-weight:800;word-break:break-word;">${safeEmail}</p>
                      </div>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
                        <tr>
                          <td style="vertical-align:bottom;">
                            <p style="
                              margin:0;
                              font-family:'Courier New', monospace;
                              font-size:24px;
                              line-height:1;
                              font-weight:900;
                              letter-spacing:1px;
                              color:#111827;
                            ">
                              ${safeNumber}
                            </p>
                          </td>

                          <td style="vertical-align:bottom;text-align:right;">
                            <p style="
                              margin:0;
                              font-size:10px;
                              line-height:1.2;
                              font-weight:900;
                              text-align:right;
                              color:#111827;
                            ">
                              ${stubPriceLabel}
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>

              <td width="66%" style="
                vertical-align:top;
                background:linear-gradient(90deg,#dc2626,#f97316,#eab308,#16a34a,#2563eb,#7c3aed,#db2777);
                padding:8px;
              ">
                <div style="
                  background:#ffffff;
                  border:1px solid #e5e7eb;
                  padding:18px;
                  min-height:250px;
                ">
                  <div style="text-align:center;">
                    <div style="
                      display:inline-block;
                      width:46px;
                      height:46px;
                      line-height:46px;
                      border-radius:999px;
                      border:2px solid #111827;
                      font-weight:900;
                      color:#7e22ce;
                      margin-bottom:8px;
                    ">
                      BP
                    </div>

                    <h2 style="
                      margin:0;
                      font-size:34px;
                      line-height:1;
                      font-weight:900;
                      letter-spacing:-1px;
                      color:#7e22ce;
                      text-transform:uppercase;
                    ">
                      RAFFLE TICKET
                    </h2>

                    <p style="
                      margin:8px 0 0;
                      font-size:18px;
                      font-weight:900;
                      color:#374151;
                      letter-spacing:1px;
                    ">
                      BURTON PRIDE 2026 RAFFLE
                    </p>
                  </div>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:separate;border-spacing:8px;margin-top:14px;">
                    <tr>
                      <td style="
                        width:33.33%;
                        text-align:center;
                        border:1px solid #111827;
                        background:#f59e0b;
                        padding:10px;
                        color:#111827;
                        border-radius:6px;
                      ">
                        <p style="margin:0;font-size:11px;font-weight:900;">1st PRIZE:</p>
                        <strong style="font-size:30px;">£100</strong>
                      </td>

                      <td style="
                        width:33.33%;
                        text-align:center;
                        border:1px solid #111827;
                        background:#cbd5e1;
                        padding:10px;
                        color:#111827;
                        border-radius:6px;
                      ">
                        <p style="margin:0;font-size:11px;font-weight:900;">2nd PRIZE:</p>
                        <strong style="font-size:30px;">£60</strong>
                      </td>

                      <td style="
                        width:33.33%;
                        text-align:center;
                        border:1px solid #111827;
                        background:#c08457;
                        padding:10px;
                        color:#111827;
                        border-radius:6px;
                      ">
                        <p style="margin:0;font-size:11px;font-weight:900;">3rd PRIZE:</p>
                        <strong style="font-size:30px;">£30</strong>
                      </td>
                    </tr>
                  </table>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin-top:16px;">
                    <tr>
                      <td width="26%" style="
                        vertical-align:top;
                        text-align:center;
                        border:1px solid #e5e7eb;
                        border-radius:10px;
                        background:#ffffff;
                        padding:10px;
                      ">
                        <p style="margin:0;font-size:10px;font-weight:900;">TICKET PRICE:</p>
                        <p style="margin:6px 0 0;font-size:13px;font-weight:900;">${ticketLabel}</p>
                        <p style="margin:2px 0 0;font-size:12px;font-weight:900;">${priceLabel}</p>
                      </td>

                      <td width="52%" style="
                        vertical-align:top;
                        text-align:center;
                        color:#111827;
                        padding:0 12px;
                      ">
                        <p style="margin:0;font-size:13px;font-weight:900;">
                          THE DRAW DATE & LOCATION:
                        </p>

                        <h3 style="
                          margin:4px 0 0;
                          font-size:22px;
                          line-height:1.1;
                          font-weight:900;
                        ">
                          SATURDAY 27th JUNE 2026
                        </h3>

                        <p style="margin:5px 0 0;font-size:12px;font-weight:900;">
                          AT BURTON PRIDE, SHOBNALL LEISURE COMPLEX
                        </p>

                        <p style="
                          margin:4px 0 0;
                          font-size:9px;
                          font-weight:800;
                          color:#374151;
                        ">
                          DRAW AT 4:00 PM | SHOBNALL ROAD, BURTON UPON TRENT, DE14 2BB
                        </p>

                        <p style="
                          margin:6px 0 0;
                          font-size:10px;
                          line-height:1.3;
                          font-weight:900;
                          color:#111827;
                        ">
                          Licensed by East Staffordshire Council under registration number SL0507.
                        </p>
                      </td>

                      <td width="22%" style="
                        vertical-align:bottom;
                        text-align:right;
                      ">
                        <div style="
                          display:inline-block;
                          min-width:88px;
                          border:1px solid #cbd5e1;
                          background:#f8fafc;
                          padding:8px 12px;
                          text-align:center;
                          font-family:'Courier New', monospace;
                          font-size:22px;
                          font-weight:900;
                          letter-spacing:1px;
                          color:#111827;
                        ">
                          ${safeNumber}
                        </div>
                      </td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>
          </table>
        </div>
      `;
    })
    .join("");
}

/**
 * RAFFLE PAYMENT COMPLETE
 * When Stripe confirms checkout.session.completed for raffle,
 * this updates raffle_entries from checkout_started to paid,
 * loads the generated raffle ticket numbers,
 * sends confirmation email to the person,
 * and sends notification email to Burton Pride.
 */
async function handleRaffleSession(session: Stripe.Checkout.Session) {
  try {
    const sessionId = session.id;

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : null;

    if (!sessionId) {
      console.error("Raffle webhook missing session ID");
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("raffle_entries")
      .update({
        status: "paid",
        payment_status: "paid",
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq("stripe_checkout_session_id", sessionId)
      .select("*")
      .single();

    if (error) {
      console.error("Failed to mark raffle entry as paid:", {
        message: error.message,
        details: error,
        sessionId,
        paymentIntentId,
      });
      return;
    }

    console.log("Raffle entry marked as paid:", data);

    const { data: raffleTickets, error: ticketError } = await supabaseAdmin
      .from("raffle_tickets")
      .select("ticket_number")
      .eq("raffle_entry_id", data.id)
      .order("ticket_number", { ascending: true });

    if (ticketError) {
      console.error("Failed to load raffle ticket numbers:", {
        message: ticketError.message,
        details: ticketError,
        raffleEntryId: data.id,
      });
    }

    const ticketNumbers = (raffleTickets || [])
      .map((ticket) => Number(ticket.ticket_number))
      .filter((number) => Number.isFinite(number))
      .sort((a, b) => a - b);

    const ticketNumbersText =
      ticketNumbers.length > 0
        ? ticketNumbers.map((number) => `#${number}`).join(", ")
        : "Ticket numbers are being confirmed";

    const ticketNumbersHtml =
      ticketNumbers.length > 0
        ? ticketNumbers
            .map(
              (number) => `
                <span style="
                  display:inline-block;
                  background:#7c3aed;
                  color:#ffffff;
                  padding:10px 16px;
                  border-radius:999px;
                  font-weight:900;
                  margin:5px;
                  font-size:18px;
                ">
                  #${escapeHtml(String(number))}
                </span>
              `
            )
            .join("")
        : `
            <span style="
              display:inline-block;
              background:#f59e0b;
              color:#111827;
              padding:10px 16px;
              border-radius:999px;
              font-weight:900;
              margin:5px;
              font-size:16px;
            ">
              Ticket numbers are being confirmed
            </span>
          `;

    const fullName = String(data.full_name || "Supporter").trim();
    const email = String(
      data.email || session.customer_details?.email || ""
    ).trim();
    const phone = String(data.phone || "").trim();
    const tickets = safeTicketCount(data.ticket_amount);
    const amount = formatAmount(data.amount_pence || session.amount_total || 0);
    const message = String(data.message || "").trim();

    const safeFullName = escapeHtml(fullName);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone || "No phone provided");
    const safeMessage = escapeHtml(message || "No message provided");
    const safeTickets = escapeHtml(String(tickets));
    const safeAmount = escapeHtml(amount);
    const safeEntryId = escapeHtml(data.id);
    const safeSessionId = escapeHtml(sessionId);
    const safePaymentIntentId = escapeHtml(paymentIntentId || "Not available");
    const safeTicketNumbersText = escapeHtml(ticketNumbersText);

    const digitalTicketHtml = raffleTicketEmailHtml({
      fullName,
      email,
      phone,
      ticketNumbers,
      ticketCount: tickets,
    });

    const FROM =
      process.env.EMAIL_FROM?.trim() ||
      "Burton Pride <noreply@burtonpride.co.uk>";

    const REPLY_TO =
      process.env.EMAIL_REPLY_TO?.trim() || "prideburton@gmail.com";

    const adminList = parseEmailList(process.env.BURTON_PRIDE_NOTIFY_EMAILS)
      .length
      ? parseEmailList(process.env.BURTON_PRIDE_NOTIFY_EMAILS)
      : parseEmailList(process.env.BURTON_PRIDE_NOTIFY_EMAIL);

    const adminRecipients = adminList.length
      ? adminList
      : ["info@burtonpride.co.uk", "prideburton@gmail.com"];

    const emailHeaders = {
      "List-Unsubscribe": `<mailto:${REPLY_TO}?subject=unsubscribe>`,
    } as Record<string, string>;

    if (email) {
      await resend.emails.send({
        from: FROM,
        to: email,
        replyTo: REPLY_TO,
        subject: "Your Burton Pride raffle ticket numbers",
        headers: emailHeaders,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.7; color: #111827; max-width: 760px; margin: 0 auto;">
            <div style="padding: 32px 24px; background: linear-gradient(135deg, #db2777, #a21caf, #2563eb); color: white; border-radius: 20px 20px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">You Are In The Raffle</h1>
              <p style="margin: 12px 0 0; font-size: 16px; opacity: 0.95;">
                Burton Pride C.I.C
              </p>
            </div>

            <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 20px 20px; padding: 32px 24px;">
              <p style="margin-top: 0;">Hi ${safeFullName},</p>

              <p>
                Thank you for entering the Burton Pride raffle. Your payment has been received and your raffle entry is now confirmed.
              </p>

              <div style="background: #f3e8ff; border: 1px solid #d8b4fe; border-radius: 16px; padding: 22px; margin: 22px 0; text-align: center;">
                <p style="margin: 0 0 10px; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.14em; color: #6b21a8;">
                  Your raffle ticket number${ticketNumbers.length === 1 ? "" : "s"}
                </p>

                <div style="margin-top: 12px;">
                  ${ticketNumbersHtml}
                </div>

                <p style="margin: 16px 0 0; font-size: 13px; color: #4b5563;">
                  Please keep ${
                    ticketNumbers.length === 1 ? "this number" : "these numbers"
                  } safe for the raffle draw.
                </p>
              </div>

              <div style="margin: 26px 0 10px;">
                <p style="margin: 0 0 10px; font-size: 18px; font-weight: 900; color: #111827;">
                  Your digital raffle ticket
                </p>
                <p style="margin: 0 0 16px; color: #4b5563; font-size: 14px;">
                  This is a digital copy for you to view. You do not need to print it.
                </p>
              </div>

              ${digitalTicketHtml}

              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 16px; padding: 18px; margin: 22px 0;">
                <p style="margin: 0 0 8px;"><strong>Name:</strong> ${safeFullName}</p>
                <p style="margin: 0 0 8px;"><strong>Tickets bought:</strong> ${safeTickets}</p>
                <p style="margin: 0 0 8px;"><strong>Ticket number${ticketNumbers.length === 1 ? "" : "s"}:</strong> ${safeTicketNumbersText}</p>
                <p style="margin: 0 0 8px;"><strong>Amount paid:</strong> £${safeAmount}</p>
                <p style="margin: 0;"><strong>Entry reference:</strong> ${safeEntryId}</p>
              </div>

              <p>
                Winning tickets will be announced at Burton Pride 2026 on <strong>27th June 2026</strong>.
                Winners will be contacted using the details provided when entering.
              </p>

              <p>
                Burton Pride C.I.C may request proof of age, identity, or eligibility before confirming a winner or releasing a prize.
              </p>

              <p>
                Every ticket helps us keep Burton Pride community-led, grassroots, and created by the community, for the community.
              </p>

              <p>
                Good luck, and thank you for supporting Burton Pride.
              </p>

              <p style="margin-bottom: 0;">
                Kind regards,<br />
                <strong>Burton Pride C.I.C</strong>
              </p>
            </div>
          </div>
        `,
        text: `Hi ${fullName},

Thank you for entering the Burton Pride raffle. Your payment has been received and your raffle entry is now confirmed.

Your raffle ticket number${ticketNumbers.length === 1 ? "" : "s"}:
${ticketNumbersText}

Name: ${fullName}
Tickets bought: ${tickets}
Amount paid: £${amount}
Entry reference: ${data.id}

Winning tickets will be announced at Burton Pride 2026 on 27th June 2026.

Burton Pride C.I.C may request proof of age, identity, or eligibility before confirming a winner or releasing a prize.

Every ticket helps us keep Burton Pride community-led, grassroots, and created by the community, for the community.

Good luck, and thank you for supporting Burton Pride.

Kind regards,
Burton Pride C.I.C`,
      });

      console.log("Raffle confirmation email sent to:", email);
    }

    await resend.emails.send({
      from: FROM,
      to: adminRecipients,
      replyTo: REPLY_TO,
      subject: `New raffle entry received - ${fullName}`,
      headers: emailHeaders,
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.7; color: #111827; max-width: 700px; margin: 0 auto;">
          <div style="padding: 24px; background: #111827; color: white; border-radius: 20px 20px 0 0;">
            <h2 style="margin: 0;">New Burton Pride Raffle Entry</h2>
          </div>

          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 20px 20px; padding: 24px;">
            <p>A new paid raffle entry has been confirmed by Stripe.</p>

            <div style="background: #f3e8ff; border: 1px solid #d8b4fe; border-radius: 16px; padding: 18px; margin: 18px 0; text-align: center;">
              <p style="margin: 0 0 10px; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.14em; color: #6b21a8;">
                Raffle ticket number${ticketNumbers.length === 1 ? "" : "s"}
              </p>

              <div style="margin-top: 10px;">
                ${ticketNumbersHtml}
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
              <tr>
                <td style="border: 1px solid #e5e7eb; padding: 10px;"><strong>Name</strong></td>
                <td style="border: 1px solid #e5e7eb; padding: 10px;">${safeFullName}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #e5e7eb; padding: 10px;"><strong>Email</strong></td>
                <td style="border: 1px solid #e5e7eb; padding: 10px;">${safeEmail || "No email provided"}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #e5e7eb; padding: 10px;"><strong>Phone</strong></td>
                <td style="border: 1px solid #e5e7eb; padding: 10px;">${safePhone}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #e5e7eb; padding: 10px;"><strong>Tickets bought</strong></td>
                <td style="border: 1px solid #e5e7eb; padding: 10px;">${safeTickets}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #e5e7eb; padding: 10px;"><strong>Ticket number${ticketNumbers.length === 1 ? "" : "s"}</strong></td>
                <td style="border: 1px solid #e5e7eb; padding: 10px;">${safeTicketNumbersText}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #e5e7eb; padding: 10px;"><strong>Amount</strong></td>
                <td style="border: 1px solid #e5e7eb; padding: 10px;">£${safeAmount}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #e5e7eb; padding: 10px;"><strong>Message</strong></td>
                <td style="border: 1px solid #e5e7eb; padding: 10px;">${safeMessage}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #e5e7eb; padding: 10px;"><strong>Entry ID</strong></td>
                <td style="border: 1px solid #e5e7eb; padding: 10px;">${safeEntryId}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #e5e7eb; padding: 10px;"><strong>Stripe Session</strong></td>
                <td style="border: 1px solid #e5e7eb; padding: 10px;">${safeSessionId}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #e5e7eb; padding: 10px;"><strong>Payment Intent</strong></td>
                <td style="border: 1px solid #e5e7eb; padding: 10px;">${safePaymentIntentId}</td>
              </tr>
            </table>
          </div>
        </div>
      `,
      text: `New Burton Pride raffle entry

Name: ${fullName}
Email: ${email || "No email provided"}
Phone: ${phone || "No phone provided"}
Tickets bought: ${tickets}
Ticket number${ticketNumbers.length === 1 ? "" : "s"}: ${ticketNumbersText}
Amount: £${amount}
Message: ${message || "No message provided"}
Entry ID: ${data.id}
Stripe Session: ${sessionId}
Payment Intent: ${paymentIntentId || "Not available"}`,
    });

    console.log("Raffle admin notification email sent to:", adminRecipients);
  } catch (error) {
    console.error("Raffle webhook update/email failed:", error);
  }
}

/**
 * Adds completed website donations into the Money Tracker.
 */
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
      session.payment_status ? `Payment status: ${session.payment_status}` : "",
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

/**
 * Adds future monthly Stripe subscription payments into the Money Tracker.
 */
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
      invoice.billing_reason ? `Billing reason: ${invoice.billing_reason}` : "",
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
    const amountPence = paymentIntent.amount_received || paymentIntent.amount || 0;

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
      stripePaymentIntentId ? `Stripe payment intent: ${stripePaymentIntentId}` : "",
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

  const adminList = parseEmailList(process.env.BURTON_PRIDE_NOTIFY_EMAILS)
    .length
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

      console.log("Checkout session completed:", {
        id: session.id,
        source: session.metadata?.source,
        payment_status: session.payment_status,
      });

      if (session.metadata?.source === "website_raffle") {
        await handleRaffleSession(session);
      } else if (session.metadata?.entryId) {
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
