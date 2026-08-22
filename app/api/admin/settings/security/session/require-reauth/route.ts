import { NextRequest } from "next/server";

import {
  cleanString,
  getOrCreateSecuritySession,
  noStoreJson,
  requireAdminIdentity,
  safeAudit,
  validateSameOrigin,
} from "@/lib/security/adminSessionSecurity";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_REAUTH_REASONS = new Set([
  "presence_check_timeout",
  "presence_confirmation_failed",
  "presence_confirmation_requires_mfa",
  "reauthentication_required",
  "mfa_timestamp_unavailable",
  "security_status_unavailable",
  "admin_session_requires_verification",
  "admin_session_not_authenticated",
]);

export async function POST(request: NextRequest) {
  try {
    if (!validateSameOrigin(request)) {
      return noStoreJson(
        {
          error: "invalid_origin",
          message: "The request origin was rejected.",
        },
        403,
      );
    }

    const identity = await requireAdminIdentity();

    if (!identity.ok) {
      return identity.response;
    }

    let body: Record<string, unknown> = {};

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const requestedReason = cleanString(body.reason);
    const reason = ALLOWED_REAUTH_REASONS.has(
      requestedReason,
    )
      ? requestedReason
      : "reauthentication_required";

    const session = await getOrCreateSecuritySession(
      identity.adminId,
    );

    const now = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("admin_security_sessions")
      .update({
        requires_reauthentication: true,
        reauth_reason: reason,
        next_presence_check_at: null,
        last_seen_at: now,
      })
      .eq("id", session.id)
      .eq("admin_id", identity.adminId)
      .is("revoked_at", null);

    if (error) {
      throw new Error(
        `Could not require admin reauthentication: ${error.message}`,
      );
    }

    await safeAudit({
      action: "admin_session_reauthentication_required",
      area: "security",
      route: request.nextUrl.pathname,
      method: "POST",
      status: "blocked",
      risk_level:
        reason === "presence_check_timeout"
          ? "medium"
          : "high",
      metadata: {
        session_id: session.id,
        reason,
      },
    });

    return noStoreJson({
      ok: true,
      requires_reauthentication: true,
      reason,
    });
  } catch (error) {
    console.error(
      "POST /api/admin/security/session/require-reauth failed:",
      error,
    );

    return noStoreJson(
      {
        error: "reauthentication_update_failed",
        message:
          "The admin security session could not be updated.",
      },
      500,
    );
  }
}
