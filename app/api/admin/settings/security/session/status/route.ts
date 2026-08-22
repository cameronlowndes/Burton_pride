import {
  getOrCreateSecuritySession,
  markSessionSeen,
  noStoreJson,
  requireAdminIdentity,
  SIX_HOURS_MS,
} from "@/lib/security/adminSessionSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await requireAdminIdentity();

    if (!identity.ok) {
      return identity.response;
    }

    const session = await getOrCreateSecuritySession(
      identity.adminId,
    );

    await markSessionSeen(session.id);

    if (session.requires_reauthentication) {
      return noStoreJson({
        authenticated: true,
        requires_reauthentication: true,
        last_mfa_at: session.last_mfa_at,
        next_presence_check_at:
          session.next_presence_check_at,
        reason:
          session.reauth_reason ||
          "reauthentication_required",
      });
    }

    const lastMfaAt = session.last_mfa_at
      ? Date.parse(session.last_mfa_at)
      : Number.NaN;

    if (!Number.isFinite(lastMfaAt)) {
      return noStoreJson({
        authenticated: true,
        requires_reauthentication: true,
        last_mfa_at: null,
        next_presence_check_at: null,
        reason: "mfa_timestamp_unavailable",
      });
    }

    let nextPresenceCheckAt =
      session.next_presence_check_at;

    if (!nextPresenceCheckAt) {
      nextPresenceCheckAt = new Date(
        lastMfaAt + SIX_HOURS_MS,
      ).toISOString();
    }

    return noStoreJson({
      authenticated: true,
      requires_reauthentication: false,
      last_mfa_at: session.last_mfa_at,
      next_presence_check_at: nextPresenceCheckAt,
    });
  } catch (error) {
    console.error(
      "GET /api/admin/security/session/status failed:",
      error,
    );

    return noStoreJson(
      {
        error: "security_status_unavailable",
        message:
          "The admin security session could not be verified.",
      },
      500,
    );
  }
}
