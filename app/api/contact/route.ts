import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

const BURTON_EMAIL = "prideburton@gmail.com";
const INFO_EMAIL = "info@burtonpride.co.uk";

function escapeHtml(value: string) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim();
    const subject = String(body?.subject || "").trim();
    const message = String(body?.message || "").trim();

    if (!name || !email || !message) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Save message in database
    const { error: insertError } = await supabaseAdmin.from("contact_messages").insert([
      {
        name,
        email,
        subject: subject || null,
        message,
        status: "new",
        is_read: false,
      },
    ]);

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return NextResponse.json(
        { ok: false, error: "Failed to save message" },
        { status: 500 }
      );
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject || "Website Contact");
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

    const fromEmail =
      process.env.CONTACT_FROM_EMAIL || "noreply@burtonpride.co.uk";

    /*
      USER CONFIRMATION EMAIL
    */
    const { error: userEmailError } = await resend.emails.send({
      from: `Burton Pride <${fromEmail}>`,
      to: email,
      replyTo: INFO_EMAIL,
      subject: "We’ve received your message",
      html: `
        <div style="background:#f6f1fb;padding:40px 20px;font-family:Arial,Helvetica,sans-serif;">
          <table role="presentation" width="100%" style="max-width:640px;margin:auto;background:#ffffff;border-radius:14px;border:1px solid #eadcf7;">
            <tr>
              <td style="padding:28px;background:linear-gradient(135deg,#c73fcf,#8b5cf6);border-top-left-radius:14px;border-top-right-radius:14px;">
                <h1 style="margin:0;color:#ffffff;font-size:24px;">Burton Pride</h1>
                <p style="margin:6px 0 0;color:#f3e8ff;">We’ve received your message</p>
              </td>
            </tr>

            <tr>
              <td style="padding:32px;color:#1f2937;font-size:16px;line-height:24px;">
                <p>Hello ${safeName},</p>

                <p>
                  Thank you for contacting Burton Pride.
                  This email confirms that we have received your message.
                </p>

                <p>
                  A member of our team will respond within
                  <strong>2 working days</strong>.
                </p>

                <p style="margin-top:24px;">
                  If you need to update your message, simply reply to ${INFO_EMAIL}
                </p>

                <p style="margin-top:32px;">
                  Kind regards,<br>
                  <strong>Burton Pride C.I.C</strong>
                </p>
              </td>
            </tr>
          </table>
        </div>
      `,
    });

    if (userEmailError) {
      console.error("User email error:", userEmailError);
    }

    /*
      ADMIN EMAIL
      Send to BOTH prideburton@gmail.com and info@burtonpride.co.uk
    */
    const { error: adminEmailError } = await resend.emails.send({
      from: `Burton Pride Website <${fromEmail}>`,
      to: [BURTON_EMAIL, INFO_EMAIL],
      replyTo: email,
      subject: `New Website Contact: ${safeSubject}`,
      html: `
        <div style="margin:0;padding:24px;background-color:#f6f1fb;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
            style="max-width:680px;margin:0 auto;border-collapse:collapse;background:#ffffff;border:1px solid #eadcf7;border-radius:16px;overflow:hidden;">

            <tr>
              <td style="padding:24px 28px;background:linear-gradient(135deg,#c73fcf,#8b5cf6);">
                <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#f5eefe;">
                  Burton Pride Website
                </p>
                <h1 style="margin:8px 0 0 0;font-size:26px;color:#ffffff;">
                  New Contact Message
                </h1>
                <p style="margin:10px 0 0 0;font-size:14px;color:#f3e8ff;">
                  A new message has been submitted through the website contact form.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:28px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">

                <table width="100%" style="border:1px solid #eadcf7;border-radius:12px;background:#faf7fd;">
                  <tr>
                    <td style="padding:12px 16px;border-bottom:1px solid #eadcf7;font-weight:bold;width:140px;">
                      Name
                    </td>
                    <td style="padding:12px 16px;border-bottom:1px solid #eadcf7;">
                      ${safeName}
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:12px 16px;border-bottom:1px solid #eadcf7;font-weight:bold;">
                      Email
                    </td>
                    <td style="padding:12px 16px;border-bottom:1px solid #eadcf7;">
                      <a href="mailto:${safeEmail}" style="color:#7c3aed;text-decoration:none;">
                        ${safeEmail}
                      </a>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:12px 16px;font-weight:bold;">
                      Subject
                    </td>
                    <td style="padding:12px 16px;">
                      ${safeSubject}
                    </td>
                  </tr>
                </table>

                <div style="height:20px"></div>

                <p style="font-weight:bold;margin-bottom:8px;">Message</p>

                <div style="padding:18px;border:1px solid #eadcf7;border-radius:12px;background:#ffffff;font-size:15px;line-height:24px;">
                  ${safeMessage}
                </div>

                <div style="height:24px"></div>

                <p style="font-size:13px;color:#6b7280;">
                  This notification was sent to ${BURTON_EMAIL} and ${INFO_EMAIL}. Replying to this email will send your response directly to the sender.
                </p>

              </td>
            </tr>
          </table>
        </div>
      `,
    });

    if (adminEmailError) {
      console.error("Admin email error:", adminEmailError);
      return NextResponse.json(
        { ok: false, error: "Message saved but admin email failed to send" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Contact form server error:", error);

    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}