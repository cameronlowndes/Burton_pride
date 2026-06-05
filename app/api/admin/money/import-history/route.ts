import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";
const SESSION_COOKIE = "burton_admin_session";

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function nameFromEmail(email?: string | null) {
  const cleanEmail = cleanText(email);

  if (!cleanEmail || !cleanEmail.includes("@")) {
    return "Admin";
  }

  return cleanEmail
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter: string) => letter.toUpperCase())
    .trim();
}

function hasPermissionValue(permissions: unknown, permissionKey: string) {
  if (!permissions) return false;

  if (Array.isArray(permissions)) {
    return permissions.map(String).includes(permissionKey);
  }

  if (typeof permissions === "object") {
    return (permissions as Record<string, unknown>)[permissionKey] === true;
  }

  return false;
}

async function getCurrentAdmin() {
  const cookieStore = await cookies();

  const adminId = cookieStore.get(ADMIN_ID_COOKIE)?.value || "";
  const adminEmail = cookieStore.get(ADMIN_EMAIL_COOKIE)?.value || "";
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value || "";

  if (!adminId || !adminEmail || !sessionToken) {
    throw new Error("You must be signed in.");
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("admin_users")
    .select("id, email, name, full_name, role, is_active, permissions")
    .eq("id", adminId)
    .eq("email", adminEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError) {
    throw new Error(adminError.message || "Failed to load admin account.");
  }

  if (!admin) {
    throw new Error("No active admin account is linked to this admin session.");
  }

  const email = cleanText(admin.email || adminEmail) || null;

  const name =
    cleanText(admin.name) ||
    cleanText(admin.full_name) ||
    nameFromEmail(email);

  return {
    userId: String(admin.id),
    name,
    email,
    role: admin.role,
    permissions: admin.permissions,
  };
}

function canViewImportHistory(admin: {
  role: string | null;
  permissions: unknown;
}) {
  if (admin.role === "main_admin") return true;

  return (
    hasPermissionValue(admin.permissions, "audit_logs:view") ||
    hasPermissionValue(admin.permissions, "money:export_reports")
  );
}

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message === "You must be signed in." ||
    message === "No active admin account is linked to this admin session."
  ) {
    return 401;
  }

  if (message.startsWith("Forbidden")) {
    return 403;
  }

  return 500;
}

export async function GET() {
  try {
    const admin = await getCurrentAdmin();

    if (!canViewImportHistory(admin)) {
      throw new Error(
        "Forbidden: you need main admin, audit logs, or money export reports permission to view import history."
      );
    }

    const { data, error } = await supabaseAdmin
      .from("money_import_batches")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Import history load error:", error);

      return NextResponse.json(
        {
          ok: false,
          error: "Failed to load import history.",
          details: error.message,
          likelyFix:
            "Check the money_import_batches table exists and has the expected columns.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      imports: data || [],
      admin: {
        id: admin.userId,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Import history API error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to load import history.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
        likelyFix:
          errorStatus(error) === 401
            ? "Log out and log back in so the custom admin cookies refresh."
            : errorStatus(error) === 403
              ? "Give this admin main_admin role, audit_logs:view, or money:export_reports permission."
              : "Check the server logs and database table.",
      },
      { status: errorStatus(error) }
    );
  }
}
