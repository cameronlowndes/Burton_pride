import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SitePagePasswordRow = {
  id: string;
  route: string;
  password_protected: boolean;
  page_password: string | null;
};

function normalisePath(pathname: string) {
  if (!pathname) return "/";

  const onlyPath = pathname.split("?")[0].split("#")[0].trim();

  if (!onlyPath || onlyPath === "/") return "/";

  const withSlash = onlyPath.startsWith("/") ? onlyPath : `/${onlyPath}`;

  return withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
}

async function findPageById(pageId: string) {
  if (!pageId) return null;

  const { data, error } = await supabaseAdmin
    .from("site_pages")
    .select("id, route, password_protected, page_password")
    .eq("id", pageId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as SitePagePasswordRow | null;
}

async function findPageByRoute(route: string) {
  const normalisedRoute = normalisePath(route);
  const lowerRoute = normalisedRoute.toLowerCase();

  /*
    This checks both:
    /Raffle
    /raffle

    This helps when your page route has capital letters but the browser/API sends lowercase.
  */
  const { data, error } = await supabaseAdmin
    .from("site_pages")
    .select("id, route, password_protected, page_password")
    .or(`route.eq.${normalisedRoute},route.eq.${lowerRoute}`)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as SitePagePasswordRow | null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const pageId = String(body.pageId || "").trim();
    const route = normalisePath(String(body.route || "").trim());
    const password = String(body.password || "").trim();

    if (!password) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter the page password.",
        },
        { status: 400 }
      );
    }

    let page: SitePagePasswordRow | null = null;

    if (pageId) {
      page = await findPageById(pageId);
    }

    if (!page && route) {
      page = await findPageByRoute(route);
    }

    if (!page) {
      return NextResponse.json(
        {
          ok: false,
          error: "This page could not be found in site_pages.",
          received: {
            pageId,
            route,
            routeLowercase: route.toLowerCase(),
          },
          help:
            "Check that the route column in site_pages matches this route exactly, for example /Raffle or /raffle.",
        },
        { status: 404 }
      );
    }

    if (!page.password_protected) {
      return NextResponse.json(
        {
          ok: false,
          error: "This page is not currently password protected.",
          pageId: page.id,
          route: page.route,
        },
        { status: 400 }
      );
    }

    if (!page.page_password || page.page_password !== password) {
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