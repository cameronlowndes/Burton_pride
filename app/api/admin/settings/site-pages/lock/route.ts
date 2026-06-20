import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SitePageRow = {
  id: string;
  route: string;
  password_protected: boolean;
};

function normalisePath(pathname: string) {
  if (!pathname) return "/";

  const onlyPath = pathname.split("?")[0].split("#")[0].trim();

  if (!onlyPath || onlyPath === "/") return "/";

  const withSlash = onlyPath.startsWith("/") ? onlyPath : `/${onlyPath}`;

  return withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
}

async function findPageByRoute(route: string) {
  const normalisedRoute = normalisePath(route);
  const lowerRoute = normalisedRoute.toLowerCase();

  const { data, error } = await supabaseAdmin
    .from("site_pages")
    .select("id, route, password_protected")
    .or(`route.eq.${normalisedRoute},route.eq.${lowerRoute}`)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as SitePageRow | null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const route = normalisePath(String(body.route || "").trim());

    if (!route) {
      return NextResponse.json(
        {
          ok: false,
          error: "Page route is required.",
        },
        { status: 400 }
      );
    }

    const page = await findPageByRoute(route);

    if (!page) {
      return NextResponse.json(
        {
          ok: false,
          error: "This page could not be found.",
          received: {
            route,
            routeLowercase: route.toLowerCase(),
          },
        },
        { status: 404 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      pageId: page.id,
      route: page.route,
      message: "Page locked again for this browser.",
    });

    response.cookies.set(`site_page_access_${page.id}`, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Lock site page again error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to lock page again.",
      },
      { status: 500 }
    );
  }
}