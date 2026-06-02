import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

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
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    console.log("GET /api/admin/me/permissions Supabase Auth check", {
      hasUser: Boolean(user),
      userId: user?.id ?? null,
      email: user?.email ?? null,
      error: userError?.message ?? null,
    });

    if (userError || !user) {
      return jsonResponse(
        {
          ok: false,
          error: "Unauthorized",
          reason: "missing_supabase_session",
          message:
            "No active Supabase Auth login session was received by the permissions API.",
          likelyFix:
            "Sign out and sign back in using the new Supabase Auth login page.",
        },
        401
      );
    }

    const { data: admin, error: adminError } = await supabaseAdmin
      .from("admin_users")
      .select("*")
      .eq("supabase_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (adminError) {
      console.error("GET /api/admin/me/permissions database error:", adminError);

      return jsonResponse(
        {
          ok: false,
          error: adminError.message,
          reason: "admin_database_error",
          message:
            "The permissions API could not read the admin_users table.",
        },
        500
      );
    }

    if (!admin) {
      console.warn(
        "GET /api/admin/me/permissions could not find an active admin record",
        {
          supabaseUserId: user.id,
          email: user.email,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error: "Admin permissions could not be loaded",
          reason: "admin_record_missing_or_inactive",
          message:
            "You are signed in with Supabase Auth, but no active admin row is linked to this Supabase user ID.",
          likelyFix:
            "Check public.admin_users. Make sure supabase_user_id matches auth.users.id and is_active is true.",
          signedInEmail: user.email,
          supabaseUserId: user.id,
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
        supabase_user_id: admin.supabase_user_id,
        email: admin.email ?? user.email ?? null,
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
        message:
          "The permissions API crashed while checking the admin account.",
        likelyFix:
          "Check lib/supabase/server.ts, lib/supabaseAdmin.ts, and public.admin_users.",
      },
      500
    );
  }
}