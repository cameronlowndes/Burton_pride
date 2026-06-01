import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

    const payload =
      action === "lock"
        ? {
            year,
            is_locked: true,
            locked_at: new Date().toISOString(),
            locked_by: "Main admin",
            updated_at: new Date().toISOString(),
          }
        : {
            year,
            is_locked: false,
            unlocked_at: new Date().toISOString(),
            unlocked_by: "Main admin",
            updated_at: new Date().toISOString(),
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