import { requireModerationOperation, ModerationAccessError } from "@/lib/moderation/access";
import { NextRequest, NextResponse } from "next/server";
import { isPortalOrigin } from "@/lib/notifications/request-origin";
import { manualAdmin, manualDb } from "@/lib/moderation/manual-jobs-server";
import { reviewFields } from "@/lib/moderation/manual-job-input";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function POST(request: NextRequest) {
  if (
    !isPortalOrigin(request) ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return reply({ error: "Use the Admin Portal to record a review." }, 403);
  try {
    const admin = await requireModerationOperation("reviewManual");
    if (!admin)
      return reply(
        { error: "Sign in with an active Main Admin security session." },
        403,
      );
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 8000)
      return reply({ error: "Review note is too large." }, 413);
    let value: unknown;
    try {
      value = JSON.parse(body);
    } catch (error) {
    if (error instanceof ModerationAccessError) return reply({ error: error.message }, error.status);
      return reply({ error: "Invalid review." }, 400);
    }
    const parsed = reviewFields.safeParse(value);
    if (!parsed.success)
      return reply(
        { error: "Choose an outcome and add a note of 5–1,000 characters." },
        400,
      );
    if (parsed.data.expectedAdminId !== admin.id)
      return reply(
        {
          error:
            "The signed-in account changed. Reload before recording a review.",
        },
        409,
      );
    const { data, error } = await manualDb.rpc("moderation_manual_review", {
      p_admin: admin.id,
      p_session: admin.security_session_id,
      p_job: parsed.data.jobId,
      p_revision: parsed.data.revision,
      p_outcome: parsed.data.outcome,
      p_note: parsed.data.note,
    });
    if (error || !data)
      return reply(
        {
          error:
            "The review could not be confirmed. Refresh the job before trying again.",
        },
        503,
      );
    if (data.result === "conflict")
      return reply(
        {
          error:
            "This job was already reviewed or changed in another tab. Refresh to see its current state.",
        },
        409,
      );
    if (data.result === "not_found")
      return reply({ error: "Manual capture not found." }, 404);
    if (data.result !== "ok")
      return reply(
        {
          error:
            "Access changed or the review is invalid. Reload and try again.",
        },
        403,
      );
    return reply({ ok: true });
  } catch (error) {
    if (error instanceof ModerationAccessError) return reply({ error: error.message }, error.status);
    return reply({ error: "Manual review is temporarily unavailable." }, 503);
  }
}

