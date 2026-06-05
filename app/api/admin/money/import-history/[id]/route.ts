import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";
const SESSION_COOKIE = "burton_admin_session";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
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
    .select("id, email, role, is_active, permissions")
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

  return {
    userId: String(admin.id),
    adminId: String(admin.id),
    email: cleanText(admin.email || adminEmail) || null,
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

export async function GET(_request: Request, { params }: Params) {
  try {
    const admin = await getCurrentAdmin();

    if (!canViewImportHistory(admin)) {
      throw new Error(
        "Forbidden: you need main admin, audit logs, or money export reports permission to view import batch details."
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing import batch ID.",
        },
        { status: 400 }
      );
    }

    const { data: batch, error: batchError } = await supabaseAdmin
      .from("money_import_batches")
      .select("*")
      .eq("id", id)
      .single();

    if (batchError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Import batch could not be found.",
          details: batchError.message,
        },
        { status: batchError.code === "PGRST116" ? 404 : 500 }
      );
    }

    const { data: failedRows, error: failedRowsError } = await supabaseAdmin
      .from("money_import_failed_rows")
      .select("*")
      .eq("import_batch_id", id)
      .order("row_number", { ascending: true });

    if (failedRowsError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to load failed rows.",
          details: failedRowsError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      batch,
      failedRows: failedRows || [],
      admin: {
        id: admin.adminId,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load import batch.";

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