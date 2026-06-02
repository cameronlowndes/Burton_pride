import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export async function PATCH(req: Request) {
  try {
    const body = await req.json();

    const {
      id,
      title,
      status,
      is_enabled,
      show_in_nav,
      nav_label,
      template,
      sort_order,
      hidden_title,
      hidden_message,
      coming_soon_title,
      coming_soon_message,
      locked_title,
      locked_message,
      password_protected,
      page_password,
    } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing page id" },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin;

    const updatePayload: Record<string, unknown> = {
      title,
      status,
      is_enabled,
      show_in_nav,
      nav_label: nav_label || null,
      template: template || null,
      sort_order: Number(sort_order || 0),
      hidden_title: hidden_title || null,
      hidden_message: hidden_message || null,
      coming_soon_title: coming_soon_title || null,
      coming_soon_message: coming_soon_message || null,
      locked_title: locked_title || null,
      locked_message: locked_message || null,
      password_protected: !!password_protected,
      updated_at: new Date().toISOString(),
    };

    if (typeof page_password === "string" && page_password.trim()) {
      updatePayload.page_password = page_password.trim();
    }

    const { data: updated, error } = await admin
      .from("site_pages")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    if (updated?.route) {
      revalidatePath(updated.route);
    }

    revalidatePath("/");
    revalidatePath("/page-status");

    return NextResponse.json({
      ok: true,
      page: updated,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to update page",
      },
      { status: 500 }
    );
  }
}