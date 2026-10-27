import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentAdmin } from "@/lib/adminPermissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const TABLE = "social_media_moderation_sidebar_items";
const COLUMNS = "id,label,href,icon,sort_order,is_enabled,created_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    Vary: "Cookie, Authorization",
  } });
}

async function database(req: NextRequest, mutation = false) {
  const current = await getCurrentAdmin();
  if (!current) throw new RequestError("Sign in with your admin account to manage the moderation sidebar.", 401);
  const admin = current as unknown as Record<string, unknown>;
  let permissions = admin.permissions;
  if (typeof permissions === "string") {
    try { permissions = JSON.parse(permissions); } catch { permissions = []; }
  }
  const canManage = admin.role === "main_admin" || admin.is_main_admin === true ||
    (Array.isArray(permissions) && permissions.includes("site_pages:manage")) ||
    (permissions !== null && typeof permissions === "object" &&
      !Array.isArray(permissions) && (permissions as Record<string, unknown>)["site_pages:manage"] === true);
  if (!canManage) throw new RequestError("You need the site_pages:manage permission or a Main Admin account to edit this menu.", 403);

  if (mutation) {
    if (req.headers.get("sec-fetch-site") === "cross-site") throw new RequestError("Cross-site menu changes are not allowed.", 403);
    const origin = req.headers.get("origin");
    if (origin && origin !== req.nextUrl.origin) throw new RequestError("The request origin does not match this website.", 403);
  }
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new RequestError("The server is missing its Supabase URL or service role key configuration.", 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

async function readBody(req: NextRequest) {
  const text = await req.text();
  if (text.length > 16384) throw new RequestError("The menu item request exceeds the 16 KB limit.", 413);
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new RequestError("The request body must contain valid JSON."); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new RequestError("Provide a menu item object.");
  return data as Record<string, unknown>;
}

function validateId(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new RequestError("A valid menu item ID is required.");
  return value;
}

function validatedFields(body: Record<string, unknown>, create = false) {
  const result: Record<string, string | number | boolean> = {};
  for (const field of ["label", "href", "icon"] as const) {
    if (!(field in body) && !create) continue;
    const value = body[field];
    if (typeof value !== "string" || !value.trim()) throw new RequestError(`Enter a non-empty ${field}.`);
    const cleaned = value.trim();
    if (cleaned.length > (field === "href" ? 2048 : 200)) throw new RequestError(`The ${field} is too long.`);
    if (field === "href") {
      if (!/^\/Admin(?:\/|$)/i.test(cleaned) || /[\\\u0000-\u0020]/.test(cleaned)) throw new RequestError("Use an internal admin path beginning with /Admin/.");
      const parsed = new URL(cleaned, "https://sidebar.invalid");
      if (parsed.origin !== "https://sidebar.invalid" || !/^\/Admin(?:\/|$)/i.test(parsed.pathname)) throw new RequestError("The menu URL must stay inside /Admin/.");
    }
    result[field] = cleaned;
  }
  if (create || "sort_order" in body) {
    const value = body.sort_order ?? 0;
    if (typeof value !== "number" || !Number.isInteger(value) || Math.abs(value) > 1000000) throw new RequestError("Sort order must be a whole number between -1000000 and 1000000.");
    result.sort_order = value;
  }
  if (create || "is_enabled" in body) {
    const value = body.is_enabled ?? true;
    if (typeof value !== "boolean") throw new RequestError("Enabled must be true or false.");
    result.is_enabled = value;
  }
  if (!Object.keys(result).length) throw new RequestError("No supported menu fields were supplied.");
  return result;
}

function failure(error: unknown) {
  if (error instanceof RequestError) return json({ ok: false, error: error.message }, error.status);
  const reference = crypto.randomUUID();
  console.error(`Moderation sidebar editor error ${reference}:`, error);
  return json({ ok: false, error: "The database operation failed. Try again or contact a Main Admin.", reference }, 500);
}

export async function GET(req: NextRequest) {
  try {
    const db = await database(req);
    const { data, error } = await db.from(TABLE).select(COLUMNS).eq("item_type", "link").is("parent_id", null)
      .order("sort_order").order("id");
    if (error) throw error;
    return json({ ok: true, items: data ?? [] });
  } catch (error) { return failure(error); }
}

export async function POST(req: NextRequest) {
  try {
    const db = await database(req, true);
    const body = await readBody(req);
    const fields = validatedFields(body, true);
    const { data, error } = await db.from(TABLE).insert({ ...fields, item_type: "link", parent_id: null })
      .select(COLUMNS).single();
    if (error) throw error;
    return json({ ok: true, item: data }, 201);
  } catch (error) { return failure(error); }
}

export async function PATCH(req: NextRequest) {
  try {
    const db = await database(req, true);
    const body = await readBody(req);
    const id = validateId(body.id);
    const fields = validatedFields(body);
    const { data, error } = await db.from(TABLE).update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id).eq("item_type", "link").is("parent_id", null).select(COLUMNS).maybeSingle();
    if (error) throw error;
    if (!data) throw new RequestError("This menu item no longer exists. Refresh the list before editing it.", 404);
    return json({ ok: true, item: data });
  } catch (error) { return failure(error); }
}

export async function DELETE(req: NextRequest) {
  try {
    const db = await database(req, true);
    const id = validateId(req.nextUrl.searchParams.get("id"));
    const { data, error } = await db.from(TABLE).delete().eq("id", id).eq("item_type", "link").is("parent_id", null)
      .select(COLUMNS).maybeSingle();
    if (error) throw error;
    return json({ ok: true, deletedId: id, deleted: data, already_deleted: !data });
  } catch (error) { return failure(error); }
}
