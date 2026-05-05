import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMainAdmin } from "@/lib/isMainAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTION_KEY = "delete_all_donations";

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
        {
          ok: false,
          error: "Password and confirm password are required.",
        },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        {
          ok: false,
          error: "Passwords do not match.",
        },
        { status: 400 }
      );
    }

    if (password.length < 10) {
      return NextResponse.json(
        {
          ok: false,
          error: "Password must be at least 10 characters.",
        },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("admin_delete_settings")
      .select("id")
      .eq("action_key", ACTION_KEY)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          ok: false,
          error: existingError.message,
          details: existingError,
        },
        { status: 500 }
      );
    }

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("admin_delete_settings")
        .update({
          password_hash: passwordHash,
          updated_at: new Date().toISOString(),
        })
        .eq("action_key", ACTION_KEY);

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
    } else {
      const { error } = await supabaseAdmin
        .from("admin_delete_settings")
        .insert({
          action_key: ACTION_KEY,
          password_hash: passwordHash,
          updated_at: new Date().toISOString(),
        });

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
    }

    return NextResponse.json({
      ok: true,
      message: "Main admin delete password updated successfully.",
    });
  } catch (error) {
    console.error("Set main admin delete password error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await requireMainAdmin();

    const body = await req.json().catch(() => ({}));
    const password = String(body.password || "").trim();

    if (!password) {
      return NextResponse.json(
        {
          ok: false,
          error: "Main admin password is required.",
        },
        { status: 400 }
      );
    }

    const { data: setting, error: settingError } = await supabaseAdmin
      .from("admin_delete_settings")
      .select("password_hash")
      .eq("action_key", ACTION_KEY)
      .maybeSingle();

    if (settingError) {
      return NextResponse.json(
        {
          ok: false,
          error: settingError.message,
          details: settingError,
        },
        { status: 500 }
      );
    }

    if (!setting?.password_hash) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No main admin delete password has been set yet. Please set one first.",
        },
        { status: 400 }
      );
    }

    const passwordMatches = await bcrypt.compare(
      password,
      setting.password_hash
    );

    if (!passwordMatches) {
      return NextResponse.json(
        {
          ok: false,
          error: "Main admin password is wrong.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Main admin password confirmed.",
    });
  } catch (error) {
    console.error("Check main admin delete password error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await requireMainAdmin();

    const { data, error } = await supabaseAdmin
      .from("admin_delete_settings")
      .select("id, action_key, updated_at")
      .eq("action_key", ACTION_KEY)
      .maybeSingle();

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
      hasPassword: Boolean(data?.id),
      updatedAt: data?.updated_at || null,
      actionKey: ACTION_KEY,
    });
  } catch (error) {
    console.error("Get main admin delete password status error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
}