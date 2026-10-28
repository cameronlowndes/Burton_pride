import { NextRequest } from "next/server";
import {
  access,
  body,
  db,
  errorResponse,
  fail,
  json,
  sameOrigin,
} from "@/lib/moderation/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const admin = await access("moderation:review");
    const input = await body(request);
    if (
      typeof input.jobId !== "string" ||
      !/^[a-f0-9-]{36}$/.test(input.jobId) ||
      typeof input.note !== "string" ||
      input.note.trim().length < 5 ||
      input.note.length > 1000
    )
      fail("Enter a review note between 5 and 1000 characters.");
    const { data, error } = await db.rpc("moderation_record_review", {
      p_admin: admin.id,
      p_session: admin.security_session_id,
      p_job: input.jobId,
      p_note: input.note,
    });
    if (error || !data)
      fail(
        "Review could not be saved. It may already have been recorded. Refresh and try again.",
        409,
      );
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
