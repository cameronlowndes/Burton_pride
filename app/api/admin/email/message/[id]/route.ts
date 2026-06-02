import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { google, gmail_v1 } from "googleapis";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ParsedAttachment = {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
  inline: boolean;
  contentId: string;
};

type ParsedMessageBody = {
  html: string;
  text: string;
  attachments: ParsedAttachment[];
};

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorised." },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing message ID." },
        { status: 400 }
      );
    }

    const { data: connection, error } = await supabaseAdmin
      .from("google_connections")
      .select("google_email, refresh_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("DB error:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to load Google connection." },
        { status: 500 }
      );
    }

    if (!connection) {
      return NextResponse.json(
        { ok: false, error: "No Gmail account connected." },
        { status: 400 }
      );
    }

    if (!connection.refresh_token) {
      return NextResponse.json(
        { ok: false, error: "Missing Gmail refresh token." },
        { status: 400 }
      );
    }

    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET ||
      !process.env.GOOGLE_OAUTH_REDIRECT_URI
    ) {
      return NextResponse.json(
        { ok: false, error: "Google OAuth environment variables are missing." },
        { status: 500 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: connection.refresh_token,
    });

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const res = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full",
    });

    const message = res.data;
    const payload = message.payload;

    const headers = payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ||
      "";

    const parsed = parseMessagePayload(payload);

    const finalHtml =
      parsed.html.trim() ||
      textToHtml(parsed.text || message.snippet || "No message content found.");

    const finalText =
      parsed.text.trim() ||
      htmlToText(parsed.html).trim() ||
      message.snippet ||
      "";

    return NextResponse.json({
      ok: true,
      message: {
        id: message.id || "",
        threadId: message.threadId || "",
        subject: getHeader("Subject"),
        from: getHeader("From"),
        to: getHeader("To"),
        cc: getHeader("Cc"),
        date: getHeader("Date"),
        snippet: message.snippet || "",
        html: finalHtml,
        text: finalText,
        labelIds: message.labelIds || [],
        attachments: parsed.attachments,
      },
    });
  } catch (error: any) {
    console.error("Message read error:", error);

    const status =
      typeof error?.code === "number"
        ? error.code
        : typeof error?.status === "number"
        ? error.status
        : 500;

    if (status === 401) {
      return NextResponse.json(
        { ok: false, error: "Google connection expired. Please reconnect." },
        { status: 401 }
      );
    }

    if (status === 403) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Google account does not have the required Gmail permissions. Please reconnect your account.",
        },
        { status: 403 }
      );
    }

    if (status === 404) {
      return NextResponse.json(
        { ok: false, error: "Email message not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load email.",
      },
      { status: 500 }
    );
  }
}

function parseMessagePayload(
  payload?: gmail_v1.Schema$MessagePart
): ParsedMessageBody {
  const htmlParts: string[] = [];
  const textParts: string[] = [];
  const attachments: ParsedAttachment[] = [];

  walkParts(payload, htmlParts, textParts, attachments);

  const html = htmlParts
    .map((part) => cleanEmailHtml(part))
    .filter(Boolean)
    .join("<hr />");

  const text = textParts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");

  return {
    html,
    text,
    attachments,
  };
}

function walkParts(
  part: gmail_v1.Schema$MessagePart | undefined,
  htmlParts: string[],
  textParts: string[],
  attachments: ParsedAttachment[]
) {
  if (!part) return;

  const mimeType = (part.mimeType || "").toLowerCase();
  const filename = part.filename || "";
  const bodyData = part.body?.data || "";
  const attachmentId = part.body?.attachmentId || "";

  if (filename && attachmentId) {
    attachments.push({
      filename,
      mimeType: part.mimeType || "application/octet-stream",
      attachmentId,
      size: Number(part.body?.size || 0),
      inline: isInlineAttachment(part),
      contentId: getHeaderValue(part.headers, "Content-Id"),
    });
  }

  if (mimeType === "text/html" && bodyData) {
    htmlParts.push(decodeBase64Url(bodyData));
  } else if (mimeType === "text/plain" && bodyData) {
    textParts.push(decodeBase64Url(bodyData));
  } else if (!mimeType && bodyData) {
    const decoded = decodeBase64Url(bodyData);
    if (looksLikeHtml(decoded)) {
      htmlParts.push(decoded);
    } else {
      textParts.push(decoded);
    }
  }

  if (part.parts?.length) {
    for (const child of part.parts) {
      walkParts(child, htmlParts, textParts, attachments);
    }
  }
}

function decodeBase64Url(value: string) {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function isInlineAttachment(part: gmail_v1.Schema$MessagePart) {
  const disposition = getHeaderValue(part.headers, "Content-Disposition");
  return /inline/i.test(disposition);
}

function getHeaderValue(
  headers: gmail_v1.Schema$MessagePartHeader[] | null | undefined,
  name: string
) {
  return (
    headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())
      ?.value || ""
  );
}

function cleanEmailHtml(html: string) {
  if (!html) return "";

  let cleaned = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/href=["']\s*javascript:[^"']*["']/gi, 'href="#"')
    .replace(/src=["']\s*javascript:[^"']*["']/gi, "")
    .replace(/<meta[\s\S]*?>/gi, "")
    .replace(/<base[\s\S]*?>/gi, "");

  cleaned = cleaned.replace(/<a\b([^>]*)>/gi, (_match, attrs) => {
    let nextAttrs = attrs || "";

    if (!/\btarget=/i.test(nextAttrs)) {
      nextAttrs += ` target="_blank"`;
    }

    if (!/\brel=/i.test(nextAttrs)) {
      nextAttrs += ` rel="noreferrer noopener"`;
    }

    return `<a${nextAttrs}>`;
  });

  return cleaned.trim();
}

function htmlToText(html: string) {
  if (!html) return "";

  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function textToHtml(text: string) {
  const safeText = escapeHtml(text || "");

  if (!safeText.trim()) {
    return "<p>No message content found.</p>";
  }

  const withLinks = safeText.replace(
    /((https?:\/\/|www\.)[^\s<]+)/gi,
    (match) => {
      const href = match.startsWith("www.") ? `https://${match}` : match;
      return `<a href="${href}" target="_blank" rel="noreferrer noopener">${match}</a>`;
    }
  );

  return withLinks
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}