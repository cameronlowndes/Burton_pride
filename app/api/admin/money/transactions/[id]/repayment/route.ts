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

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing transaction ID" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const repaid = Boolean(body.repaid);

    const { data, error } = await supabaseAdmin
      .from("money_transactions")
      .update({
        personal_funds_repaid: repaid,
        personal_funds_repaid_at: repaid ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      transaction: data,
      message: repaid
        ? "Personal funds marked as paid back"
        : "Personal funds marked as not paid back",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}