import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

async function requireAdmin() {
  const { userId } = await auth();

  if (!userId) {
    return { ok: false as const, error: "Unauthorized", status: 401 };
  }

  const { data: adminUser, error } = await supabaseAdmin
    .from("admin_users")
    .select("id, role, is_active, clerk_user_id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      error: `Admin lookup error: ${error.message}`,
      status: 500,
    };
  }

  if (!adminUser) {
    return {
      ok: false as const,
      error: `Admin user not found for Clerk ID: ${userId}`,
      status: 403,
    };
  }

  if (!adminUser.is_active) {
    return {
      ok: false as const,
      error: "Admin account is not active",
      status: 403,
    };
  }

  if (!["main_admin", "admin", "editor"].includes(adminUser.role)) {
    return {
      ok: false as const,
      error: "Admin role not allowed",
      status: 403,
    };
  }

  return { ok: true as const, userId };
}

export async function GET() {
  try {
    const admin = await requireAdmin();

    if (!admin.ok) {
      return NextResponse.json(
        { ok: false, error: admin.error },
        { status: admin.status }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("donations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
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
        error: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
}