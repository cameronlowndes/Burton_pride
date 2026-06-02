import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

function decodeBase64Url(data: string) {
  return Buffer.from(data, "base64url").toString("utf8");
}

export function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
) {
  return (
    headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  );
}

function extractHtmlFromPayload(
  payload: gmail_v1.Schema$MessagePart | undefined
): string {
  if (!payload) return "";

  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts?.length) {
    for (const part of payload.parts) {
      const html = extractHtmlFromPayload(part);
      if (html) return html;
    }
  }

  return "";
}

export function extractPlainTextFromPayload(
  payload: gmail_v1.Schema$MessagePart | undefined
): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts?.length) {
    for (const part of payload.parts) {
      const text = extractPlainTextFromPayload(part);
      if (text) return text;
    }
  }

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  return "";
}

export function extractBestBodyFromPayload(
  payload: gmail_v1.Schema$MessagePart | undefined
) {
  return {
    plainText: extractPlainTextFromPayload(payload),
    html: extractHtmlFromPayload(payload),
  };
}

export function extractAttachmentsFromPayload(
  payload: gmail_v1.Schema$MessagePart | undefined
): gmail_v1.Schema$MessagePart[] {
  if (!payload) return [];

  const attachments: gmail_v1.Schema$MessagePart[] = [];

  const walk = (part: gmail_v1.Schema$MessagePart) => {
    if (part.filename && part.body?.attachmentId) {
      attachments.push(part);
    }

    if (part.parts?.length) {
      for (const child of part.parts) {
        walk(child);
      }
    }
  };

  walk(payload);

  return attachments;
}

export async function getGmailClient() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Not authenticated.");
  }

  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from("google_connections")
    .select(
      "user_id, email, google_email, access_token, refresh_token, expires_at, scope, token_type, updated_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load Google connection:", error);
    throw new Error("Failed to load Google connection.");
  }

  if (!data) {
    throw new Error("Google account not connected.");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Google env variables.");
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  oauth2Client.setCredentials({
    access_token: data.access_token ?? undefined,
    refresh_token: data.refresh_token ?? undefined,
    expiry_date: data.expires_at ?? undefined,
    token_type: data.token_type ?? undefined,
  });

  oauth2Client.on("tokens", async (tokens) => {
    const { error: updateError } = await supabase
      .from("google_connections")
      .update({
        access_token: tokens.access_token ?? data.access_token ?? null,
        refresh_token: tokens.refresh_token ?? data.refresh_token ?? null,
        expires_at: tokens.expiry_date ?? data.expires_at ?? null,
        scope:
          typeof tokens.scope === "string" ? tokens.scope : data.scope ?? null,
        token_type: tokens.token_type ?? data.token_type ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Failed to update Google tokens:", updateError);
    }
  });

  return google.gmail({
    version: "v1",
    auth: oauth2Client,
  });
}