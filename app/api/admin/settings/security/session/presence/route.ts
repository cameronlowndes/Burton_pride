import { NextRequest } from "next/server";

import {
  getOrCreateSecuritySession,
  noStoreJson,
  requireAdminIdentity,
  safeAudit,
  SIX_HOURS_MS,
  validateSameOrigin,
} from "@/lib/security/adminSessionSecurity";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const session = await getOrCreateSecuritySession(
      identity.adminId,
    );

    if (session.requires_reauthentication) {
      return noStoreJson(
        {
          error: "reauthentication_required",
          message:
            "Two-step verification is required before continuing.",
        },
        403,
      );
    }

    const now = new Date();
    const nextPresenceCheckAt = new Date(
      now.getTime() + SIX_HOURS_MS,
    ).toISOString();

    const { error } = await supabaseAdmin
      .from("admin_security_sessions")
      .update({
        last_presence_at: now.toISOString(),
        next_presence_check_at: nextPresenceCheckAt,
        last_seen_at: now.toISOString(),
      })
      .eq("id", session.id)
      .eq("admin_id", identity.adminId)
      .is("revoked_at", null);

    if (error) {
      throw new Error(
        `Could not confirm admin presence: ${error.message}`,
      );
    }

    await safeAudit({
      action: "admin_presence_check_confirmed",
      area: "security",
      route: request.nextUrl.pathname,
      method: "POST",
      status: "success",
      risk_level: "low",
      metadata: {
        session_id: session.id,
        next_presence_check_at: nextPresenceCheckAt,
      },
    });

    return noStoreJson({
      ok: true,
      next_presence_check_at: nextPresenceCheckAt,
    });
  } catch (error) {
    console.error(
      "POST /api/admin/security/session/presence failed:",
      error,
    );

    return noStoreJson(
      {
        error: "presence_confirmation_failed",
        message:
          "The admin session could not be confirmed.",
      },
      500,
    );
  }
}
