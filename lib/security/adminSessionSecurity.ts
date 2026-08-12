import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export type AdminSecuritySessionRow = {
  id: string;
  admin_id: string;
  last_mfa_at: string | null;
  last_presence_at: string | null;
  next_presence_check_at: string | null;
  requires_reauthentication: boolean;
  reauth_reason: string | null;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
};

export function noStoreJson(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function getAdminId(admin: unknown): string | null {
  if (!admin || typeof admin !== "object") return null;

  const record = admin as Record<string, unknown>;

  const candidates = [
    record.id,
    record.admin_id,
    record.adminId,
  ];

  for (const value of candidates) {
    const cleaned = cleanString(value);
    if (cleaned) return cleaned;
  }

  return null;
}

export async function requireAdminIdentity() {
  const admin = await getCurrentAdmin();
  const adminId = getAdminId(admin);

  if (!admin || !adminId) {
    return {
      ok: false as const,
      response: noStoreJson(
        {
          error: "unauthenticated",
          message: "Admin authentication is required.",
        },
        401,
      ),
    };
  }

  return {
    ok: true as const,
    admin,
    adminId,
  };
}

export async function getLatestSecuritySession(
  adminId: string,
): Promise<AdminSecuritySessionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("admin_security_sessions")
    .select(
      [
        "id",
        "admin_id",
        "last_mfa_at",
        "last_presence_at",
        "next_presence_check_at",
        "requires_reauthentication",
        "reauth_reason",
        "created_at",
        "last_seen_at",
        "revoked_at",
      ].join(","),
    )
    .eq("admin_id", adminId)
    .is("revoked_at", null)
    .order("last_seen_at", {
      ascending: false,
      nullsFirst: false,
    })
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not read admin security session: ${error.message}`,
    );
  }

  return (data as AdminSecuritySessionRow | null) ?? null;
}

export async function createSecuritySession(
  adminId: string,
): Promise<AdminSecuritySessionRow> {
  const now = new Date();
  const nextPresence = new Date(
    now.getTime() + SIX_HOURS_MS,
  ).toISOString();

  /*
   * IMPORTANT:
   * If your existing login/two-factor flow already stores the exact
   * MFA completion time, replace `now` below with that server-side value.
   *
   * This fallback exists so the new presence-check feature can start
   * working immediately after deployment.
   */
  const { data, error } = await supabaseAdmin
    .from("admin_security_sessions")
    .insert({
      admin_id: adminId,
      last_mfa_at: now.toISOString(),
      last_presence_at: now.toISOString(),
      next_presence_check_at: nextPresence,
      requires_reauthentication: false,
      reauth_reason: null,
      last_seen_at: now.toISOString(),
    })
    .select(
      [
        "id",
        "admin_id",
        "last_mfa_at",
        "last_presence_at",
        "next_presence_check_at",
        "requires_reauthentication",
        "reauth_reason",
        "created_at",
        "last_seen_at",
        "revoked_at",
      ].join(","),
    )
    .single();

  if (error || !data) {
    throw new Error(
      `Could not create admin security session: ${
        error?.message || "unknown error"
      }`,
    );
  }

  return data as unknown as AdminSecuritySessionRow;
}

export async function getOrCreateSecuritySession(
  adminId: string,
) {
  const existing = await getLatestSecuritySession(adminId);
  return existing ?? createSecuritySession(adminId);
}

export async function markSessionSeen(sessionId: string) {
  const { error } = await supabaseAdmin
    .from("admin_security_sessions")
    .update({
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    console.warn(
      "Could not update admin security session last_seen_at:",
      error.message,
    );
  }
}

export async function safeAudit(
  input: {
    action: string;
    area?: string;
    route?: string | null;
    method?: string;
    status?: string;
    risk_level?: "low" | "medium" | "high" | "critical";
    metadata?: Record<string, unknown>;
  },
) {
  /*
   * If you already have a shared server-side audit helper, use it here.
   * This direct insert is deliberately best-effort so an audit table
   * mismatch never keeps an authorised admin permanently locked out.
   */
  try {
    await supabaseAdmin.from("admin_audit_logs").insert({
      action: input.action,
      area: input.area ?? "security",
      route: input.route ?? null,
      method: input.method ?? "SERVER",
      status: input.status ?? "success",
      risk_level: input.risk_level ?? "low",
      metadata: input.metadata ?? {},
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("Admin security audit write failed:", error);
  }
}

export function validateSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) {
    /*
     * Same-origin browser requests may omit Origin in some cases.
     * Authentication cookies and your normal route protection still apply.
     */
    return true;
  }

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}
