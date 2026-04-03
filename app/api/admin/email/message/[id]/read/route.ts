import { NextRequest, NextResponse } from "next/server";
import { getGmailClient } from "@/lib/gmail";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const gmail = await getGmailClient();

    await gmail.users.messages.modify({
      userId: "me",
      id,
      requestBody: {
        removeLabelIds: ["UNREAD"],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Mark as read error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to mark as read.",
      },
      { status: 500 }
    );
  }
}