import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createUnlockToken } from "@/lib/pageunlock";

export const runtime = "nodejs";

function clean(value: unknown) {
  return String(value || "").trim();
}

function routeToCookieKey(route: string) {
  return route === "/" ? "home" : route.replace(/^\/+/, "").replaceAll("/", "_");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const route = clean(body?.route);
    const password = clean(body?.password);

    if (!route || !password) {
      return NextResponse.json(
        { ok: false, error: "Route and password are required" },
        { status: 400 }
      );
    }

    const db = supabaseAdmin;

    const { data, error } = await db
      .from("site_pages")
      .select("route, password_protected, page_password_hash")
      .eq("route", route)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: "Page not found" },
        { status: 404 }
      );
    }

    if (!data.password_protected || !data.page_password_hash) {
      return NextResponse.json(
        { ok: false, error: "This page is not password protected" },
        { status: 400 }
      );
    }

    const valid = await bcrypt.compare(password, data.page_password_hash);

    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "Incorrect password" },
        { status: 401 }
      );
    }

    const token = createUnlockToken(route, 60 * 30);

    const res = NextResponse.json({
      ok: true,
      message: "Page unlocked",
    });

    res.cookies.set(`site_page_unlock_${routeToCookieKey(route)}`, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 30,
    });

    return res;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}