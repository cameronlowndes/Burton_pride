import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  requireAdmin,
  requireAdminPermission,
} from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Helper: normalize href
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

function cleanBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const lowered = value.toLowerCase().trim();

    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }

  return fallback;
}

function cleanNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * GET sidebar items
 *
 * Any active admin can load sidebar items.
 * The sidebar component then hides links based on permissions.
 */
export async function GET() {
  try {
    await requireAdmin();

    const { data, error } = await supabaseAdmin
      .from("admin_sidebar_items")
      .select("*")
      .order("parent_id", { ascending: true, nullsFirst: true })
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to load sidebar items",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      items: data || [],
    });
  } catch (error: any) {
    console.error("GET /api/admin/sidebar error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message === "Unauthorized"
            ? "Unauthorized"
            : error?.message || "Forbidden",
      },
      { status: error?.message === "Unauthorized" ? 401 : 403 }
    );
  }
}

/**
 * CREATE sidebar item
 *
 * Only admins with Manage Site Pages can change sidebar/navigation.
 */
export async function POST(req: Request) {
  try {
    await requireAdminPermission("site_pages:manage");

    const body = await req.json().catch(() => ({}));

    const label = String(body.label || "").trim();
    const href = normalizeHref(body.href);
    const item_type = body.item_type === "group" ? "group" : "link";
    const parent_id =
      body.parent_id && String(body.parent_id).trim().length > 0
        ? String(body.parent_id)
        : null;

    const sort_order = cleanNumber(body.sort_order, 0);
    const is_enabled = cleanBoolean(body.is_enabled, true);
    const open_in_new_tab = cleanBoolean(body.open_in_new_tab, false);
    const icon = body.icon ? String(body.icon).trim() : null;

    if (!label) {
      return NextResponse.json(
        {
          ok: false,
          error: "Label is required",
        },
        { status: 400 }
      );
    }

    if (item_type === "link" && !href) {
      return NextResponse.json(
        {
          ok: false,
          error: "Link must have a URL",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("admin_sidebar_items")
      .insert({
        label,
        href,
        item_type,
        parent_id,
        sort_order,
        is_enabled,
        open_in_new_tab,
        icon,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to create sidebar item",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      item: data,
    });
  } catch (error: any) {
    console.error("POST /api/admin/sidebar error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message === "Unauthorized"
            ? "Unauthorized"
            : error?.message || "Forbidden",
      },
      { status: error?.message === "Unauthorized" ? 401 : 403 }
    );
  }
}