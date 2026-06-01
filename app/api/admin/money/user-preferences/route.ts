import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

function getUserName(user: Awaited<ReturnType<typeof currentUser>>) {
  if (!user) return "Unknown user";

  const fullName = `${user.firstName || ""} ${user.lastName || ""}`
    .replace(/\s+/g, " ")
    .trim();

  if (fullName) return fullName;

  const email = user.emailAddresses?.[0]?.emailAddress || "";

  if (email) {
    return email
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .trim();
  }

  return "Unknown user";
}

function getUserEmail(user: Awaited<ReturnType<typeof currentUser>>) {
  return user?.emailAddresses?.[0]?.emailAddress || null;
}

export async function GET() {
  try {
    const user = await currentUser();

    if (!user?.id) {
      return NextResponse.json(
        {
          error: "You must be signed in to load money tracker preferences.",
        },
        { status: 401 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("money_user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to load money tracker preferences.",
          details: error.message,
        },
        { status: 500 },
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
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await currentUser();

    if (!user?.id) {
      return NextResponse.json(
        {
          error: "You must be signed in to save money tracker preferences.",
        },
        { status: 401 },
      );
    }

    const body = (await request.json()) as PreferencePayload;

    const payload = {
      user_id: user.id,
      user_name: getUserName(user),
      user_email: getUserEmail(user),

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
        { status: 500 },
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
      { status: 500 },
    );
  }
}