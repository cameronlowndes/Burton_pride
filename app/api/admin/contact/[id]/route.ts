import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type UpdateBody = {
  is_read?: boolean;
  status?: "new" | "in_progress" | "done";
};

function cleanStatus(value: unknown) {
  const v = String(value || "").trim();
  if (v === "new" || v === "in_progress" || v === "done") return v;
  return null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = (await req.json()) as UpdateBody;

    const updates: Record<string, unknown> = {};

    if (typeof body.is_read === "boolean") {
      updates.is_read = body.is_read;
    }

    if (body.status !== undefined) {
      const status = cleanStatus(body.status);
      if (!status) {
        return NextResponse.json(
          { ok: false, error: "Invalid status." },
          { status: 400 }
        );
      }
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No valid fields to update." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
     .from("contact_messages")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("PATCH contact error:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to update message." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: data,
    });
  } catch (error) {
    console.error("PATCH contact crash:", error);
    return NextResponse.json(
      { ok: false, error: "Server error." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const { error } = await supabaseAdmin
      .from("contact_messages")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("DELETE contact error:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to delete message." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE contact crash:", error);
    return NextResponse.json(
      { ok: false, error: "Server error." },
      { status: 500 }
    );
  }
}