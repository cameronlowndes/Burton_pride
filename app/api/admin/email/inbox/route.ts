import { NextRequest, NextResponse } from "next/server";
import { getGmailClient, getHeader, extractPlainTextFromPayload } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  try {
    const gmail = await getGmailClient();

    const maxResults = Number(req.nextUrl.searchParams.get("maxResults") || "20");
    const pageToken = req.nextUrl.searchParams.get("pageToken") || undefined;
    const query = req.nextUrl.searchParams.get("q") || "";

    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults,
      pageToken,
      q: query || undefined,
      labelIds: ["INBOX"],
    });

    const messages = listRes.data.messages ?? [];

    const fullMessages = await Promise.all(
      messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "full",
        });

        const payload = detail.data.payload;
        const headers = payload?.headers ?? [];

        const subject = getHeader(headers, "Subject");
        const from = getHeader(headers, "From");
        const to = getHeader(headers, "To");
        const date = getHeader(headers, "Date");
        const snippet = detail.data.snippet || extractPlainTextFromPayload(payload).slice(0, 180);
        const unread = detail.data.labelIds?.includes("UNREAD") ?? false;

        return {
          id: detail.data.id,
          threadId: detail.data.threadId,
          subject,
          from,
          to,
          date,
          snippet,
          unread,
          labelIds: detail.data.labelIds ?? [],
        };
      })
    );

    return NextResponse.json({
      ok: true,
      messages: fullMessages,
      nextPageToken: listRes.data.nextPageToken ?? null,
      resultSizeEstimate: listRes.data.resultSizeEstimate ?? 0,
    });
  } catch (error) {
    console.error("Gmail inbox error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load inbox.",
      },
      { status: 500 }
    );
  }
}