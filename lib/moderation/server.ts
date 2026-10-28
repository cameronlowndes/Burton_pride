import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient as authClient } from "@supabase/supabase-js";
import {
  getCurrentAdmin,
  type AdminPermissionKey,
} from "@/lib/adminPermissions";
import { supabaseAdmin as db } from "@/lib/supabase/supabaseAdmin";
import { createClient } from "@/lib/supabase/server";
export { db };
export function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie, Authorization",
    },
  });
}
export function errorResponse(error: unknown) {
  const e = error as { status?: number; message?: string };
  return json(
    {
      ok: false,
      error: e.status
        ? e.message
        : "Moderation service unavailable. Check database migrations and server configuration.",
    },
    e.status || 503,
  );
}
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export async function access(permission: AdminPermissionKey) {
  const admin = await getCurrentAdmin();
  if (!admin?.security_session_id)
    fail("Sign in again with your administrator account.", 401);
  const { data, error } = await db.rpc("moderation_authorized", {
    p_admin: admin.id,
    p_session: admin.security_session_id,
    p_permission: permission,
  });
  if (error) fail("Administrator permission checks are unavailable.", 503);
  if (!data)
    fail("An active session and moderation permission are required.", 403);
  return admin;
}
export function sameOrigin(request: NextRequest) {
  if (
    request.headers.get("origin") !== request.nextUrl.origin ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    fail("Same-origin JSON requests are required.", 403);
  if (Number(request.headers.get("content-length") || 0) > 4096)
    fail("Request too large.", 413);
}
export async function body(request: NextRequest) {
  const text = await request.text();
  if (text.length > 4096) fail("Request too large.", 413);
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data))
      fail("Invalid request.");
    return data as Record<string, unknown>;
  } catch {
    fail("Invalid JSON request.");
  }
}
export async function attempt(
  admin: Awaited<ReturnType<typeof access>>,
  action: string,
) {
  const { data, error } = await db.rpc("moderation_rate_limit", {
    p_admin: admin.id,
    p_session: admin.security_session_id,
    p_action: action,
  });
  if (error) fail("Security rate limiting unavailable.", 503);
  if (!data)
    fail(
      "Too many verification attempts or session expired. Wait ten minutes and sign in again.",
      429,
    );
}
export async function audit(
  admin: Awaited<ReturnType<typeof access>>,
  action: string,
  outcome: string,
) {
  const { error } = await db
    .from("moderation_security_events")
    .insert({
      admin_id: admin.id,
      session_id: admin.security_session_id,
      action,
      outcome,
    });
  if (error) fail("Security audit could not be recorded.", 503);
}
export async function verifyTotp(
  admin: Awaited<ReturnType<typeof access>>,
  action: string,
  code: unknown,
) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code))
    fail("Enter the six-digit Authenticator code.");
  const pepper = process.env.ADMIN_2FA_PEPPER;
  if (!pepper || pepper.length < 32)
    fail("Server security pepper is not configured.", 503);
  const client = await createClient();
  const { data: user, error: userError } = await client.auth.getUser();
  if (userError || !user.user || user.user.id !== admin.supabase_user_id)
    fail(
      "Authenticator identity does not match this admin session. Sign in again.",
      403,
    );
  const { data: security, error } = await db
    .from("admin_users")
    .select("two_factor_totp_enabled,two_factor_totp_factor_id")
    .eq("id", admin.id)
    .single();
  if (
    error ||
    !security?.two_factor_totp_enabled ||
    !security.two_factor_totp_factor_id
  )
    fail("Set up Google Authenticator in the Security Centre first.", 403);
  const factorId = security.two_factor_totp_factor_id;
  const { data: factors, error: factorError } =
    await client.auth.mfa.listFactors();
  if (
    factorError ||
    !factors.totp.some((f) => f.id === factorId && f.status === "verified")
  )
    fail("A verified Authenticator factor is required.", 403);
  const proof = randomBytes(32).toString("hex");
  const codeHash = createHmac("sha256", pepper)
    .update(`${factorId}:${code}`)
    .digest("hex");
  const cleanup = await db
    .from("moderation_proofs")
    .delete()
    .lt("expires_at", new Date(Date.now() - 180000).toISOString());
  if (cleanup.error) fail("Verification storage unavailable.", 503);
  // Reserve atomically before calling Auth. Concurrent submissions cannot reuse this code.
  const reserved = await db
    .from("moderation_proofs")
    .insert({
      proof_hash: hash(proof),
      code_hash: codeHash,
      admin_id: admin.id,
      session_id: admin.security_session_id,
      action,
      consumed_at: new Date().toISOString(),
    });
  if (reserved.error) {
    await audit(admin, action, "totp_rejected_or_reused");
    fail(
      "Code already used or verification unavailable. Wait for a new code.",
      409,
    );
  }
  const verified = await client.auth.mfa.challengeAndVerify({ factorId, code });
  if (verified.error) {
    await audit(admin, action, "totp_rejected");
    fail("Authenticator code is invalid, expired or already used.", 403);
  }
  const updated = await db
    .from("moderation_proofs")
    .update({ consumed_at: null })
    .eq("proof_hash", hash(proof));
  if (updated.error) fail("Verification could not be saved.", 503);
  await audit(admin, action, "totp_verified");
  return proof;
}
export async function verifyMainPassword(password: unknown) {
  if (
    typeof password !== "string" ||
    password.length < 1 ||
    password.length > 128
  )
    fail("Enter the Main Admin password.");
  // There must be one designated main administrator. No browser-supplied identity can select it.
  let query = db
    .from("admin_users")
    .select("id,email,supabase_user_id")
    .eq("role", "main_admin")
    .eq("is_active", true);
  if (process.env.MODERATION_MAIN_ADMIN_ID)
    query = query.eq("id", process.env.MODERATION_MAIN_ADMIN_ID);
  const { data: rows, error } = await query.limit(2);
  if (error || rows?.length !== 1 || !rows[0].supabase_user_id)
    fail(
      "Designate one active Main Admin using MODERATION_MAIN_ADMIN_ID.",
      503,
    );
  const main = rows[0];
  const client = authClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const result = await client.auth.signInWithPassword({
    email: main.email,
    password,
  });
  if (result.error || result.data.user?.id !== main.supabase_user_id)
    return false;
  await client.auth.signOut({ scope: "local" });
  return true;
}
