import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireEnv(name: string, value?: string) {
  if (!value) throw new Error(`${name} is missing`);
  return value;
}

const url =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

// ✅ Use a singleton so dev hot-reload doesn't recreate clients constantly
declare global {
  // eslint-disable-next-line novar
  var __supabaseAdmin: SupabaseClient | undefined;
}

export const supabaseAdmin =
  globalThis.__supabaseAdmin ??
  createClient(
    requireEnv("SUPABASE_URL", url),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

if (process.env.NODE_ENV !== "production") {
  globalThis.__supabaseAdmin = supabaseAdmin;
}