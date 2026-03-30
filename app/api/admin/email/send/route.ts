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

function escapeHeaderValue(value: string) {
  return value.replace(/\r/g, "").replace(/\n/g, "");
}

function getMimeType(filename: string, fallback?: string | null) {
  if (fallback) return fallback;

  const lower = filename.toLowerCase();

  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".zip")) return "application/zip";

  return "application/octet-stream";
}

function chunkBase64(base64: string, size = 76) {
  return base64.match(new RegExp(`.{1,${size}}`, "g"))?.join("\r\n") ?? base64;
}

function buildRawEmail({
  from,
  to,
  cc,
  bcc,
  subject,
  text,
  html,
  attachments,
}: {
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    content: Buffer;
  }>;
}) {
  const safeFrom = escapeHeaderValue(from);
  const safeTo = escapeHeaderValue(to);
  const safeCc = cc ? escapeHeaderValue(cc) : "";
  const safeBcc = bcc ? escapeHeaderValue(bcc) : "";
  const safeSubject = escapeHeaderValue(subject);

  const hasHtml = !!html?.trim();
  const hasText = !!text?.trim();
  const hasAttachments = !!attachments?.length;

  const mixedBoundary = `mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const altBoundary = `alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const headers = [
    `From: ${safeFrom}`,
    `To: ${safeTo}`,
    ...(safeCc ? [`Cc: ${safeCc}`] : []),
    ...(safeBcc ? [`Bcc: ${safeBcc}`] : []),
    `Subject: ${safeSubject}`,
    "MIME-Version: 1.0",
  ];

  const lines: string[] = [];

  if (hasAttachments) {
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    lines.push(...headers, "");

    if (hasHtml && hasText) {
      lines.push(`--${mixedBoundary}`);
      lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
      lines.push("");

      lines.push(`--${altBoundary}`);
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push("Content-Transfer-Encoding: 7bit");
      lines.push("");
      lines.push(text || "");
      lines.push("");

      lines.push(`--${altBoundary}`);
      lines.push('Content-Type: text/html; charset="UTF-8"');
      lines.push("Content-Transfer-Encoding: 7bit");
      lines.push("");
      lines.push(html || "");
      lines.push("");

      lines.push(`--${altBoundary}--`);
      lines.push("");
    } else if (hasHtml) {
      lines.push(`--${mixedBoundary}`);
      lines.push('Content-Type: text/html; charset="UTF-8"');
      lines.push("Content-Transfer-Encoding: 7bit");
      lines.push("");
      lines.push(html || "");
      lines.push("");
    } else {
      lines.push(`--${mixedBoundary}`);
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push("Content-Transfer-Encoding: 7bit");
      lines.push("");
      lines.push(text || "");
      lines.push("");
    }

    for (const attachment of attachments ?? []) {
      lines.push(`--${mixedBoundary}`);
      lines.push(
        `Content-Type: ${attachment.mimeType}; name="${escapeHeaderValue(
          attachment.filename
        )}"`
      );
      lines.push(
        `Content-Disposition: attachment; filename="${escapeHeaderValue(
          attachment.filename
        )}"`
      );
      lines.push("Content-Transfer-Encoding: base64");
      lines.push("");
      lines.push(chunkBase64(attachment.content.toString("base64")));
      lines.push("");
    }

    lines.push(`--${mixedBoundary}--`);
    return lines.join("\r\n");
  }

  if (hasHtml && hasText) {
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    lines.push(...headers, "");

    lines.push(`--${altBoundary}`);
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(text || "");
    lines.push("");

    lines.push(`--${altBoundary}`);
    lines.push('Content-Type: text/html; charset="UTF-8"');
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(html || "");
    lines.push("");

    lines.push(`--${altBoundary}--`);
    return lines.join("\r\n");
  }

  if (hasHtml) {
    headers.push('Content-Type: text/html; charset="UTF-8"');
    headers.push("Content-Transfer-Encoding: 7bit");
    return [...headers, "", html || ""].join("\r\n");
  }

  headers.push('Content-Type: text/plain; charset="UTF-8"');
  headers.push("Content-Transfer-Encoding: 7bit");
  return [...headers, "", text || ""].join("\r\n");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const to = String(formData.get("to") || "").trim();
    const cc = String(formData.get("cc") || "").trim();
    const bcc = String(formData.get("bcc") || "").trim();
    const subject = String(formData.get("subject") || "").trim();
    const message = String(formData.get("message") || "").trim();
    const html = String(formData.get("html") || "").trim();
    const editorMode = String(formData.get("editorMode") || "plain").trim();

    if (!to || !subject) {
      return NextResponse.json(
        {
          ok: false,
          error: "To and subject are required.",
        },
        { status: 400 }
      );
    }

    const hasBody =
      editorMode === "html"
        ? html.length > 0 || message.length > 0
        : message.length > 0;

    if (!hasBody) {
      return NextResponse.json(
        {
          ok: false,
          error: "Email content is required.",
        },
        { status: 400 }
      );
    }

    const files = formData.getAll("attachments").filter(Boolean) as File[];

    const attachments = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        return {
          filename: file.name,
          mimeType: getMimeType(file.name, file.type),
          content: Buffer.from(arrayBuffer),
        };
      })
    );

    const supabase = supabaseAdmin;

    const { data: connection, error: connectionError } = await supabase
      .from("google_connections")
      .select("id, email, google_email, access_token, refresh_token, expires_at, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connectionError) {
      return NextResponse.json(
        {
          ok: false,
          error: connectionError.message,
        },
        { status: 500 }
      );
    }

    if (!connection) {
      return NextResponse.json(
        {
          ok: false,
          error: "No Google connection row found in google_connections.",
        },
        { status: 400 }
      );
    }

    if (!connection.access_token) {
      return NextResponse.json(
        {
          ok: false,
          error: "Google connection is missing access_token.",
        },
        { status: 400 }
      );
    }

    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET ||
      !process.env.GOOGLE_OAUTH_REDIRECT_URI
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Google OAuth environment variables are missing.",
        },
        { status: 500 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: connection.access_token,
      refresh_token: connection.refresh_token || undefined,
      expiry_date: connection.expires_at ?? undefined,
    });

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const fromEmail = connection.google_email || connection.email || "me";

    const rawEmail = buildRawEmail({
      from: fromEmail,
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject,
      text: message || undefined,
      html: editorMode === "html" ? html || undefined : undefined,
      attachments,
    });

    const encodedMessage = toBase64Url(rawEmail);

    const gmailResponse = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    const { error: historyError } = await supabase.from("email_history").insert({
      to_email: to,
      cc_email: cc || null,
      bcc_email: bcc || null,
      subject,
      message: message || null,
      html: editorMode === "html" ? html || null : null,
      status: "sent",
      created_at: new Date().toISOString(),
    });

    if (historyError) {
      console.error("Failed to write email_history:", historyError.message);
    }

    return NextResponse.json({
      ok: true,
      message: connection.refresh_token
        ? "Email sent successfully."
        : "Email sent successfully. No refresh token is stored, so reconnect Google later if sending stops working.",
      gmailMessageId: gmailResponse.data.id ?? null,
    });
  } catch (error) {
    console.error("Email send error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to send email.",
      },
      { status: 500 }
    );
  }
}