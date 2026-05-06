import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SitePagePasswordRow = {
  id: string;
  title: string | null;
  route: string;
  password_protected: boolean;
  page_password_hash: string | null;
};

function normalisePath(pathname: string) {
  if (!pathname) return "/";

  const onlyPath = pathname.split("?")[0].split("#")[0].trim();

  if (!onlyPath || onlyPath === "/") return "/";

  const withSlash = onlyPath.startsWith("/") ? onlyPath : `/${onlyPath}`;

  return withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
}

async function findPage(pageId: string, route: string) {
  if (pageId) {
    const { data, error } = await supabaseAdmin
      .from("site_pages")
      .select("id, title, route, password_protected, page_password_hash")
      .eq("id", pageId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return data as SitePagePasswordRow;
  }

  const normalisedRoute = normalisePath(route);
  const lowerRoute = normalisedRoute.toLowerCase();

  const { data, error } = await supabaseAdmin
    .from("site_pages")
    .select("id, title, route, password_protected, page_password_hash")
    .or(`route.eq.${normalisedRoute},route.eq.${lowerRoute}`)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data as SitePagePasswordRow | null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const pageId = String(body.pageId || "").trim();
    const route = normalisePath(String(body.route || "").trim());
    const typedPassword = String(body.password || "").trim();

    if (!typedPassword) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter the page password.",
        },
        { status: 400 }
      );
    }

    const page = await findPage(pageId, route);

    if (!page) {
      return NextResponse.json(
        {
          ok: false,
          error: "This page could not be found.",
          received: {
            pageId,
            route,
            routeLowercase: route.toLowerCase(),
          },
        },
        { status: 404 }
      );
    }

    if (!page.password_protected) {
      return NextResponse.json(
        {
          ok: false,
          error: "This page is not currently password protected.",
        },
        { status: 400 }
      );
    }

    if (!page.page_password_hash) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This page is password protected, but no password hash has been saved.",
        },
        { status: 400 }
      );
    }

    const passwordMatches = await bcrypt.compare(
      typedPassword,
      page.page_password_hash
    );

    if (!passwordMatches) {
      return NextResponse.json(
        {
          ok: false,
          error: "Incorrect password.",
        },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      pageId: page.id,
      route: page.route,
      message: "Page unlocked successfully.",
    });

    response.cookies.set(`site_page_access_${page.id}`, "granted", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    console.error("Unlock site page error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to unlock page.",
      },
      { status: 500 }
    );
  }
}