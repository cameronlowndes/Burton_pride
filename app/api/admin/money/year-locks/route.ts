import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("money_year_locks")
      .select("*")
      .order("year", { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      locks: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load year locks.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJson(req);

    const year = String(body.year || "").trim();
    const action = String(body.action || "").trim();

    if (!year) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing year.",
        },
        { status: 400 }
      );
    }

    if (action !== "lock" && action !== "unlock") {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid lock action.",
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const payload = {
      year,
      is_locked: action === "lock",
      locked_at: action === "lock" ? now : null,
      locked_by: action === "lock" ? "Main admin" : null,
      unlocked_at: action === "unlock" ? now : null,
      unlocked_by: action === "unlock" ? "Main admin" : null,
      updated_at: now,
    };

    const { data, error } = await supabaseAdmin
      .from("money_year_locks")
      .upsert(payload, {
        onConflict: "year",
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      lock: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update year lock.",
      },
      { status: 500 }
    );
  }
}