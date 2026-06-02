import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { Resend } from "resend";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_EMAILS = [
  "prideburton@gmail.com",
  "info@burtonpride.co.uk",
];

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
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        {
          ok: false,
          error: "RESEND_API_KEY is missing from environment variables.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();

    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const message = String(body?.message || "").trim();

    if (!name || !email || !message) {
      return NextResponse.json(
        {
          ok: false,
          error: "Name, email and feedback message are required.",
        },
        { status: 400 }
      );
    }

    if (!email.includes("@")) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter a valid email address.",
        },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabaseAdmin
      .from("feedback_messages")
      .insert({
        name,
        email,
        message,
        status: "new",
        is_read: false,
      });

    if (insertError) {
      console.error("Feedback save failed:", insertError);

      return NextResponse.json(
        {
          ok: false,
          error: insertError.message || "Failed to save feedback.",
        },
        { status: 500 }
      );
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

    const fromEmail = process.env.FROM_EMAIL || "noreply@burtonpride.co.uk";
    const formattedFrom = fromEmail.includes("<")
      ? fromEmail
      : `Burton Pride <${fromEmail}>`;

    const userEmailPromise = resend.emails.send({
      from: formattedFrom,
      to: email,
      replyTo: "info@burtonpride.co.uk",
      subject: "Thank you for your Burton Pride feedback",
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
            <div style="background:linear-gradient(135deg,#ec4899,#8b5cf6,#3b82f6);padding:28px 24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;">Burton Pride</h1>
              <p style="margin:10px 0 0;color:#fdf2f8;">Feedback Received</p>
            </div>

            <div style="padding:32px 24px;">
              <p>Hi ${safeName},</p>

              <p>Thank you for sharing your feedback with Burton Pride.</p>

              <p>
                We really appreciate you taking the time to tell us about your experience.
                Your feedback helps us improve future events and support our community better.
              </p>

              <p>
                A member of our team may review your feedback as part of planning for future Burton Pride events.
              </p>

              <p style="margin-top:24px;">
                Kind regards,<br />
                <strong>Burton Pride C.I.C</strong>
              </p>
            </div>
          </div>
        </div>
      `,
    });

    const adminEmailPromise = resend.emails.send({
      from: formattedFrom,
      to: ADMIN_EMAILS,
      replyTo: email,
      subject: "New Burton Pride Feedback Submitted",
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
          <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
            <div style="background:#111827;padding:24px;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;">New Feedback Submission</h1>
              <p style="margin:10px 0 0;color:#cbd5e1;">
                A new feedback form has been submitted on the Burton Pride website.
              </p>
            </div>

            <div style="padding:24px;">
              <p><strong>Name:</strong> ${safeName}</p>
              <p><strong>Email:</strong> <a href="mailto:${safeEmail}" style="color:#2563eb;text-decoration:none;">${safeEmail}</a></p>

              <h3 style="margin-top:24px;">Feedback Message</h3>
              <div style="padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc;line-height:1.6;">
                ${safeMessage}
              </div>

              <p style="margin-top:24px;color:#475569;font-size:14px;">
                This notification was sent to prideburton@gmail.com and info@burtonpride.co.uk.
              </p>

              <p style="margin-top:8px;color:#475569;font-size:14px;">
                Replying to this email will reply directly to the sender.
              </p>
            </div>
          </div>
        </div>
      `,
    });

    const [userEmailResult, adminEmailResult] = await Promise.allSettled([
      userEmailPromise,
      adminEmailPromise,
    ]);

    if (userEmailResult.status === "rejected") {
      console.error("User feedback email threw error:", userEmailResult.reason);
    } else if (userEmailResult.value?.error) {
      console.error("User feedback email failed:", userEmailResult.value.error);
    } else {
      console.log("User feedback email sent:", userEmailResult.value);
    }

    if (adminEmailResult.status === "rejected") {
      console.error("Admin feedback email threw error:", adminEmailResult.reason);
    } else if (adminEmailResult.value?.error) {
      console.error("Admin feedback email failed:", adminEmailResult.value.error);
    } else {
      console.log("Admin feedback email sent:", adminEmailResult.value);
    }

    const userEmailFailed =
      userEmailResult.status === "rejected" ||
      (userEmailResult.status === "fulfilled" && userEmailResult.value?.error);

    const adminEmailFailed =
      adminEmailResult.status === "rejected" ||
      (adminEmailResult.status === "fulfilled" && adminEmailResult.value?.error);

    if (userEmailFailed || adminEmailFailed) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Feedback was saved, but one or more emails failed to send. Check your server terminal and Resend domain setup.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Feedback submitted successfully.",
    });
  } catch (error) {
    console.error("Feedback route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}