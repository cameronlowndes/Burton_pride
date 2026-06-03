import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PreferencePayload = {
  selected_year?: string;
  selected_view_month?: string;
  selected_print_month?: string;
  search_term?: string;
  filter?: string;
  selected_sponsor_id?: string;
  selected_payment_method?: string;
  quick_filter?: string;
  visible_columns?: Record<string, boolean>;
};

type CurrentAdmin = {
  userId: string;
  userName: string;
  userEmail: string | null;
};

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function nameFromEmail(email?: string | null) {
  const cleanEmail = cleanString(email);

  if (!cleanEmail || !cleanEmail.includes("@")) {
    return "";
  }

  return cleanEmail
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

async function getCurrentAdmin(): Promise<CurrentAdmin> {
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

  const userEmail = cleanString(admin.email || user.email) || null;

  const userName =
    cleanString(admin.name) ||
    cleanString(admin.full_name) ||
    nameFromEmail(userEmail) ||
    "Unknown admin";

  return {
    userId: user.id,
    userName,
    userEmail,
  };
}

function getAuthErrorStatus(error: unknown) {
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
    const { userId } = await getCurrentAdmin();

    const { data, error } = await supabaseAdmin
      .from("money_user_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to load money tracker preferences.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      preferences: data || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected error loading money tracker preferences.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: getAuthErrorStatus(error) }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId, userName, userEmail } = await getCurrentAdmin();

    const body = (await request.json()) as PreferencePayload;

    const payload = {
      user_id: userId,
      user_name: userName,
      user_email: userEmail,

      selected_year: body.selected_year || null,
      selected_view_month: body.selected_view_month || "all",
      selected_print_month: body.selected_print_month || "all",
      search_term: body.search_term || "",
      filter: body.filter || "all",
      selected_sponsor_id: body.selected_sponsor_id || "all",
      selected_payment_method: body.selected_payment_method || "all",
      quick_filter: body.quick_filter || "all",
      visible_columns: body.visible_columns || {},

      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("money_user_preferences")
      .upsert(payload, {
        onConflict: "user_id",
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to save money tracker preferences.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      preferences: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected error saving money tracker preferences.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: getAuthErrorStatus(error) }
    );
  }
}