import { auth } from "@clerk/nextjs/server";
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

  if (typeof permissions !== "object") {
    return [];
  }

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
    /*
      Check Clerk authentication first.

      This lets us clearly tell the difference between:
      1. The browser not having a valid Clerk login session.
      2. The user being signed in but missing from the Supabase admin table.
    */
    const { userId, sessionId } = await auth();

    console.log("GET /api/admin/me/permissions Clerk session check", {
      hasUserId: Boolean(userId),
      hasSessionId: Boolean(sessionId),
      userId: userId || null,
    });

    if (!userId || !sessionId) {
      return jsonResponse(
        {
          ok: false,
          error: "Unauthorized",
          reason: "missing_clerk_session",
          message:
            "No active Clerk login session was received by the permissions API.",
          likelyFix:
            "Sign out and sign back in. If this only happens on one device, check the Clerk production keys, Clerk domain configuration and browser session cookies.",
        },
        401
      );
    }

    const admin = await getCurrentAdminPermissions();

    if (!admin) {
      console.warn(
        "GET /api/admin/me/permissions could not find an active admin record",
        {
          clerkUserId: userId,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error: "Admin permissions could not be loaded",
          reason: "admin_record_missing_or_inactive",
          message:
            "You are signed in with Clerk, but no active admin permissions record could be found.",
          likelyFix:
            "Check the Supabase admin users table. Make sure it contains the Clerk production user ID for this account and that is_active is true.",
        },
        403
      );
    }

    let permissions =
      admin.role === "main_admin"
        ? ALL_PERMISSION_KEYS
        : objectPermissionsToKeys(admin.permissions);

    /*
      Safety default:
      Normal admins and editors must at least be able to open the dashboard.
      Without this, an account with incomplete permissions can get stuck in a
      redirect loop.
    */
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
        clerk_user_id: admin.clerk_user_id,
        email: "email" in admin ? admin.email : null,
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
          "Check the Vercel server logs and inspect lib/adminPermissions.ts.",
      },
      500
    );
  }
}