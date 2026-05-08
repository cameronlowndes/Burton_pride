import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing transaction ID." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("money_transactions")
      .update({
        deleted_at: null,
        deleted_by: null,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to restore transaction.",
          details: error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      transaction: data,
      message: "Transaction restored successfully.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Something went wrong.",
      },
      { status: 500 }
    );
  }
}