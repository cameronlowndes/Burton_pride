import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const authData = await auth();

    if (!authData.userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Not authenticated",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);

    const transactionId = searchParams.get("transactionId");
    const action = searchParams.get("action");
    const limitRaw = Number(searchParams.get("limit") || 100);

    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 250)
      : 100;

    let query = supabaseAdmin
      .from("admin_money_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (transactionId) {
      query = query.eq("transaction_id", transactionId);
    }

    if (action && action !== "all") {
      query = query.eq("action", action);
    }

    const { data, error } = await query;

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
      logs: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load money audit logs",
      },
      { status: 500 }
    );
  }
}