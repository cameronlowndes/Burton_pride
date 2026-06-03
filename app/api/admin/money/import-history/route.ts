import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { requireMainAdmin } from "@/lib/isMainAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    .select("id, email, name, full_name, role, is_active")
    .eq("supabase_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError) {
    throw new Error(adminError.message || "Failed to load admin account.");
  }

  if (!admin) {
    throw new Error("No active admin account is linked to this Supabase user.");
  }

  const email = cleanText(admin.email || user.email) || null;

  const name =
    cleanText(admin.name) ||
    cleanText(admin.full_name) ||
    nameFromEmail(email);

  return {
    userId: user.id,
    name,
    email,
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

export async function GET() {
  try {
    await getCurrentAdmin();

    await requireMainAdmin();

    const { data, error } = await supabaseAdmin
      .from("money_import_batches")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Import history load error:", error);

      return NextResponse.json(
        {
          error: "Failed to load import history.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imports: data || [],
    });
  } catch (error) {
    console.error("Import history API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load import history.",
      },
      { status: errorStatus(error) }
    );
  }
}