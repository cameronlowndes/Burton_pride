import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { requireMainAdmin } from "@/lib/isMainAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

async function getCurrentAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("You must be signed in.");
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("admin_users")
    .select("id, email, role, is_active")
    .eq("supabase_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError) {
    throw new Error(adminError.message || "Failed to load admin account.");
  }

  if (!admin) {
    throw new Error("No active admin account is linked to this Supabase user.");
  }

  return {
    userId: user.id,
    adminId: admin.id,
    email: cleanText(admin.email || user.email) || null,
    role: admin.role,
  };
}

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message === "You must be signed in." ||
    message === "No active admin account is linked to this Supabase user."
  ) {
    return 401;
  }

  return 500;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    await getCurrentAdmin();

    await requireMainAdmin();

    const { id } = await params;

    const { data: batch, error: batchError } = await supabaseAdmin
      .from("money_import_batches")
      .select("*")
      .eq("id", id)
      .single();

    if (batchError) {
      console.error("Import batch load error:", batchError);

      return NextResponse.json(
        {
          error: "Import batch could not be found.",
          details: batchError.message,
        },
        { status: 404 }
      );
    }

    const { data: failedRows, error: failedRowsError } = await supabaseAdmin
      .from("money_import_failed_rows")
      .select("*")
      .eq("import_batch_id", id)
      .order("row_number", { ascending: true });

    if (failedRowsError) {
      console.error("Failed rows load error:", failedRowsError);

      return NextResponse.json(
        {
          error: "Failed to load failed rows.",
          details: failedRowsError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      batch,
      failedRows: failedRows || [],
    });
  } catch (error) {
    console.error("Import batch API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load import batch.",
      },
      { status: errorStatus(error) }
    );
  }
}