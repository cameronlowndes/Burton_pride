import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("money_transactions")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to load hidden transactions.",
          details: error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      transactions: data || [],
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