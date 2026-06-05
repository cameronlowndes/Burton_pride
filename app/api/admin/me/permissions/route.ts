import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";
const SESSION_COOKIE = "burton_admin_session";

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
  "money:manage_refunds",

  "donations:view",
  "donations:manage",

  "raffle:view",
  "raffle:manage",
  "raffle:draw_winners",

  "site_pages:view",
  "site_pages:manage",

  "audit_logs:view",
];

function objectPermissionsToKeys(permissions: unknown): string[] {
  if (!permissions) return [];

  if (Array.isArray(permissions)) {
    return permissions.filter(
      (item): item is string => typeof item === "string"
    );
  }

  if (typeof permissions !== "object") return [];

  return Object.entries(permissions)
    .filter(([, allowed]) => allowed === true)
    .map(([key]) => key);
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET() {
  try {
    const cookieStore = await cookies();

    const adminId = cookieStore.get(ADMIN_ID_COOKIE)?.value || "";
    const adminEmail = cookieStore.get(ADMIN_EMAIL_COOKIE)?.value || "";
    const sessionToken = cookieStore.get(SESSION_COOKIE)?.value || "";

    if (!adminId || !adminEmail || !sessionToken) {
      return jsonResponse(
        {
          ok: false,
          error: "Unauthorized",
          reason: "missing_custom_admin_session",
          message:
            "No active Burton Pride admin session was received by the permissions API.",
          likelyFix:
            "Sign out and sign back in using the Admin Portal login page.",
        },
        401
      );
    }

    const { data: admin, error: adminError } = await supabaseAdmin
      .from("admin_users")
      .select("*")
      .eq("id", adminId)
      .eq("email", adminEmail)
      .eq("is_active", true)
      .maybeSingle();

    if (adminError) {
      console.error("GET /api/admin/me/permissions database error:", adminError);

      return jsonResponse(
        {
          ok: false,
          error: adminError.message,
          reason: "admin_database_error",
          message: "The permissions API could not read the admin_users table.",
        },
        500
      );
    }

    if (!admin) {
      return jsonResponse(
        {
          ok: false,
          error: "Admin permissions could not be loaded",
          reason: "admin_record_missing_or_inactive",
          message:
            "Your admin session exists, but no active admin row was found for that account.",
          likelyFix:
            "Check public.admin_users. Make sure id and email match the login cookies and is_active is true.",
          adminId,
          adminEmail,
        },
        403
      );
    }

    let permissions =
      admin.role === "main_admin"
        ? ALL_PERMISSION_KEYS
        : objectPermissionsToKeys(admin.permissions);

    if (
      admin.role !== "main_admin" &&
      !permissions.includes("admin:dashboard:view")
    ) {
      permissions = ["admin:dashboard:view", ...permissions];
    }

    return jsonResponse({
      ok: true,
      admin: {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name ?? null,
        role: admin.role,
        is_active: admin.is_active,
        permissions,
      },
      permissions,
    });
  } catch (error: unknown) {
    console.error("GET /api/admin/me/permissions error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to load admin permissions.";

    return jsonResponse(
      {
        ok: false,
        error: message,
        reason: "unexpected_permissions_api_error",
        message: "The permissions API crashed while checking the admin account.",
        likelyFix:
          "Check the cookies set by /api/admin/login and check public.admin_users.",
      },
      500
    );
  }
}