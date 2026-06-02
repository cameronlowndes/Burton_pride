import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { requireAdminPermission } from "@/lib/adminPermissions";

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

function cleanId(value: unknown) {
  return String(value || "").trim();
}

function cleanLabel(value: unknown) {
  return String(value || "").trim();
}

function cleanItemType(value: unknown) {
  return value === "group" ? "group" : "link";
}

function cleanParentId(value: unknown) {
  const parentId = String(value || "").trim();
  return parentId ? parentId : null;
}

function cleanSortOrder(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function cleanIcon(value: unknown) {
  const icon = String(value || "").trim();
  return icon ? icon : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    /*
      New permissions system:
      - Main admins automatically pass this check.
      - Other admins must have site_pages:manage enabled in Admin Users.
      - Editing sidebar items changes admin portal navigation.
    */
    await requireAdminPermission("site_pages:manage");

    const { id } = await params;
    const cleanItemId = cleanId(id);

    if (!cleanItemId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing sidebar item ID.",
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const label = cleanLabel(body.label);
    const href = normalizeHref(body.href);
    const itemType = cleanItemType(body.item_type);
    const parentId = cleanParentId(body.parent_id);
    const sortOrder = cleanSortOrder(body.sort_order);
    const isEnabled = cleanBoolean(body.is_enabled, true);
    const openInNewTab = cleanBoolean(body.open_in_new_tab, false);
    const icon = cleanIcon(body.icon);

    if (!label) {
      return NextResponse.json(
        {
          ok: false,
          error: "Label is required.",
        },
        { status: 400 }
      );
    }

    if (itemType === "link" && !href) {
      return NextResponse.json(
        {
          ok: false,
          error: "Link must have a URL.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("admin_sidebar_items")
      .update({
        label,
        href,
        item_type: itemType,
        parent_id: parentId,
        sort_order: sortOrder,
        is_enabled: isEnabled,
        open_in_new_tab: openInNewTab,
        icon,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cleanItemId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to update sidebar item.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      item: data,
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/sidebar/[id] error:", error);

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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    /*
      New permissions system:
      - Main admins automatically pass this check.
      - Other admins must have site_pages:manage enabled in Admin Users.
      - Deleting sidebar items changes admin portal navigation.
    */
    await requireAdminPermission("site_pages:manage");

    const { id } = await params;
    const cleanItemId = cleanId(id);

    if (!cleanItemId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing sidebar item ID.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("admin_sidebar_items")
      .delete()
      .eq("id", cleanItemId);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to delete sidebar item.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error: any) {
    console.error("DELETE /api/admin/sidebar/[id] error:", error);

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