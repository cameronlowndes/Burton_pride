import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function passwordStrength(password: string) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export async function POST(req: Request) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin?.email) {
      return NextResponse.json(
        { ok: false, error: "You are not signed in. Please log in again." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const newPassword = String(body?.newPassword || "");
    const confirmPassword = String(body?.confirmPassword || "");

    if (!newPassword || !confirmPassword) {
      return NextResponse.json(
        { ok: false, error: "Please enter and confirm your new password." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { ok: false, error: "Passwords do not match." },
        { status: 400 }
      );
    }

    if (!passwordStrength(newPassword)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Password must include at least 8 characters, uppercase, lowercase, number and symbol.",
        },
        { status: 400 }
      );
    }

    const adminEmail = String(admin.email).trim().toLowerCase();

    const { data: adminRow, error: adminError } = await supabaseAdmin
      .from("admin_users")
      .select("id, email, supabase_user_id, is_active")
      .eq("email", adminEmail)
      .maybeSingle();

    if (adminError || !adminRow) {
      return NextResponse.json(
        { ok: false, error: "No admin account found for this login." },
        { status: 403 }
      );
    }

    if (adminRow.is_active === false) {
      return NextResponse.json(
        { ok: false, error: "This admin account is disabled." },
        { status: 403 }
      );
    }

    if (adminRow.supabase_user_id) {
      const { error: authUpdateError } =
        await supabaseAdmin.auth.admin.updateUserById(
          adminRow.supabase_user_id,
          { password: newPassword }
        );

      if (authUpdateError) {
        console.error("Supabase Auth password update error:", authUpdateError);
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const { error: hashError } = await supabaseAdmin
      .from("admin_users")
      .update({
        password_hash: hashedPassword,
        updated_at: new Date().toISOString(),
      })
      .eq("email", adminEmail);

    if (hashError) {
      return NextResponse.json(
        { ok: false, error: "Failed to save password hash in admin_users." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Password changed successfully.",
    });
  } catch (error: any) {
    console.error("Change password error:", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to change password." },
      { status: 500 }
    );
  }
}