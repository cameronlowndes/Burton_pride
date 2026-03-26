import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SitePagePasswordRow = {
  id: string;
  route: string;
  password_protected: boolean;
  page_password: string | null;
};

function normalisePath(pathname: string) {
  if (!pathname) return "/";
  const onlyPath = pathname.split("?")[0].split("#")[0];
  if (!onlyPath || onlyPath === "/") return "/";
  return onlyPath.endsWith("/") ? onlyPath.slice(0, -1) : onlyPath;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const pageId = String(body.pageId || "").trim();
    const route = normalisePath(String(body.route || "").trim());
    const password = String(body.password || "").trim();

    if (!password) {
      return NextResponse.json(
        { ok: false, error: "Please enter the page password." },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin;

    let data: SitePagePasswordRow | null = null;
    let error: { message: string } | null = null;

    if (pageId) {
      const result = await admin
        .from("site_pages")
        .select("id, route, password_protected, page_password")
        .eq("id", pageId)
        .maybeSingle<SitePagePasswordRow>();

      data = result.data;
      error = result.error;
    }

    if ((!data || error) && route) {
      const fallbackResult = await admin
        .from("site_pages")
        .select("id, route, password_protected, page_password")
        .eq("route", route)
        .maybeSingle<SitePagePasswordRow>();

      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: "This page could not be found." },
        { status: 404 }
      );
    }

    if (!data.password_protected) {
      return NextResponse.json(
        { ok: false, error: "This page is not currently password protected." },
        { status: 400 }
      );
    }

    if (!data.page_password || data.page_password !== password) {
      return NextResponse.json(
        { ok: false, error: "Incorrect password." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true });

    response.cookies.set(`site_page_access_${data.id}`, "granted", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to unlock page.",
      },
      { status: 500 }
    );
  }
}