import { google, gmail_v1 } from "googleapis";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type GmailHeader = {
  name?: string | null;
  value?: string | null;
};

type GoogleConnectionRow = {
  user_id: string;
  email: string | null;
  google_email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  scope?: string | null;
  token_type?: string | null;
  updated_at?: string | null;
};

export function getHeader(headers: GmailHeader[] = [], name: string) {
  return (
    headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  );
}

function decodeBase64Url(data: string) {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

export function extractPlainTextFromPayload(
  payload?: gmail_v1.Schema$MessagePart | null
): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    try {
      return decodeBase64Url(payload.body.data);
    } catch {
      return "";
    }
  }

  if (payload.parts?.length) {
    for (const part of payload.parts) {
      const text = extractPlainTextFromPayload(part);
      if (text.trim()) return text;
    }
  }

  if (payload.body?.data) {
    try {
      return decodeBase64Url(payload.body.data);
    } catch {
      return "";
    }
  }

  return "";
}

export async function getGmailClient() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Not authenticated.");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Google OAuth environment variables.");
  }

  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from("google_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load google connection:", error);
    throw new Error("Failed to load Google connection.");
  }

  const connection = data as GoogleConnectionRow | null;

  if (!connection) {
    throw new Error("No Google account connected.");
  }

  if (!connection.refresh_token) {
    throw new Error("Google account is missing refresh token. Please reconnect.");
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  oauth2Client.setCredentials({
    access_token: connection.access_token ?? undefined,
    refresh_token: connection.refresh_token ?? undefined,
    expiry_date: connection.expires_at ?? undefined,
  });

  oauth2Client.on("tokens", async (tokens) => {
    try {
      const updates: Record<string, string | number | null> = {
        updated_at: new Date().toISOString(),
      };

      if (tokens.access_token) updates.access_token = tokens.access_token;
      if (tokens.refresh_token) updates.refresh_token = tokens.refresh_token;
      if (tokens.expiry_date) updates.expires_at = tokens.expiry_date;
      if (tokens.scope) updates.scope = tokens.scope;
      if (tokens.token_type) updates.token_type = tokens.token_type;

      const { error: updateError } = await supabase
        .from("google_connections")
        .update(updates)
        .eq("user_id", userId);

      if (updateError) {
        console.error("Failed to update Google tokens:", updateError);
      }
    } catch (err) {
      console.error("Google token persistence error:", err);
    }
  });

  try {
    await oauth2Client.getAccessToken();
  } catch (error) {
    console.error("Google token refresh failed:", error);
    throw new Error("Google authentication expired or is invalid. Please reconnect.");
  }

  return google.gmail({
    version: "v1",
    auth: oauth2Client,
  });
}