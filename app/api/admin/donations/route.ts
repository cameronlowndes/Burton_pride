import { NextResponse } from "next/server";

import { requireAdminPermission } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "Server error";
  }
}

function getPermissionErrorStatus(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes("unauthorized") ||
    lower.includes("not signed") ||
    lower.includes("not signed in") ||
    lower.includes("no user") ||
    lower.includes("session") ||
    lower.includes("login")
  ) {
    return 401;
  }

  return 403;
}

export async function GET() {
  try {
    try {
      await requireAdminPermission("donations:manage");
    } catch (permissionError) {
      const message = getErrorMessage(permissionError);

      return NextResponse.json(
        {
          ok: false,
          error: message || "You do not have permission to view donations.",
        },
        { status: getPermissionErrorStatus(message) },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("donations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      donations: data || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}