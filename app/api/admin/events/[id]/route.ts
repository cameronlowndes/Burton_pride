import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function requireAdmin(req: Request) {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) return null;
  const got = req.headers.get("x-admin-token");
  if (got !== token) return "Unauthorized";
  return null;
}

// ✅ IMPORTANT: params is a Promise in your setup
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const denied = requireAdmin(req);
  if (denied) return jsonError(denied, 401);

  const { id } = await ctx.params;

  if (!id) return jsonError("Missing event id", 400);

  const { error } = await supabaseAdmin
    .from("events")
    .delete()
    .eq("id", id);

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ success: true });
}