import { NextRequest, NextResponse } from "next/server";
import { getGmailClient } from "@/lib/gmail";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SETTINGS_KEY = "email_settings";

function toBase64Url(input: Buffer | string) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function escapeHeaderValue(value: string) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\n/g, "")
    .trim();
}

type SettingsValue = {
  senderName?: string;
  senderEmail?: string;
  replyTo?: string;
  signatureHtml?: string;
  signatureText?: string;
  testEmail?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const requestedTo = String(body?.to || "").trim();

    if (!requestedTo) {
      return NextResponse.json(
        {
          ok: false,
          error: "Test email address is required.",
        },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    const { data: settingsRow, error: settingsError } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (settingsError) {
      throw settingsError;
    }

    const settings = (settingsRow?.value as SettingsValue | null) || {};

    const senderName = escapeHeaderValue(settings.senderName || "");
    const senderEmail = escapeHeaderValue(settings.senderEmail || "");
    const replyTo = escapeHeaderValue(settings.replyTo || senderEmail || "");
    const testTo = escapeHeaderValue(requestedTo || settings.testEmail || "");
    const signatureHtml = String(
      settings.signatureHtml || "<p>Kind regards,<br />Your email account</p>"
    );
    const signatureText = String(
      settings.signatureText || "Kind regards,\nYour email account"
    );

    if (!testTo) {
      return NextResponse.json(
        {
          ok: false,
          error: "No test recipient email was provided.",
        },
        { status: 400 }
      );
    }

    const gmail = await getGmailClient();

    const subject = "Test Email from Email Settings";
    const plainText = [
      "Hello,",
      "",
      "This is a test email sent from the email settings page.",
      "",
      senderName ? `Sender name: ${senderName}` : null,
      senderEmail ? `Sender email: ${senderEmail}` : null,
      replyTo ? `Reply-to: ${replyTo}` : null,
      "",
      signatureText,
    ]
      .filter(Boolean)
      .join("\r\n");

    const html = `
<div style="font-family:Arial,sans-serif;background:#f4f4f7;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;padding:32px 24px;color:#111827;line-height:1.7;">
    <h1 style="margin:0 0 16px;font-size:28px;">Test email successful</h1>
    <p style="margin:0 0 16px;">Hello,</p>
    <p style="margin:0 0 16px;">This is a test email sent from the email settings page.</p>
    ${
      senderName || senderEmail || replyTo
        ? `
    <div style="margin:0 0 24px;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
      ${senderName ? `<p style="margin:0 0 8px;"><strong>Sender name:</strong> ${senderName}</p>` : ""}
      ${senderEmail ? `<p style="margin:0 0 8px;"><strong>Sender email:</strong> ${senderEmail}</p>` : ""}
      ${replyTo ? `<p style="margin:0;"><strong>Reply-to:</strong> ${replyTo}</p>` : ""}
    </div>`
        : ""
    }
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    ${signatureHtml}
  </div>
</div>`.trim();

    const fromHeader =
      senderName && senderEmail
        ? `"${senderName}" <${senderEmail}>`
        : senderEmail || "";

    const lines = [
      `To: ${testTo}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="test_boundary"',
    ];

    if (fromHeader) {
      lines.push(`From: ${fromHeader}`);
    }

    if (replyTo) {
      lines.push(`Reply-To: ${replyTo}`);
    }

    lines.push(
      "",
      "--test_boundary",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 7bit",
      "",
      plainText,
      "",
      "--test_boundary",
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: 7bit",
      "",
      html,
      "",
      "--test_boundary--"
    );

    const raw = toBase64Url(lines.join("\r\n"));

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Test email sent successfully to ${testTo}.`,
    });
  } catch (error) {
    console.error("Email settings test route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to send test email.",
      },
      { status: 500 }
    );
  }
}