import { NextRequest } from "next/server";
import {
  access,
  attempt,
  audit,
  body,
  db,
  errorResponse,
  fail,
  hash,
  json,
  sameOrigin,
  verifyMainPassword,
} from "@/lib/moderation/server";
import { effectiveStatus } from "@/supabase/functions/_shared/moderation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const admin = await access("moderation:view");
    const [
      service,
      connections,
      jobs,
      decisions,
      history,
      failedCount,
      queuedCount,
      reviewCount,
      firstStarted,
      recentRecovery,
    ] = await Promise.all([
      db
        .from("moderation_service")
        .select(
          "enabled,status,generation,started_at,last_restart_at,last_manual_restart_at,next_restart_at,last_refresh_at,heartbeat_at,next_health_check_at,last_processed_at,recovery_attempts,error,lease_until",
        )
        .eq("id", true)
        .single(),
      db.from("moderation_connections").select("*"),
      db
        .from("moderation_jobs")
        .select("id,platform,status,attempts,last_error,received_at")
        .order("received_at", { ascending: false })
        .limit(10),
      db
        .from("moderation_decisions")
        .select("*,moderation_jobs(content)")
        .eq("action_status", "review")
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("moderation_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
      db
        .from("moderation_jobs")
        .select("id", { head: true, count: "exact" })
        .eq("status", "failed"),
      db
        .from("moderation_jobs")
        .select("id", { head: true, count: "exact" })
        .in("status", ["queued", "processing"]),
      db
        .from("moderation_decisions")
        .select("job_id", { head: true, count: "exact" })
        .eq("action_status", "review"),
      db
        .from("moderation_history")
        .select("created_at")
        .eq("outcome", "completed")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      db
        .from("moderation_history")
        .select("id", { head: true, count: "exact" })
        .eq("kind", "recovery")
        .gte("created_at", new Date(Date.now() - 86400000).toISOString()),
    ]);
    if (
      [
        service,
        connections,
        jobs,
        decisions,
        history,
        failedCount,
        queuedCount,
        reviewCount,
        firstStarted,
        recentRecovery,
      ].some((r) => r.error)
    )
      fail(
        "Dashboard data could not be read from Supabase. Check migrations and database availability.",
        503,
      );
    const s = service.data;
    if (!s) fail("Service state is missing.", 503);
    const now = Date.now();
    const status = effectiveStatus(s, now);
    const control = await db.rpc("moderation_authorized", {
      p_admin: admin.id,
      p_session: admin.security_session_id,
      p_permission: "moderation:control",
    });
    const review = await db.rpc("moderation_authorized", {
      p_admin: admin.id,
      p_session: admin.security_session_id,
      p_permission: "moderation:review",
    });
    const degraded =
      !!failedCount.count || !!recentRecovery.count || s.recovery_attempts > 0;
    const base = Date.parse(
      s.last_refresh_at ||
        firstStarted.data?.created_at ||
        new Date(now).toISOString(),
    );
    return json({
      ok: true,
      serverTime: new Date(now).toISOString(),
      service: {
        ...s,
        status,
        error:
          status === "Error" && s.status === "Running"
            ? "Worker heartbeat is overdue. Inspect the scheduler and worker logs."
            : s.error,
      },
      connections: connections.data,
      canControl: !control.error && control.data === true,
      canReview: !review.error && review.data === true,
      jobs: jobs.data,
      decisions: decisions.data,
      history: history.data,
      counts: {
        queued: queuedCount.count,
        failed: failedCount.count,
        review: reviewCount.count,
      },
      maintenance: {
        recommendedAt: new Date(
          base + (degraded ? 1 : 7) * 86400000,
        ).toISOString(),
        reason:
          status === "Error"
            ? "Investigate the current error before maintenance."
            : degraded
              ? "Review within 24 hours because failures or recovery attempts were recorded."
              : "Weekly configuration and queue integrity refresh; daily worker restarts remain separate.",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const admin = await access("moderation:control");
    const input = await body(request);
    const action = String(input.action);
    if (
      !["start", "stop", "restart", "refresh"].includes(action) ||
      !Number.isSafeInteger(input.generation)
    )
      fail("Invalid command or service revision.");
    await attempt(admin, action);
    let proofHash: string | null = null;
    if (action !== "start") {
      if (
        typeof input.proof !== "string" ||
        !/^[a-f0-9]{64}$/.test(input.proof)
      )
        fail("Complete Authenticator verification first.", 403);
      proofHash = hash(input.proof);
      const proof = await db
        .from("moderation_proofs")
        .select("proof_hash")
        .eq("proof_hash", proofHash)
        .eq("admin_id", admin.id)
        .eq("session_id", admin.security_session_id)
        .eq("action", action)
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (proof.error || !proof.data) {
        await audit(admin, action, "proof_rejected");
        fail("Verification expired or was already used. Start again.", 403);
      }
      if (!(await verifyMainPassword(input.password))) {
        await db
          .from("moderation_proofs")
          .update({ consumed_at: new Date().toISOString() })
          .eq("proof_hash", proofHash);
        await audit(admin, action, "password_rejected");
        fail(
          "Main Admin password was rejected. Start verification again.",
          403,
        );
      }
      await audit(admin, action, "password_verified");
    }
    const { data, error } = await db.rpc("moderation_command", {
      p_admin: admin.id,
      p_session: admin.security_session_id,
      p_action: action,
      p_generation: input.generation,
      p_proof: proofHash,
    });
    if (error) {
      await audit(admin, action, "command_rejected");
      fail(
        "Command rejected: state changed, session expired or verification was already used. Refresh and try again.",
        409,
      );
    }
    return json({ ok: true, ...data });
  } catch (error) {
    return errorResponse(error);
  }
}
