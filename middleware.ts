import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const isProtectedAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isPublicAdminRoute = createRouteMatcher(["/admin/login(.*)"]);

type SitePageRow = {
  id: string;
  route: string;
  status: "live" | "hidden" | "coming_soon";
  is_enabled: boolean;
  password_protected: boolean;
};

function normalisePath(pathname: string) {
  if (!pathname) return "/";
  if (pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function shouldSkip(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/image") ||
    pathname.startsWith("/uploads") ||
    pathname.match(/\.(.*)$/) !== null ||
    pathname === "/page-status"
  );
}

async function getPageRule(pathname: string): Promise<SitePageRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRole) return null;

  const route = normalisePath(pathname);

  const res = await fetch(
    `${url}/rest/v1/site_pages?select=id,route,status,is_enabled,password_protected&route=eq.${encodeURIComponent(
      route
    )}&limit=1`,
    {
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) return null;

  const rows = (await res.json()) as SitePageRow[];
  return rows?.[0] || null;
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { pathname, search } = req.nextUrl;

  if (isProtectedAdminRoute(req) && !isPublicAdminRoute(req)) {
    await auth.protect();
  }

  if (shouldSkip(pathname)) {
    return NextResponse.next();
  }

  const pageRule = await getPageRule(pathname);

  if (!pageRule) {
    return NextResponse.next({
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  }

  if (pageRule.password_protected) {
    const accessCookie = req.cookies.get(`site_page_access_${pageRule.id}`)?.value;

    if (accessCookie !== "granted") {
      const url = req.nextUrl.clone();
      url.pathname = "/page-status";
      url.searchParams.set("mode", "locked");
      url.searchParams.set("from", pathname + search);

      return NextResponse.rewrite(url, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      });
    }
  }

  if (!pageRule.is_enabled || pageRule.status === "hidden") {
    const url = req.nextUrl.clone();
    url.pathname = "/page-status";
    url.searchParams.set("mode", "hidden");
    url.searchParams.set("from", pathname + search);

    return NextResponse.rewrite(url, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  }

  if (pageRule.status === "coming_soon") {
    const url = req.nextUrl.clone();
    url.pathname = "/page-status";
    url.searchParams.set("mode", "coming_soon");
    url.searchParams.set("from", pathname + search);

    return NextResponse.rewrite(url, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  }

  return NextResponse.next({
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};