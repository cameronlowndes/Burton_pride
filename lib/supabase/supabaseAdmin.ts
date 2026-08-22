import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";


type SupabaseJwtPayload = {
  role?: string;
  iss?: string;
  ref?: string;
  exp?: number;
  [key: string]: unknown;
};

declare global {
  // eslint-disable-next-line no-var
  var __burtonPrideSupabaseAdmin: SupabaseClient | undefined;
}

function requireEnv(name: string, value: string | undefined) {
  const cleanValue = String(value || "").trim();

  if (!cleanValue) {
    throw new Error(`${name} is missing.`);
  }

  return cleanValue;
}

function requireValidSupabaseUrl(value: string | undefined) {
  const cleanValue = requireEnv("SUPABASE_URL", value);

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(cleanValue);
  } catch {
    throw new Error("SUPABASE_URL is not a valid URL.");
  }

  const isLocalDev =
    parsedUrl.hostname === "localhost" ||
    parsedUrl.hostname === "127.0.0.1" ||
    parsedUrl.hostname.endsWith(".local");

  if (process.env.NODE_ENV === "production" && parsedUrl.protocol !== "https:") {
    throw new Error("SUPABASE_URL must use HTTPS in production.");
  }

  if (
    process.env.NODE_ENV !== "production" &&
    parsedUrl.protocol !== "https:" &&
    !isLocalDev
  ) {
    throw new Error("SUPABASE_URL must use HTTPS unless running local dev.");
  }

  return cleanValue.replace(/\/+$/, "");
}

function decodeJwtPayload(key: string): SupabaseJwtPayload | null {
  const parts = key.split(".");

  if (parts.length < 2 || !parts[1]) {
    return null;
  }

  try {
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");

    const json = Buffer.from(payload, "base64").toString("utf8");

    return JSON.parse(json) as SupabaseJwtPayload;
  } catch {
    return null;
  }
}

function requirePrivateSupabaseAdminKey(value: string | undefined) {
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY", value);

  if (key.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is using a publishable key. Use a private service role/secret key only.",
    );
  }

  if (key.startsWith("sb_secret_")) {
    return key;
  }

  const jwtPayload = decodeJwtPayload(key);

  if (!jwtPayload) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must be a Supabase service_role JWT or a Supabase secret key.",
    );
  }

  if (jwtPayload.role !== "service_role") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not a service_role key. Do not use the anon key here.",
    );
  }

  return key;
}

function createSupabaseAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("supabaseAdmin must never be used in the browser.");
  }

  const supabaseUrl = requireValidSupabaseUrl(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  );

  const serviceRoleKey = requirePrivateSupabaseAdminKey(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  );

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "X-Client-Info": "burton-pride-admin-server",
      },
    },
  });
}

export function getSupabaseAdmin() {
  if (!globalThis.__burtonPrideSupabaseAdmin) {
    globalThis.__burtonPrideSupabaseAdmin = createSupabaseAdminClient();
  }

  return globalThis.__burtonPrideSupabaseAdmin;
}

export const supabaseAdmin = getSupabaseAdmin();