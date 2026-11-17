import { NextRequest, NextResponse } from "next/server";
import { developmentAccess, developmentDb as db, validRequestId } from "@/lib/development-requests/server";
import { normalizeRequest, normalizePriority, normalizeStatus, requestStatuses, requestPriorities } from "@/lib/development-requests/model";
import { ModerationAccessError } from "@/lib/moderation/access";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" } }); }
function failure(error: unknown) {
  if (error instanceof ModerationAccessError) return reply({ error: error.message }, error.status);
  console.error("Development request operation failed", error);
  return reply({ error: "This development request could not be loaded or saved. Check the Development Requests SQL update and try again." }, 503);
}
async function read(id: string) {
  const result = await db.from("admin_development_requests").select("*").eq("id", id).maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}
function name(row: Record<string, unknown>) { return String(row.username || row.name || row.full_name || row.email || "Admin"); }
export async function GET(_request: NextRequest, context: Context) {
  try {
    await developmentAccess();
    const { id } = await context.params;
    if (!validRequestId(id)) return reply({ error: "Invalid development request ID." }, 400);
    const row = await read(id);
    if (!row) return reply({ error: "Development request not found." }, 404);
    const result = await db.from("admin_users").select("*").eq("is_active", true);
    if (result.error) throw result.error;
    // Optional profile fields are mapped on the server, never requested as required columns.
    const admins = (result.data ?? []).map((admin) => ({ id: admin.id, name: name(admin), email: admin.email || "", role: admin.role }));
    const assigned = admins.find((admin) => admin.id === row.assigned_admin_id);
    return reply({ request: { ...normalizeRequest(row), assigned_admin_name: assigned?.name ?? row.assigned_to_name ?? null, assigned_admin_email: assigned?.email ?? null }, admins, history: [] });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: NextRequest, context: Context) {
  try {
    await developmentAccess();
    if (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site") return reply({ error: "Use the Admin Portal to save this request." }, 403);
    const { id } = await context.params;
    if (!validRequestId(id)) return reply({ error: "Invalid development request ID." }, 400);
    const text = await request.text();
    if (Buffer.byteLength(text) > 65536) return reply({ error: "The update is too large." }, 413);
    let body: Record<string, unknown>;
    try { const value: unknown = JSON.parse(text); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); body = value as Record<string, unknown>; }
    catch { return reply({ error: "Invalid request body." }, 400); }
    const row = await read(id);
    if (!row) return reply({ error: "Development request not found." }, 404);
    const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("status" in body) {
      if (![...requestStatuses, "pending", "in_progress"].some((value) => value === body.status)) return reply({ error: "Invalid request status." }, 400);
      changes.status = normalizeStatus(body.status);
      changes.completed_at = changes.status === "completed" ? row.completed_at || new Date().toISOString() : null;
    }
    if ("priority" in body) {
      if (![...requestPriorities, "critical"].some((value) => value === body.priority)) return reply({ error: "Invalid request priority." }, 400);
      changes.priority = normalizePriority(body.priority);
    }
    if ("admin_notes" in body) {
      if (body.admin_notes !== null && (typeof body.admin_notes !== "string" || body.admin_notes.length > 12000)) return reply({ error: "Notes must be text up to 12,000 characters." }, 400);
      changes.admin_notes = typeof body.admin_notes === "string" ? body.admin_notes.trim() || null : null;
    }
    if ("assigned_admin_id" in body) {
      if (body.assigned_admin_id === null || body.assigned_admin_id === "") { changes.assigned_admin_id = null; changes.assigned_to_name = null; }
      else {
        if (!validRequestId(body.assigned_admin_id)) return reply({ error: "Choose a valid administrator." }, 400);
        const selected = await db.from("admin_users").select("*").eq("id", body.assigned_admin_id).eq("is_active", true).maybeSingle();
        if (selected.error) throw selected.error;
        if (!selected.data) return reply({ error: "That active administrator could not be found." }, 400);
        changes.assigned_admin_id = selected.data.id; changes.assigned_to_name = name(selected.data);
      }
    }
    if (Object.keys(changes).length === 1) return reply({ error: "No supported changes were supplied." }, 400);
    const result = await db.from("admin_development_requests").update(changes).eq("id", id).select("*").maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return reply({ error: "The request no longer exists. Refresh the page." }, 404);
    return reply({ success: true, ok: true, request: normalizeRequest(result.data), message: "Development request updated successfully." });
  } catch (error) { return failure(error); }
}
