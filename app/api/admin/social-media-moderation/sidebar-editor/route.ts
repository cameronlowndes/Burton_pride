import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/supabase/supabaseAdmin";
import { requireNavigationViewer, NavigationError } from "@/lib/moderation/navigation-server";
import { NAVIGATION_COLUMNS, MenuInputError, menuFields, menuId, reorderIds } from "@/lib/moderation/navigation-input";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
const TABLE = "social_media_moderation_sidebar_items";
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", Vary: "Cookie, Authorization",
  } });
}
async function authorize(req: NextRequest, mutation = false) {
  await requireNavigationViewer(true);
  if (mutation) {
    if (req.headers.get("sec-fetch-site") === "cross-site" ||
      (req.headers.get("origin") && req.headers.get("origin") !== req.nextUrl.origin)) {
      throw new MenuInputError("Menu changes must come from this website.", 403);
    }
  }
}
async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new MenuInputError("Send a JSON request.", 415);
  const text = await req.text();
  if (new TextEncoder().encode(text).length > 65536) throw new MenuInputError("The menu request exceeds 64 KB.", 413);
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new MenuInputError("The request must contain valid JSON."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MenuInputError("Provide a menu object.");
  return value as Record<string, unknown>;
}
function failure(error: unknown) {
  if (error instanceof NavigationError || error instanceof MenuInputError) return json({ ok: false, error: error.message }, error.status);
  const reference = crypto.randomUUID();
  console.error(`Moderation sidebar editor ${reference}`, error);
  return json({ ok: false, error: "The menu could not be saved or loaded. Check the navigation SQL update and try again.", reference }, 503);
}
export async function GET(req: NextRequest) {
  try {
    await authorize(req);
    const { data, error } = await db.from(TABLE).select(NAVIGATION_COLUMNS).eq("item_type", "link").is("parent_id", null).order("sort_order").order("id");
    if (error) throw error;
    return json({ ok: true, items: data ?? [] });
  } catch (error) { return failure(error); }
}
export async function POST(req: NextRequest) {
  try {
    await authorize(req, true);
    const fields = menuFields(await readBody(req), true);
    const { data, error } = await db.from(TABLE).insert({ ...fields, item_type: "link", parent_id: null }).select(NAVIGATION_COLUMNS).single();
    if (error) throw error;
    return json({ ok: true, item: data }, 201);
  } catch (error) { return failure(error); }
}
export async function PATCH(req: NextRequest) {
  try {
    await authorize(req, true);
    const body = await readBody(req);
    const id = menuId(body.id);
    const fields = menuFields(body);
    const { data, error } = await db.from(TABLE).update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id).eq("item_type", "link").is("parent_id", null).select(NAVIGATION_COLUMNS).maybeSingle();
    if (error) throw error;
    if (!data) throw new MenuInputError("This link no longer exists. Refresh the menu.", 404);
    return json({ ok: true, item: data });
  } catch (error) { return failure(error); }
}
/** One RPC transaction, including a stale-order check. Never issue per-row PATCH requests. */
export async function PUT(req: NextRequest) {
  try {
    await authorize(req, true);
    const body = await readBody(req);
    const orderedIds = reorderIds(body.orderedIds);
    const expectedOrder = reorderIds(body.expectedOrder);
    if (orderedIds.length !== expectedOrder.length || orderedIds.some((id) => !expectedOrder.includes(id))) {
      throw new MenuInputError("The new order must contain every current menu link exactly once.");
    }
    const { error } = await db.rpc("reorder_moderation_sidebar", { p_ordered_ids: orderedIds, p_expected_order: expectedOrder });
    if (error?.code === "40001") throw new MenuInputError("Another admin changed the menu order. Refresh and try again.", 409);
    if (error?.code === "22023") throw new MenuInputError("The menu changed or the order is invalid. Refresh and try again.", 409);
    if (error) throw error;
    return json({ ok: true });
  } catch (error) { return failure(error); }
}
export async function DELETE(req: NextRequest) {
  try {
    await authorize(req, true);
    const id = menuId(req.nextUrl.searchParams.get("id"));
    const { data, error } = await db.from(TABLE).delete().eq("id", id).eq("item_type", "link").is("parent_id", null).select("id").maybeSingle();
    if (error) throw error;
    return json({ ok: true, deletedId: id, already_deleted: !data });
  } catch (error) { return failure(error); }
}
