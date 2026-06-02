import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const updates: Record<string, unknown> = {};

    if (typeof body?.is_read === "boolean") {
      updates.is_read = body.is_read;
    }

    if (
      typeof body?.status === "string" &&
      ["new", "in_progress", "done"].includes(body.status)
    ) {
      updates.status = body.status;
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json(
        {
          ok: false,
          error: "No valid fields supplied.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("volunteer_applications")
      .update(updates)
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to update volunteer application.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Volunteer application updated successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const { error } = await supabaseAdmin
      .from("volunteer_applications")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to delete volunteer application.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Volunteer application deleted successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}