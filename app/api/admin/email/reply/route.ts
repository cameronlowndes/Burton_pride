import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function toBase64Url(input: Buffer | string) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function cleanHeader(value: string) {
  return value.replace(/\r/g, "").replace(/\n/g, "").trim();
}

function extractEmail(input: string) {
  const match = input.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim();
  return input.trim();
}

async function getGoogleConnection() {
  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from("google_connections")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error("No active Google connection found.");
  }

  return data;
}

async function getGmailClient() {
  const connection = await getGoogleConnection();

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
    expiry_date: connection.expiry_at
      ? new Date(connection.expiry_at).getTime()
      : undefined,
  });

  oauth2Client.on("tokens", async (tokens) => {
    const supabase = supabaseAdmin;

    await supabase
      .from("google_connections")
      .update({
        access_token: tokens.access_token ?? connection.access_token,
        refresh_token: tokens.refresh_token ?? connection.refresh_token,
        expiry_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : connection.expiry_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const to = cleanHeader(body.to || "");
    const subject = cleanHeader(body.subject || "");
    const message = body.message?.toString() || "";
    const replyToMessageId = cleanHeader(body.replyToMessageId || "");
    const threadId = cleanHeader(body.threadId || "");
    const originalFrom = cleanHeader(body.originalFrom || "");
    const originalDate = cleanHeader(body.originalDate || "");
    const originalBody = body.originalBody?.toString() || "";

    if (!to || !subject || !message) {
      return NextResponse.json(
        { ok: false, error: "To, subject and message are required." },
        { status: 400 }
      );
    }

    const gmail = await getGmailClient();

    const lines = [
      `To: ${extractEmail(to)}`,
      `Subject: ${subject.startsWith("Re:") ? subject : `Re: ${subject}`}`,
      "Content-Type: text/html; charset=UTF-8",
      "MIME-Version: 1.0",
    ];

    if (replyToMessageId) {
      lines.push(`In-Reply-To: <${replyToMessageId}>`);
      lines.push(`References: <${replyToMessageId}>`);
    }

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#111827;">
        <div>${message.replace(/\n/g, "<br />")}</div>
        <br />
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
        <div style="color:#6b7280;font-size:13px;">
          ${
            originalFrom
              ? `<p><strong>From:</strong> ${originalFrom}</p>`
              : ""
          }
          ${
            originalDate
              ? `<p><strong>Date:</strong> ${originalDate}</p>`
              : ""
          }
          <p><strong>Subject:</strong> ${subject}</p>
        </div>
        ${
          originalBody
            ? `<blockquote style="margin:16px 0 0;padding-left:16px;border-left:3px solid #d1d5db;color:#4b5563;">${originalBody.replace(/\n/g, "<br />")}</blockquote>`
            : ""
        }
      </div>
    `;

    lines.push("");
    lines.push(html);

    const raw = toBase64Url(lines.join("\r\n"));

    const sendRes = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
        ...(threadId ? { threadId } : {}),
      },
    });

    const supabase = supabaseAdmin;

    await supabase.from("email_history").insert({
      to_email: extractEmail(to),
      subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
      body: message,
      status: "sent",
      provider: "gmail",
      gmail_message_id: sendRes.data.id ?? null,
      gmail_thread_id: sendRes.data.threadId ?? null,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      message: "Reply sent successfully.",
      gmailMessageId: sendRes.data.id ?? null,
      gmailThreadId: sendRes.data.threadId ?? null,
    });
  } catch (error) {
    console.error("Reply email error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to send reply.",
      },
      { status: 500 }
    );
  }
}