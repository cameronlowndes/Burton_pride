import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";
const SESSION_COOKIE = "burton_admin_session";

type FailedRowInput = {
  row_number: number;
  error_message: string;
  row_data?: any;
};

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
    adminId: String(admin.id),
    name,
    email,
    role: admin.role,
    permissions: admin.permissions,
  };
}

function canCreateImportHistory(admin: {
  role: string | null;
  permissions: unknown;
}) {
  if (admin.role === "main_admin") return true;

  return (
    hasPermissionValue(admin.permissions, "money:export_reports") ||
    hasPermissionValue(admin.permissions, "audit_logs:view") ||
    hasPermissionValue(admin.permissions, "money:add_transactions")
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

function jsonError({
  status,
  error,
  details,
  likelyFix,
}: {
  status: number;
  error: string;
  details?: unknown;
  likelyFix?: string;
}) {
  return NextResponse.json(
    {
      ok: false,
      error,
      details,
      likelyFix,
    },
    { status }
  );
}

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin();

    if (!canCreateImportHistory(admin)) {
      throw new Error(
        "Forbidden: you need main admin, money export reports, audit logs, or add transactions permission to create import history."
      );
    }

    const body = await request.json().catch(() => ({}));

    const fileName = cleanText(body.fileName) || "Unknown CSV file";
    const importType = cleanText(body.importType) || "money_transactions";

    const totalRows = Number(body.totalRows || 0);
    const importedRows = Number(body.importedRows || 0);
    const failedRowsCount = Number(body.failedRows || 0);

    const totalMoneyInPence = Number(body.totalMoneyInPence || 0);
    const totalMoneyOutPence = Number(body.totalMoneyOutPence || 0);
    const netTotalPence =
      body.netTotalPence !== undefined
        ? Number(body.netTotalPence || 0)
        : totalMoneyInPence - totalMoneyOutPence;

    const failedRows: FailedRowInput[] = Array.isArray(body.failedRowDetails)
      ? body.failedRowDetails
      : [];

    const status =
      cleanText(body.status) ||
      (failedRowsCount > 0 || failedRows.length > 0
        ? "completed_with_errors"
        : "completed");

    const { data: batch, error: batchError } = await supabaseAdmin
      .from("money_import_batches")
      .insert({
        imported_by_user_id: admin.userId,
        imported_by_name: admin.name,
        imported_by_email: admin.email,

        file_name: fileName,
        import_type: importType,

        total_rows: totalRows,
        imported_rows: importedRows,
        failed_rows: failedRowsCount || failedRows.length,

        total_money_in_pence: totalMoneyInPence,
        total_money_out_pence: totalMoneyOutPence,
        net_total_pence: netTotalPence,

        status,
      })
      .select("*")
      .single();

    if (batchError) {
      console.error("Create import batch error:", batchError);

      return jsonError({
        status: 500,
        error: "Failed to create import history batch.",
        details: batchError.message,
        likelyFix:
          "Check money_import_batches table exists and has the expected columns.",
      });
    }

    if (failedRows.length > 0) {
      const failedRowsToInsert = failedRows.map((row) => ({
        import_batch_id: batch.id,
        row_number: Number(row.row_number || 0),
        error_message: cleanText(row.error_message) || "Unknown import error",
        row_data: row.row_data || {},
      }));

      const { error: failedRowsError } = await supabaseAdmin
        .from("money_import_failed_rows")
        .insert(failedRowsToInsert);

      if (failedRowsError) {
        console.error("Create failed rows error:", failedRowsError);

        return jsonError({
          status: 500,
          error:
            "Import batch was created, but failed rows could not be saved.",
          details: failedRowsError.message,
          likelyFix:
            "Check money_import_failed_rows table exists and has import_batch_id, row_number, error_message and row_data columns.",
        });
      }
    }

    await supabaseAdmin.from("admin_money_audit_logs").insert({
      action: "csv_import_history_created",
      transaction_title: `CSV import history - ${fileName}`,
      actor_user_id: admin.userId,
      actor_name: admin.name,
      actor_email: admin.email,
      created_by: admin.name,
      created_by_email: admin.email,
      metadata: {
        source: "csv_import_history",
        import_batch_id: batch.id,
        file_name: fileName,
        import_type: importType,
        total_rows: totalRows,
        imported_rows: importedRows,
        failed_rows: failedRowsCount || failedRows.length,
        total_money_in_pence: totalMoneyInPence,
        total_money_out_pence: totalMoneyOutPence,
        net_total_pence: netTotalPence,
      },
    });

    return NextResponse.json({
      ok: true,
      success: true,
      batch,
    });
  } catch (error) {
    console.error("Create import history batch API error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to save import history.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
        likelyFix:
          errorStatus(error) === 401
            ? "Log out and log back in so the custom admin cookies refresh."
            : errorStatus(error) === 403
              ? "Give this admin main_admin, money:export_reports, audit_logs:view, or money:add_transactions permission."
              : "Check server logs and database tables.",
      },
      { status: errorStatus(error) }
    );
  }
}
