import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const allowedStatuses = ["new", "reviewed", "archived"] as const;
type FeedbackStatus = (typeof allowedStatuses)[number];

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const updates: {
      status?: FeedbackStatus;
      is_read?: boolean;
    } = {};

    if (typeof body?.status === "string") {
      if (!allowedStatuses.includes(body.status)) {
        return NextResponse.json(
          { ok: false, error: "Invalid status value" },
          { status: 400 }
        );
      }

      updates.status = body.status;
    }

    if (typeof body?.is_read === "boolean") {
      updates.is_read = body.is_read;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("feedback_messages")
      .update(updates)
      .eq("id", id)
      .select("id, name, email, message, status, is_read, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to update feedback" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      feedback: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const { error } = await supabaseAdmin
      .from("feedback_messages")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to delete feedback" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Feedback deleted successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}