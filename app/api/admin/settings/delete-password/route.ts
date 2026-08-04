import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { requireMainAdmin } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTION_KEY = "delete_all_donations";

function statusFromError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (
    message.includes("unauthorized") ||
    message.includes("sign in") ||
    message.includes("session")
  ) {
    return 401;
  }

  if (
    message.includes("main admin") ||
    message.includes("permission") ||
    message.includes("access required")
  ) {
    return 403;
  }

  return 500;
}

function errorResponse(error: unknown, label: string) {
  const status = statusFromError(error);
  const message = error instanceof Error ? error.message : "Server error";

  console.error(label, error);

  return NextResponse.json(
    {
      ok: false,
      error: message,
      likelyFix:
        status === 401
          ? "Sign out and sign back in using /api/admin/settings/login so the Burton admin cookies are set."
          : status === 403
            ? "Your admin account must have role main_admin in admin_users."
            : "Check the Next.js terminal logs for the full server error.",
      details: {
        status,
        route: "/api/admin/settings/delete-password",
        actionKey: ACTION_KEY,
      },
    },
    { status }
  );
}

async function verifyDeletePassword(password: string) {
  const { data: setting, error } = await supabaseAdmin
    .from("admin_delete_settings")
    .select("password_hash")
    .eq("action_key", ACTION_KEY)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 500,
      error: "Failed to read admin_delete_settings.",
      likelyFix: "Check admin_delete_settings exists in Supabase.",
      details: error,
    };
  }

  if (!setting?.password_hash) {
    return {
      ok: false,
      status: 400,
      error:
        "No main admin delete password has been set yet. Please set one first.",
      likelyFix:
        "Go to Main Admin Delete Password and set/reset the password first.",
    };
  }

  const passwordMatches = await bcrypt.compare(password, setting.password_hash);

  if (!passwordMatches) {
    return {
      ok: false,
      status: 403,
      error: "Main admin password is wrong.",
      likelyFix: "Check the password and try again.",
    };
  }

  return {
    ok: true,
    status: 200,
  };
}

export async function POST(req: NextRequest) {
  try {
    await requireMainAdmin();

    const body = await req.json().catch(() => ({}));

    const password = String(
      body.password || body.mainAdminPassword || body.adminPassword || ""
    ).trim();

    const confirmPassword = String(
      body.confirmPassword || body.confirm_password || ""
    ).trim();

   
    const isPasswordCheckOnly = Boolean(password) && !confirmPassword;

    if (isPasswordCheckOnly) {
      const checked = await verifyDeletePassword(password);

      if (!checked.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: checked.error,
            likelyFix: checked.likelyFix,
            details: checked.details,
          },
          { status: checked.status }
        );
      }

      return NextResponse.json({
        ok: true,
        message: "Main admin password confirmed.",
      });
    }

    if (!password || !confirmPassword) {
      return NextResponse.json(
        {
          ok: false,
          error: "Password and confirm password are required.",
          likelyFix:
            "To reset the delete password, fill in both password fields. For money tracker month/year lock, send password only.",
          details: {
            receivedFields: Object.keys(body || {}),
            expectedForPasswordCheck: ["password"],
            expectedForPasswordReset: ["password", "confirmPassword"],
          },
        },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        {
          ok: false,
          error: "Passwords do not match.",
          likelyFix: "Make sure both password boxes are exactly the same.",
        },
        { status: 400 }
      );
    }

    if (password.length < 10) {
      return NextResponse.json(
        {
          ok: false,
          error: "Password must be at least 10 characters.",
          likelyFix: "Use a password with 10 or more characters.",
        },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("admin_delete_settings")
      .select("id")
      .eq("action_key", ACTION_KEY)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to check admin_delete_settings.",
          likelyFix:
            "Check Supabase table admin_delete_settings exists and has id, action_key and password_hash columns.",
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
          updated_at: now,
        })
        .eq("action_key", ACTION_KEY);

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to update admin_delete_settings.",
            likelyFix:
              "Check password_hash and updated_at columns exist in admin_delete_settings.",
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
          created_at: now,
          updated_at: now,
        });

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to insert admin_delete_settings.",
            likelyFix:
              "Check admin_delete_settings has action_key, password_hash, created_at and updated_at columns.",
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
    return errorResponse(error, "Delete password POST error:");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireMainAdmin();

    const body = await req.json().catch(() => ({}));

    const password = String(
      body.password || body.mainAdminPassword || body.adminPassword || ""
    ).trim();

    if (!password) {
      return NextResponse.json(
        {
          ok: false,
          error: "Main admin password is required.",
          likelyFix: "Enter the main admin delete password.",
        },
        { status: 400 }
      );
    }

    const checked = await verifyDeletePassword(password);

    if (!checked.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: checked.error,
          likelyFix: checked.likelyFix,
          details: checked.details,
        },
        { status: checked.status }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Main admin password confirmed.",
    });
  } catch (error) {
    return errorResponse(error, "Delete password PATCH error:");
  }
}

export async function GET() {
  try {
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
          error: "Failed to load delete password status.",
          likelyFix: "Check admin_delete_settings exists in Supabase.",
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
    return errorResponse(error, "Delete password GET error:");
  }
}