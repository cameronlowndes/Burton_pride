import { NextRequest, NextResponse } from "next/server";
import { getGmailClient } from "@/lib/gmail";

function toBase64Url(input: Buffer | string) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function escapeHeaderValue(value: string) {
  return value.replace(/\r/g, "").replace(/\n/g, "").trim();
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
  if (lower.endsWith(".txt")) return "text/plain; charset=UTF-8";
  if (lower.endsWith(".html") || lower.endsWith(".htm"))
    return "text/html; charset=UTF-8";
  if (lower.endsWith(".csv")) return "text/csv; charset=UTF-8";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (lower.endsWith(".pptx"))
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";

  return "application/octet-stream";
}

function encodeSubject(subject: string) {
  const safe = escapeHeaderValue(subject);
  return `=?UTF-8?B?${Buffer.from(safe, "utf8").toString("base64")}?=`;
}

function buildPlainTextReplyBlock({
  originalFrom,
  originalDate,
  originalBody,
}: {
  originalFrom?: string;
  originalDate?: string;
  originalBody?: string;
}) {
  const lines = (originalBody || "")
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\r\n");

  return `\r\n\r\nOn ${originalDate || "an earlier date"}, ${
    originalFrom || "the sender"
  } wrote:\r\n${lines}`;
}

function sanitizeHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function textToHtml(text: string) {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function makeBoundary(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

async function fileToAttachmentPart(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = escapeHeaderValue(file.name || "attachment");
  const mimeType = getMimeType(filename, file.type || undefined);

  return [
    `Content-Type: ${mimeType}; name="${filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${filename}"`,
    "",
    buffer.toString("base64").replace(/(.{76})/g, "$1\r\n"),
  ].join("\r\n");
}

async function parseRequest(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();

    return {
      to: String(formData.get("to") || ""),
      subject: String(formData.get("subject") || ""),
      message: String(formData.get("message") || ""),
      htmlMessage: String(formData.get("htmlMessage") || ""),
      threadId: String(formData.get("threadId") || ""),
      replyToMessageId: String(formData.get("replyToMessageId") || ""),
      originalFrom: String(formData.get("originalFrom") || ""),
      originalDate: String(formData.get("originalDate") || ""),
      originalBody: String(formData.get("originalBody") || ""),
      attachments: formData
        .getAll("attachments")
        .filter((item): item is File => item instanceof File),
    };
  }

  const body = await req.json();

  return {
    to: String(body.to || ""),
    subject: String(body.subject || ""),
    message: String(body.message || ""),
    htmlMessage: String(body.htmlMessage || ""),
    threadId: String(body.threadId || ""),
    replyToMessageId: String(body.replyToMessageId || ""),
    originalFrom: String(body.originalFrom || ""),
    originalDate: String(body.originalDate || ""),
    originalBody: String(body.originalBody || ""),
    attachments: [] as File[],
  };
}

export async function POST(req: NextRequest) {
  try {
    const {
      to,
      subject,
      message,
      htmlMessage,
      threadId,
      originalFrom,
      originalDate,
      originalBody,
      attachments,
    } = await parseRequest(req);

    const safeTo = escapeHeaderValue(to);
    const safeSubject = escapeHeaderValue(subject);

    if (!safeTo) {
      return NextResponse.json(
        {
          ok: false,
          error: "Recipient email is required.",
        },
        { status: 400 }
      );
    }

    if (!safeSubject) {
      return NextResponse.json(
        {
          ok: false,
          error: "Subject is required.",
        },
        { status: 400 }
      );
    }

    const plainTextBody = (message || "").trim();
    const safeHtmlMessage = sanitizeHtml(htmlMessage || "");

    if (!plainTextBody && !safeHtmlMessage.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Reply message is required.",
        },
        { status: 400 }
      );
    }

    const finalText =
      plainTextBody +
      buildPlainTextReplyBlock({
        originalFrom,
        originalDate,
        originalBody,
      });

    const finalHtml = `
      <div>${safeHtmlMessage.trim() || textToHtml(plainTextBody)}</div>
      <br />
      <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
      <div style="color:#555;font-size:14px;">
        <p style="margin:0 0 8px 0;"><strong>From:</strong> ${escapeHtml(
          originalFrom || ""
        )}</p>
        <p style="margin:0 0 8px 0;"><strong>Date:</strong> ${escapeHtml(
          originalDate || ""
        )}</p>
        <div>${textToHtml(originalBody || "")}</div>
      </div>
    `.trim();

    const gmail = await getGmailClient();

    const mixedBoundary = makeBoundary("mixed");
    const altBoundary = makeBoundary("alt");

    const mimeParts: string[] = [
      `To: ${safeTo}`,
      `Subject: ${encodeSubject(safeSubject)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
      "",
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      "",
      `--${altBoundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 7bit",
      "",
      finalText,
      "",
      `--${altBoundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: 7bit",
      "",
      finalHtml,
      "",
      `--${altBoundary}--`,
    ];

    for (const file of attachments) {
      mimeParts.push("");
      mimeParts.push(`--${mixedBoundary}`);
      mimeParts.push(await fileToAttachmentPart(file));
    }

    mimeParts.push("");
    mimeParts.push(`--${mixedBoundary}--`);

    const raw = toBase64Url(mimeParts.join("\r\n"));

    const sendRes = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
        threadId: threadId || undefined,
      },
    });

    return NextResponse.json({
      ok: true,
      message:
        attachments.length > 0
          ? "Reply with attachments sent successfully."
          : "Reply sent successfully.",
      id: sendRes.data.id || null,
      threadId: sendRes.data.threadId || null,
    });
  } catch (error) {
    console.error("Reply email route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to send reply.",
      },
      { status: 500 }
    );
  }
}