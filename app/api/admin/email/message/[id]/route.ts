import { NextRequest, NextResponse } from "next/server";
import {
  getGmailClient,
  getHeader,
  extractPlainTextFromPayload,
  extractHtmlFromPayload,
} from "@/lib/gmail";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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
        error: error instanceof Error ? error.message : "Failed to load message.",
      },
      { status: 500 }
    );
  }
}