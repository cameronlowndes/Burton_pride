import { NextRequest, NextResponse } from "next/server";

import { requireAdminPermission } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupporterStoryStatus = "approved" | "rejected" | "pending";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "Server error";
  }
}

function getAuthErrorStatus(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes("unauthorized") ||
    lower.includes("not signed") ||
    lower.includes("no user") ||
    lower.includes("session")
  ) {
    return 401;
  }

  return 403;
}

function normaliseSupporterStoryStatus(value: unknown): SupporterStoryStatus {
  if (value === "approved" || value === "rejected" || value === "pending") {
    return value;
  }

  return "pending";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    /**
     * Supabase auth only.
     * Clerk has been fully removed from this route.
     *
     * This route updates donation supporter-wall/story moderation,
     * so it should require donations:manage.
     */
    try {
      await requireAdminPermission("donations:manage");
    } catch (permissionError) {
      const message = getErrorMessage(permissionError);

      return NextResponse.json(
        {
          ok: false,
          error: message || "You do not have permission to update donations.",
        },
        { status: getAuthErrorStatus(message) },
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing donation ID.",
        },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid request body. Expected JSON.",
        },
        { status: 400 },
      );
    }

    const supporterStoryStatus = normaliseSupporterStoryStatus(
      (body as any).supporterStoryStatus,
    );

    const supporterWallApproved = Boolean(
      (body as any).supporterWallApproved,
    );

    const { data, error } = await supabaseAdmin
      .from("donations")
      .update({
        supporter_story_status: supporterStoryStatus,
        supporter_wall_approved: supporterWallApproved,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      donation: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}