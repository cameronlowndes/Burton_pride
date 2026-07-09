import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

function genericFailed(status = 401) {
  return jsonResponse(
    {
      ok: false,
      message: "Sign in failed.",
    },
    status,
  );
}

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function cleanPassword(value: unknown) {
  return String(value || "");
}

function emailLooksValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function createLoginSupabaseClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase public environment variables are missing.");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },

      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, {
            ...options,
            sameSite: options?.sameSite ?? "lax",
            secure: process.env.NODE_ENV === "production" || options?.secure,
            path: options?.path ?? "/",
          });
        });
      },
    },
  });
}

export async function POST(request: NextRequest) {
  let body: {
    email?: unknown;
    password?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return genericFailed(400);
  }

  const email = cleanEmail(body.email);
  const password = cleanPassword(body.password);

  if (!email || !password) {
    return genericFailed(400);
  }

  if (!emailLooksValid(email)) {
    return genericFailed(400);
  }

  if (email.length > 254 || password.length > 128) {
    return genericFailed(400);
  }

  try {
    const supabase = await createLoginSupabaseClient();

    const {
      data: signInData,
      error: signInError,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    const user = signInData.user;

    if (signInError || !user) {
      return genericFailed(401);
    }

    let { data: adminUser, error: adminLookupError } = await supabaseAdmin
      .from("admin_users")
      .select("id,email,role,is_active,supabase_user_id")
      .eq("supabase_user_id", user.id)
      .maybeSingle();

    if (adminLookupError) {
      await supabase.auth.signOut();
      return genericFailed(403);
    }

    if (!adminUser) {
      const byEmail = await supabaseAdmin
        .from("admin_users")
        .select("id,email,role,is_active,supabase_user_id")
        .eq("email", email)
        .maybeSingle();

      if (byEmail.error) {
        await supabase.auth.signOut();
        return genericFailed(403);
      }

      adminUser = byEmail.data;
    }

    if (!adminUser || !adminUser.is_active) {
      await supabase.auth.signOut();
      return genericFailed(403);
    }

    if (!adminUser.supabase_user_id) {
      await supabaseAdmin
        .from("admin_users")
        .update({
          supabase_user_id: user.id,
        })
        .eq("id", adminUser.id);
    }

    return jsonResponse({
      ok: true,
      admin: {
        id: adminUser.id,
        role: adminUser.role,
      },
    });
  } catch (error) {
    console.error("Admin login failed", {
      reason: error instanceof Error ? error.message : "Unknown error",
    });

    return genericFailed(500);
  }
}