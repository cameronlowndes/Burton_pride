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

  const onlyPath = pathname.split("?")[0].split("#")[0];

  if (!onlyPath || onlyPath === "/") return "/";

  const withSlash = onlyPath.startsWith("/") ? onlyPath : `/${onlyPath}`;

  return withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
}

function shouldSkip(pathname: string) {
  const path = pathname.toLowerCase();

  return (
    path.startsWith("/_next") ||
    path.startsWith("/api") ||
    path.startsWith("/admin") ||
    path.startsWith("/favicon.ico") ||
    path.startsWith("/robots.txt") ||
    path.startsWith("/sitemap.xml") ||
    path.startsWith("/images") ||
    path.startsWith("/image") ||
    path.startsWith("/uploads") ||
    path === "/page-status" ||
    pathname.match(/\.(.*)$/) !== null
  );
}

async function fetchPageRuleByRoute(route: string): Promise<SitePageRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRole) return null;

  const queryRoute = encodeURIComponent(route);

  const res = await fetch(
    `${url}/rest/v1/site_pages?select=id,route,status,is_enabled,password_protected&route=eq.${queryRoute}&limit=1`,
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

async function getPageRule(pathname: string): Promise<SitePageRow | null> {
  const route = normalisePath(pathname);

  const exactMatch = await fetchPageRuleByRoute(route);

  if (exactMatch) {
    return exactMatch;
  }

  const lowerMatch = await fetchPageRuleByRoute(route.toLowerCase());

  if (lowerMatch) {
    return lowerMatch;
  }

  return null;
}

function noStoreResponse(response: NextResponse) {
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

function rewriteToPageStatus(
  req: NextRequest,
  mode: "locked" | "hidden" | "coming_soon",
  from: string
) {
  const url = req.nextUrl.clone();

  url.pathname = "/page-status";
  url.searchParams.set("mode", mode);
  url.searchParams.set("from", from);

  return noStoreResponse(NextResponse.rewrite(url));
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { pathname, search } = req.nextUrl;
  const from = pathname + search;

  if (isProtectedAdminRoute(req) && !isPublicAdminRoute(req)) {
    await auth.protect();
  }

  if (shouldSkip(pathname)) {
    return noStoreResponse(NextResponse.next());
  }

  const pageRule = await getPageRule(pathname);

  if (!pageRule) {
    return noStoreResponse(NextResponse.next());
  }

  /**
   * IMPORTANT:
   * Password protection is checked FIRST.
   *
   * If the page is password protected and the visitor has already unlocked it,
   * allow them through even if the admin status is hidden.
   *
   * This means:
   * - Public visitors see the locked page.
   * - People with the password can view the real page.
   */
  if (pageRule.password_protected) {
    const accessCookie = req.cookies.get(
      `site_page_access_${pageRule.id}`
    )?.value;

    if (accessCookie !== "granted") {
      return rewriteToPageStatus(req, "locked", from);
    }

    return noStoreResponse(NextResponse.next());
  }

  /**
   * These only apply to pages that are NOT password protected.
   */
  if (!pageRule.is_enabled || pageRule.status === "hidden") {
    return rewriteToPageStatus(req, "hidden", from);
  }

  if (pageRule.status === "coming_soon") {
    return rewriteToPageStatus(req, "coming_soon", from);
  }

  return noStoreResponse(NextResponse.next());
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};