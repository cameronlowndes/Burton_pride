import { google } from "googleapis";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type GmailAccountRow = {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  expiry_date: number | null;
};

async function getStoredAccount() {
  const { data, error } = await supabaseAdmin
    .from("gmail_accounts")
    .select("id, access_token, refresh_token, expiry_date")
    .eq("id", "main")
    .single<GmailAccountRow>();

  if (error || !data) {
    throw new Error("No Gmail account connected.");
  }

  return data;
}

export async function getValidAccessToken() {
  const account = await getStoredAccount();

  if (!account.refresh_token) {
    throw new Error("Missing Gmail refresh token.");
  }

  if (
    account.access_token &&
    account.expiry_date &&
    Date.now() < account.expiry_date - 60_000
  ) {
    return account.access_token;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Failed to refresh Gmail token: ${text}`);
  }

  const tokenData = await tokenRes.json();

  await supabaseAdmin
    .from("gmail_accounts")
    .update({
      access_token: tokenData.access_token,
      expiry_date: Date.now() + (tokenData.expires_in ?? 3600) * 1000,
    })
    .eq("id", "main");

  return tokenData.access_token as string;
}

export async function getGmailClient() {
  const accessToken = await getValidAccessToken();

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );

  auth.setCredentials({
    access_token: accessToken,
  });

  return google.gmail({ version: "v1", auth });
}

export function decodeBase64Url(input?: string | null) {
  if (!input) return "";
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  return Buffer.from(padded, "base64").toString("utf8");
}

export function getHeader(
  headers: { name?: string | null; value?: string | null }[] | undefined,
  name: string
) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
    ?.value ?? "";
}

export function extractPlainTextFromPayload(payload: any): string {
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

  return "";
}

export function extractHtmlFromPayload(payload: any): string {
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