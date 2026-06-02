import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { requireAdminPermission } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value || "").trim();
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

function cleanItemType(value: unknown) {
  return value === "dropdown" ? "dropdown" : "link";
}

function cleanParentId(value: unknown) {
  const parentId = clean(value);
  return parentId ? parentId : null;
}

function normalizeHref(value: unknown, itemType: "link" | "dropdown") {
  if (itemType === "dropdown") return null;

  const href = clean(value);
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

async function requireNavbarAccess() {
  /*
    New permissions system:
    - Main admins automatically pass this check.
    - Other admins must have site_pages:manage enabled in Admin Users.
    - This replaces the old hardcoded email-only main admin check.
  */
  await requireAdminPermission("site_pages:manage");
}

export async function GET() {
  try {
    await requireNavbarAccess();

    const { data, error } = await supabaseAdmin
      .from("site_nav_items")
      .select("*")
      .order("parent_id", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      items: data || [],
    });
  } catch (error: any) {
    console.error("GET /api/admin/navbar error:", error);

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

export async function POST(req: NextRequest) {
  try {
    await requireNavbarAccess();

    const body = await req.json().catch(() => ({}));

    const label = clean(body.label);
    const itemType = cleanItemType(body.item_type);
    const href = normalizeHref(body.href, itemType);
    const parentId = cleanParentId(body.parent_id);
    const sortOrder = cleanNumber(body.sort_order, 0);
    const isEnabled = cleanBoolean(body.is_enabled, true);
    const openInNewTab = cleanBoolean(body.open_in_new_tab, false);

    if (!label) {
      return NextResponse.json(
        {
          ok: false,
          error: "Label is required",
        },
        { status: 400 }
      );
    }

    if (itemType === "link" && !href) {
      return NextResponse.json(
        {
          ok: false,
          error: "Href is required for link items",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("site_nav_items")
      .insert({
        label,
        href,
        item_type: itemType,
        parent_id: parentId,
        sort_order: sortOrder,
        is_enabled: isEnabled,
        open_in_new_tab: openInNewTab,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      item: data,
    });
  } catch (error: any) {
    console.error("POST /api/admin/navbar error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message === "Unauthorized"
            ? "Unauthorized"
            : error?.message || "Failed to create navbar item",
      },
      { status: error?.message === "Unauthorized" ? 401 : 403 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireNavbarAccess();

    const body = await req.json().catch(() => ({}));

    const id = clean(body.id);
    const label = clean(body.label);
    const itemType = cleanItemType(body.item_type);
    const href = normalizeHref(body.href, itemType);
    const parentId = cleanParentId(body.parent_id);
    const sortOrder = cleanNumber(body.sort_order, 0);
    const isEnabled = cleanBoolean(body.is_enabled, false);
    const openInNewTab = cleanBoolean(body.open_in_new_tab, false);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Item id is required",
        },
        { status: 400 }
      );
    }

    if (!label) {
      return NextResponse.json(
        {
          ok: false,
          error: "Label is required",
        },
        { status: 400 }
      );
    }

    if (itemType === "link" && !href) {
      return NextResponse.json(
        {
          ok: false,
          error: "Href is required for link items",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("site_nav_items")
      .update({
        label,
        href,
        item_type: itemType,
        parent_id: parentId,
        sort_order: sortOrder,
        is_enabled: isEnabled,
        open_in_new_tab: openInNewTab,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      item: data,
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/navbar error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message === "Unauthorized"
            ? "Unauthorized"
            : error?.message || "Failed to update navbar item",
      },
      { status: error?.message === "Unauthorized" ? 401 : 403 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireNavbarAccess();

    const body = await req.json().catch(() => ({}));
    const id = clean(body.id);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Item id is required",
        },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("site_nav_items")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error: any) {
    console.error("DELETE /api/admin/navbar error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message === "Unauthorized"
            ? "Unauthorized"
            : error?.message || "Failed to delete navbar item",
      },
      { status: error?.message === "Unauthorized" ? 401 : 403 }
    );
  }
}
