import { requireModerationOperation, ModerationAccessError } from "@/lib/moderation/access";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isPortalOrigin } from "@/lib/notifications/request-origin";
import { manualAdmin, manualDb } from "@/lib/moderation/manual-jobs-server";
import { manualFields } from "@/lib/moderation/manual-job-input";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET() {
  try {
    const admin = await requireModerationOperation("createManual");
    return admin
      ? reply({ adminId: admin.id })
      : reply(
          { error: "Sign in with an active Main Admin security session." },
          403,
        );
  } catch (error) {
    if (error instanceof ModerationAccessError) return reply({ error: error.message }, error.status);
    return reply(
      {
        error:
          "Manual jobs are unavailable. Check the manual-jobs SQL installation.",
      },
      503,
    );
  }
}
export async function POST(request: NextRequest) {
  if (
    !isPortalOrigin(request) ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return reply(
      { error: "Use the Admin Portal to create a manual job." },
      403,
    );
  try {
    const admin = await requireModerationOperation("createManual");
    if (!admin)
      return reply(
        { error: "Sign in with an active Main Admin security session." },
        403,
      );
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 65536)
      return reply({ error: "This report is too large." }, 413);
    let value: unknown;
    try {
      value = JSON.parse(body);
    } catch (error) {
    if (error instanceof ModerationAccessError) return reply({ error: error.message }, error.status);
      return reply({ error: "Invalid report." }, 400);
    }
    const envelope = z
      .object({
        expectedAdminId: z.string().uuid(),
        requestId: z.string().uuid(),
        report: manualFields,
      })
      .strict()
      .safeParse(value);
    if (!envelope.success)
      return reply(
        {
          error: "Check the highlighted fields.",
          fields: Object.fromEntries(
            envelope.error.issues.map((i) => [
              String(i.path.at(-1)),
              i.message,
            ]),
          ),
        },
        400,
      );
    if (envelope.data.expectedAdminId !== admin.id)
      return reply(
        {
          error:
            "The signed-in account changed. Reload before saving this report.",
        },
        409,
      );
    const { data, error } = await manualDb.rpc("moderation_manual_create", {
      p_admin: admin.id,
      p_session: admin.security_session_id,
      p_request: envelope.data.requestId,
      p_input: envelope.data.report,
    });
    if (error || !data)
      return reply(
        {
          error:
            "The save could not be confirmed. Keep this form open and retry with the same report.",
        },
        503,
      );
    if (data.result === "duplicate")
      return reply(
        {
          error:
            "An open manual report already exists for this comment. No additional report was saved.",
          existingJobId: data.jobId,
        },
        409,
      );
    if (data.result === "conflict")
      return reply(
        {
          error:
            "This request already saved a different report. Reload before creating another job.",
        },
        409,
      );
    if (data.result === "rate_limited")
      return reply(
        {
          error:
            "The limit is 30 new manual reports per administrator per hour. Review existing jobs before adding more.",
        },
        429,
      );
    if (data.result === "forbidden")
      return reply(
        {
          error:
            "Your security session expired or access changed. Sign in again.",
        },
        403,
      );
    if (data.result !== "ok")
      return reply(
        { error: "Check the comment text, reason and source details." },
        400,
      );
    return reply(
      {
        jobId: data.jobId,
        relatedJobId: data.relatedJobId ?? null,
        replayed: !!data.replayed,
      },
      data.replayed ? 200 : 201,
    );
  } catch (error) {
    if (error instanceof ModerationAccessError) return reply({ error: error.message }, error.status);
    return reply(
      {
        error:
          "Manual jobs are temporarily unavailable. Keep the form open and try again.",
      },
      503,
    );
  }
}

