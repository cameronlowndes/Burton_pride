import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string, value?: string) {
  if (!value) throw new Error(`${name} is missing`);
  return value;
}

/**
 * Server-only (admin) Supabase client.
 * Uses service role key. Never import this into client components.
 */
export function supabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY; // fallback if you stored it under this name

  return createClient(
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
}
