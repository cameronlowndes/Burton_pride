import { NextRequest, NextResponse } from "next/server";
import type { gmail_v1 } from "googleapis";
import {
  getGmailClient,
  getHeader,
  extractPlainTextFromPayload,
} from "@/lib/gmail";

/**
 * Decode Gmail base64url content
 */
function decodeBase64Url(value?: string | null) {
  if (!value) return "";

  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = 4 - (normalized.length % 4);
  const padded =
    padding !== 4 ? normalized + "=".repeat(padding) : normalized;

  return Buffer.from(padded, "base64").toString("utf8");
}

/**
 * Extract HTML body from Gmail payload
 */
function extractHtmlFromPayload(
  payload?: gmail_v1.Schema$MessagePart | null
): string {
  if (!payload) return "";

  // direct HTML
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // nested parts (multipart emails)
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const html = extractHtmlFromPayload(part);
      if (html) return html;
    }
  }

  return "";
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // ✅ Gmail client (uses your stored refresh token)
    const gmail = await getGmailClient();

    const res = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full",
    });

    const payload = res.data.payload;
    const headers = payload?.headers ?? [];

    const html = extractHtmlFromPayload(payload);
    const text = extractPlainTextFromPayload(payload);

    return NextResponse.json({
      ok: true,
      message: {
        id: res.data.id,
        threadId: res.data.threadId,
        subject: getHeader(headers, "Subject"),
        from: getHeader(headers, "From"),
        to: getHeader(headers, "To"),
        cc: getHeader(headers, "Cc"),
        date: getHeader(headers, "Date"),
        snippet: res.data.snippet ?? "",
        html,
        text,
        labelIds: res.data.labelIds ?? [],
      },
    });
  } catch (error) {
    console.error("Read Gmail message error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load message.",
      },
      { status: 500 }
    );
  }
}