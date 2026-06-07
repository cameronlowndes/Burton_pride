import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "burton_admin_session";
const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function cleanPassword(value: unknown) {
  return String(value || "");
}

function jsonError({
  status,
  error,
  likelyFix,
  debug,
}: {
  status: number;
  error: string;
  likelyFix?: string;
  debug?: unknown;
}) {
  return NextResponse.json(
    {
      ok: false,
      error,
      likelyFix,
      debug: process.env.NODE_ENV === "development" ? debug : undefined,
    },
    { status }
  );
}

function createSessionToken() {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return Buffer.from(`${Date.now()}:${random}`).toString("base64url");
}

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}

async function checkSupabaseAuthPassword(email: string, password: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      error:
        "Supabase Auth check skipped because NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.",
    };
  }

  const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabaseAuthClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return {
      ok: false,
      error: error?.message || "Supabase Auth login failed.",
    };
  }

  await supabaseAuthClient.auth.signOut();

  return {
    ok: true,
    supabaseUserId: data.user.id,
    supabaseEmail: data.user.email || email,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const email = cleanEmail(body?.email);
    const password = cleanPassword(body?.password);

    if (!email || !password) {
      return jsonError({
        status: 400,
        error: "Email address and password are required.",
        likelyFix: "Enter your admin email and password, then try again.",
      });
    }

    const { data: admin, error: adminError } = await supabaseAdmin
      .from("admin_users")
      .select(
        `
          id,
          email,
          full_name,
          password_hash,
          is_active,
          role,
          supabase_user_id
        `
      )
      .eq("email", email)
      .maybeSingle();

    if (adminError) {
      console.error("Admin login database error:", adminError);

      return jsonError({
        status: 500,
        error: "The admin login system could not read the admin_users table.",
        likelyFix:
          "Check Supabase. Make sure the admin_users table exists and has id, email, password_hash, role, is_active and supabase_user_id columns.",
        debug: adminError,
      });
    }

    if (!admin) {
      return jsonError({
        status: 401,
        error: "Invalid login credentials.",
        likelyFix:
          "No admin account was found with that email address in admin_users.",
      });
    }

    if (admin.is_active === false) {
      return jsonError({
        status: 403,
        error: "This admin account is disabled.",
        likelyFix:
          "Open the admin_users table in Supabase and set is_active to true for this admin.",
      });
    }

    let passwordOk = false;
    let loginMethod:
      | "admin_users_password_hash"
      | "supabase_auth_password"
      | null = null;

    if (admin.password_hash) {
      passwordOk = await bcrypt.compare(password, admin.password_hash);

      if (passwordOk) {
        loginMethod = "admin_users_password_hash";
      }
    }

    if (!passwordOk) {
      const supabaseAuthResult = await checkSupabaseAuthPassword(
        email,
        password
      );

      if (supabaseAuthResult.ok) {
        passwordOk = true;
        loginMethod = "supabase_auth_password";

        if (
          supabaseAuthResult.supabaseUserId &&
          supabaseAuthResult.supabaseUserId !== admin.supabase_user_id
        ) {
          await supabaseAdmin
            .from("admin_users")
            .update({
              supabase_user_id: supabaseAuthResult.supabaseUserId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", admin.id);
        }
      }
    }

    if (!passwordOk) {
      return jsonError({
        status: 401,
        error: "Invalid login credentials.",
        likelyFix:
          "Password did not match admin_users.password_hash or Supabase Auth.",
      });
    }

    const cookieStore = await cookies();
    const sessionToken = createSessionToken();
    const cookieOptions = getCookieOptions();
    const adminId = String(admin.id);
    const adminEmail = cleanEmail(admin.email);

    cookieStore.set(SESSION_COOKIE, sessionToken, cookieOptions);
    cookieStore.set(ADMIN_ID_COOKIE, adminId, cookieOptions);
    cookieStore.set(ADMIN_EMAIL_COOKIE, adminEmail, cookieOptions);

    cookieStore.set("admin_user_id", adminId, cookieOptions);
    cookieStore.set("admin_id", adminId, cookieOptions);
    cookieStore.set("admin_email", adminEmail, cookieOptions);
    cookieStore.set("bp_admin_id", adminId, cookieOptions);
    cookieStore.set("bp_admin_email", adminEmail, cookieOptions);

    return NextResponse.json({
      ok: true,
      message: "Signed in successfully.",
      loginMethod,
      admin: {
        id: adminId,
        email: adminEmail,
        full_name: admin.full_name ?? null,
        role: admin.role ?? null,
      },
    });
  } catch (error: any) {
    console.error("Admin login route error:", error);

    return jsonError({
      status: 500,
      error: error?.message || "Something went wrong while signing in.",
      likelyFix:
        "Check the Next.js terminal logs. Make sure bcryptjs is installed and Supabase env vars are set.",
      debug: error,
    });
  }
}