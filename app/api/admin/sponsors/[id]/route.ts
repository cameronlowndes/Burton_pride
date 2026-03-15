import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
      body?.status === "new" ||
      body?.status === "in_progress" ||
      body?.status === "done"
    ) {
      updates.status = body.status;
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json(
        { ok: false, error: "No valid updates provided" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("sponsor_applications")
      .update(updates)
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to update sponsor application",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Something went wrong",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const { error } = await supabaseAdmin
      .from("sponsor_applications")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to delete sponsor application",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Something went wrong",
      },
      { status: 500 }
    );
  }
}