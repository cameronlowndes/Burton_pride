import { NextResponse } from "next/server";
import { getCurrentAdminPermissions } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALL_PERMISSION_KEYS = [
  "admin:dashboard:view",
  "admin:users:manage",

  "money:view",
  "money:add_transactions",
  "money:edit_transactions",
  "money:edit_old_years",
  "money:hide_transactions",
  "money:delete_all",
  "money:delete_year",
  "money:manage_year_locks",
  "money:manage_sponsors",
  "money:change_sponsor_totals",
  "money:sync_website_payments",
  "money:print_reports",
  "money:export_reports",

  "donations:view",
  "donations:manage",

  "raffle:view",
  "raffle:manage",
  "raffle:draw_winners",

  "site_pages:view",
  "site_pages:manage",

  "audit_logs:view",
];

function objectPermissionsToKeys(permissions: any) {
  if (!permissions) return [];

  if (Array.isArray(permissions)) {
    return permissions.filter((item) => typeof item === "string");
  }

  return Object.entries(permissions)
    .filter(([, allowed]) => allowed === true)
    .map(([key]) => key);
}

export async function GET() {
  try {
    const admin = await getCurrentAdminPermissions();

    if (!admin) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    let permissions =
      admin.role === "main_admin"
        ? ALL_PERMISSION_KEYS
        : objectPermissionsToKeys(admin.permissions);

    /*
      Safety default:
      Normal admins/editors must at least be able to land on the dashboard.
      Without this, they can get stuck in a redirect loop.
    */
    if (admin.role !== "main_admin" && !permissions.includes("admin:dashboard:view")) {
      permissions = ["admin:dashboard:view", ...permissions];
    }

    return NextResponse.json({
      ok: true,
      admin: {
        id: admin.id,
        clerk_user_id: admin.clerk_user_id,
        email: "email" in admin ? admin.email : null,
        role: admin.role,
        is_active: admin.is_active,
        permissions,
      },
      permissions,
    });
  } catch (error: any) {
    console.error("GET /api/admin/me/permissions error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load admin permissions.",
      },
      { status: 500 }
    );
  }
}