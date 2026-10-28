import { NextRequest } from "next/server";
import {
  access,
  attempt,
  body,
  errorResponse,
  fail,
  json,
  sameOrigin,
  verifyTotp,
} from "@/lib/moderation/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const admin = await access("moderation:control");
    const input = await body(request);
    if (!["stop", "restart", "refresh"].includes(String(input.action)))
      fail("Invalid action.");
    await attempt(admin, String(input.action));
    const proof = await verifyTotp(admin, String(input.action), input.code);
    return json({ ok: true, proof, expiresIn: 120 });
  } catch (error) {
    return errorResponse(error);
  }
}
