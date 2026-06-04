import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value || "").trim();
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "You must be logged in as an admin." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const fullName = clean(body.full_name);

    if (!fullName) {
      return NextResponse.json(
        { ok: false, error: "Full name is required." },
        { status: 400 }
      );
    }

    const adminEmail = clean((admin as any).email).toLowerCase();

    if (!adminEmail) {
      return NextResponse.json(
        { ok: false, error: "Admin email could not be found." },
        { status: 400 }
      );
    }

    const { data: usersData, error: usersError } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (usersError) {
      return NextResponse.json(
        {
          ok: false,
          error: `Could not search Supabase Auth users: ${usersError.message}`,
        },
        { status: 500 }
      );
    }

    const authUser = usersData.users.find(
      (user) => clean(user.email).toLowerCase() === adminEmail
    );

    if (!authUser) {
      return NextResponse.json(
        {
          ok: false,
          error: `Supabase Auth user not found for email: ${adminEmail}`,
        },
        { status: 404 }
      );
    }

    const { error: authUpdateError } =
      await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        user_metadata: {
          ...(authUser.user_metadata || {}),
          full_name: fullName,
          name: fullName,
          display_name: fullName,
        },
      });

    if (authUpdateError) {
      return NextResponse.json(
        {
          ok: false,
          error: `Could not update Supabase Auth user: ${authUpdateError.message}`,
        },
        { status: 500 }
      );
    }

    const { data: existingAdminUser } = await supabaseAdmin
      .from("admin_users")
      .select("id, email")
      .eq("email", adminEmail)
      .maybeSingle();

    let savedAdmin = null;

    if (existingAdminUser?.id) {
      const { data, error } = await supabaseAdmin
        .from("admin_users")
        .update({
          full_name: fullName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingAdminUser.id)
        .select("id, email, full_name")
        .single();

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: `Supabase Auth updated, but admin_users failed: ${error.message}`,
          },
          { status: 500 }
        );
      }

      savedAdmin = data;
    }

    return NextResponse.json({
      ok: true,
      message: "Profile saved successfully.",
      admin: savedAdmin,
      auth_user: {
        id: authUser.id,
        email: authUser.email,
        full_name: fullName,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update profile.",
      },
      { status: 500 }
    );
  }
}