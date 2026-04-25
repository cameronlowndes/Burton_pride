import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMainAdmin } from "@/lib/isMainAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await requireMainAdmin();

    const body = await req.json();

    const password = String(body.password || "").trim();
    const confirmPassword = String(body.confirmPassword || "").trim();

    if (!password || !confirmPassword) {
      return NextResponse.json(
        { ok: false, error: "Password and confirm password are required" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { ok: false, error: "Passwords do not match" },
        { status: 400 }
      );
    }

    if (password.length < 10) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 10 characters" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: existing } = await supabaseAdmin
      .from("admin_delete_settings")
      .select("id")
      .eq("action_key", "delete_all_donations")
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("admin_delete_settings")
        .update({
          password_hash: passwordHash,
          updated_at: new Date().toISOString(),
        })
        .eq("action_key", "delete_all_donations");

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }
    } else {
      const { error } = await supabaseAdmin
        .from("admin_delete_settings")
        .insert({
          action_key: "delete_all_donations",
          password_hash: passwordHash,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Main admin delete password updated successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
}