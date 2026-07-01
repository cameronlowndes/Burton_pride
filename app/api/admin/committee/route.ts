import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from("admin_users")
      .select("role, is_active")
      .eq("supabase_user_id", user.id)
      .single();

    if (
      adminError ||
      !adminUser ||
      !adminUser.is_active ||
      adminUser.role !== "main_admin"
    ) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await req.json();

    const payload = {
      full_name: clean(body?.full_name),
      email: clean(body?.email) || null,
      role: clean(body?.role),
      pronouns: clean(body?.pronouns) || null,
      section_title: clean(body?.section_title) || "Committed Board",
      story_title: clean(body?.story_title) || null,
      story: clean(body?.story) || null,
      image_url: clean(body?.image_url) || null,
      display_order: Number(body?.display_order ?? 999),
      is_published:
        typeof body?.is_published === "boolean"
          ? body.is_published
          : true,
    };

    if (!payload.full_name || !payload.role) {
      return NextResponse.json(
        { ok: false, error: "Full name and role are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("committee_members")
      .insert(payload)
      .select(
        `
        id,
        full_name,
        email,
        image_url,
        role,
        pronouns,
        section_title,
        story_title,
        story,
        display_order,
        is_published
      `
      )
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to create member" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      member: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}