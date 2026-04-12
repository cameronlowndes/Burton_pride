import { NextRequest, NextResponse } from "next/server";
import { getGmailClient } from "@/lib/gmail";

function base64UrlToBuffer(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );

  return Buffer.from(padded, "base64");
}

type GmailPart = {
  mimeType?: string;
  filename?: string;
  body?: {
    attachmentId?: string;
    size?: number;
    data?: string;
  };
  parts?: GmailPart[];
};

function findAttachmentPart(
  parts: GmailPart[] = [],
  attachmentId: string
): GmailPart | null {
  for (const part of parts) {
    if (part.body?.attachmentId === attachmentId) {
      return part;
    }

    if (part.parts?.length) {
      const nested = findAttachmentPart(part.parts, attachmentId);
      if (nested) return nested;
    }
  }

  return null;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const attachmentId = req.nextUrl.searchParams.get("attachmentId");
    const filenameParam = req.nextUrl.searchParams.get("filename");
    const download = req.nextUrl.searchParams.get("download") === "1";

    if (!id || !attachmentId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing message id or attachment id.",
        },
        { status: 400 }
      );
    }

    const gmail = await getGmailClient();

    const messageRes = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full",
    });

    const payload = messageRes.data.payload;
    const part = findAttachmentPart(payload?.parts as GmailPart[], attachmentId);

    const attachmentRes = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: id,
      id: attachmentId,
    });

    const rawData = attachmentRes.data.data;

    if (!rawData) {
      return NextResponse.json(
        {
          ok: false,
          error: "Attachment data not found.",
        },
        { status: 404 }
      );
    }

    const buffer = base64UrlToBuffer(rawData);
    const mimeType = part?.mimeType || "application/octet-stream";
    const filename =
      filenameParam?.trim() || part?.filename?.trim() || "attachment";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Attachment route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load attachment.",
      },
      { status: 500 }
    );
  }
}