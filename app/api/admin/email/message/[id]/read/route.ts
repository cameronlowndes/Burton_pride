import { NextRequest, NextResponse } from "next/server";
import { getGmailClient } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing message id.",
        },
        { status: 400 }
      );
    }

    const gmail = await getGmailClient();

    await gmail.users.messages.modify({
      userId: "me",
      id,
      requestBody: {
        removeLabelIds: ["UNREAD"],
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Email marked as read.",
    });
  } catch (error: any) {
    console.error("Mark Gmail message as read error:", error);

    const message =
      error?.response?.data?.error?.message ||
      error?.message ||
      "Failed to mark email as read.";

    const status =
      message.toLowerCase().includes("not logged in") ||
      message.toLowerCase().includes("not authenticated")
        ? 401
        : error?.response?.status || 500;

    return NextResponse.json(
      {
        ok: false,
        error: message,
        details: error?.response?.data || null,
      },
      { status }
    );
  }
}