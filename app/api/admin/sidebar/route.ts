import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { auth } from "@clerk/nextjs/server";

/**
 * Helper: normalize href (fix missing / issue)
 */
function normalizeHref(value: unknown) {
  if (!value) return null;

  const href = String(value).trim();
  if (!href) return null;

  if (
    href.startsWith("/") ||
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return href;
  }

  return `/${href}`;
}

/**
 * GET sidebar items
 */
export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabase = supabaseAdmin; // ✅ FIXED

  const { data, error } = await supabase
    .from("admin_sidebar_items")
    .select("*")
    .order("parent_id", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, items: data });
}

/**
 * CREATE sidebar item
 */
export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const supabase = supabaseAdmin; // ✅ FIXED

  const label = String(body.label || "").trim();
  const href = normalizeHref(body.href);
  const item_type = body.item_type === "group" ? "group" : "link";
  const parent_id =
    body.parent_id && String(body.parent_id).trim().length > 0
      ? String(body.parent_id)
      : null;
  const sort_order = Number(body.sort_order ?? 0);
  const is_enabled = Boolean(body.is_enabled ?? true);
  const icon = body.icon || null;

  if (!label) {
    return NextResponse.json(
      { ok: false, error: "Label is required" },
      { status: 400 }
    );
  }

  if (item_type === "link" && !href) {
    return NextResponse.json(
      { ok: false, error: "Link must have a URL" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("admin_sidebar_items")
    .insert({
      label,
      href,
      item_type,
      parent_id,
      sort_order,
      is_enabled,
      icon,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, item: data });
}