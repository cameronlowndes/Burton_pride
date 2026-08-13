import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { getCurrentAdmin, hasPermission } from "@/lib/adminPermissions";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const allowed = await hasPermission("committee:edit" as any);

    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: "You do not have permission to edit committee members." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await req.json();

    const supabase = supabaseAdmin;

    const updateData = {
      full_name: body.full_name,
      email: body.email,
      image_url: body.image_url,
      role: body.role,
      pronouns: body.pronouns,
      section_title: body.section_title,
      story: body.story,
      display_order: body.display_order,
      is_published: body.is_published,
      image_position_x: body.image_position_x,
      image_position_y: body.image_position_y,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("committee_members")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Committee PATCH error:", error);
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to update committee member." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      member: data,
    });
  } catch (error) {
    console.error("Committee PATCH route error:", error);

    return NextResponse.json(
      { ok: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const allowed = await hasPermission("committee:edit" as any);

    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: "You do not have permission to delete committee members." },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    const supabase = supabaseAdmin;

    const { error } = await supabase
      .from("committee_members")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Committee DELETE error:", error);
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to delete committee member." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Committee member deleted successfully.",
    });
  } catch (error) {
    console.error("Committee DELETE route error:", error);

    return NextResponse.json(
      { ok: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}