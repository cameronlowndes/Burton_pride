import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { requireAdminPermission } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReorderItem = {
  id: string;
  sort_order: number;
  parent_id: string | null;
};

function cleanId(value: unknown) {
  return String(value || "").trim();
}

function cleanSortOrder(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanParentId(value: unknown) {
  const parentId = String(value || "").trim();
  return parentId ? parentId : null;
}

export async function PATCH(req: NextRequest) {
  try {
    /*
      New permissions system:
      - Main admins automatically pass this check.
      - Other admins must have site_pages:manage enabled in Admin Users.
      - Reordering sidebar items changes the admin portal navigation.
    */
    await requireAdminPermission("site_pages:manage");

    const body = await req.json().catch(() => ({}));

    const items = Array.isArray(body.items)
      ? (body.items as ReorderItem[])
      : [];

    if (!items.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "No items provided",
        },
        { status: 400 }
      );
    }

    const cleanedItems = items
      .map((item) => ({
        id: cleanId(item.id),
        sort_order: cleanSortOrder(item.sort_order),
        parent_id: cleanParentId(item.parent_id),
      }))
      .filter((item) => item.id);

    if (!cleanedItems.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "No valid sidebar items provided",
        },
        { status: 400 }
      );
    }

    for (const item of cleanedItems) {
      const { error } = await supabaseAdmin
        .from("admin_sidebar_items")
        .update({
          sort_order: item.sort_order,
          parent_id: item.parent_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: error.message || "Failed to reorder sidebar items",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/sidebar/reorder error:", error);

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