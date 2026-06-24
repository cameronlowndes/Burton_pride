import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

type SitePageStatus = "live" | "hidden" | "coming_soon";

type SitePage = {
  id: string;
  route: string;
  status: SitePageStatus;
  is_enabled: boolean;
  password_protected: boolean;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function normalisePath(pathname: string) {
  if (!pathname || pathname === "/") return "/";

  const cleanPath = pathname.split("?")[0].split("#")[0].trim();

  if (!cleanPath || cleanPath === "/") return "/";

  const withSlash = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;

  return withSlash.endsWith("/") && withSlash !== "/"
    ? withSlash.slice(0, -1)
    : withSlash;
}

function isPublicFile(pathname: string) {
  return /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|json|woff|woff2|ttf|otf|pdf)$/i.test(
    pathname
  );
}

function shouldSkipPageLocker(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/Admin") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/page-status") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.json" ||
    isPublicFile(pathname)
  );
}

async function getSitePage(route: string): Promise<SitePage | null> {
  if (!supabaseUrl || !supabaseServiceKey) return null;

  const normalisedRoute = normalisePath(route);
  const lowerRoute = normalisedRoute.toLowerCase();

  try {
    const url = new URL(`${supabaseUrl}/rest/v1/site_pages`);

    url.searchParams.set(
      "select",
      "id,route,status,is_enabled,password_protected"
    );

    url.searchParams.set(
      "or",
      `(route.eq.${normalisedRoute},route.eq.${lowerRoute})`
    );

    url.searchParams.set("limit", "1");

    const response = await fetch(url.toString(), {
      headers: {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Website page locker error:", await response.text());
      return null;
    }

    const data = (await response.json()) as SitePage[];

    return data[0] ?? null;
  } catch (error) {
    console.error("Website page locker error:", error);
    return null;
  }
}

function buildPageStatusPath(pathname: string) {
  const normalisedPath = normalisePath(pathname);

  if (normalisedPath === "/") {
    return "/page-status/home";
  }

  return `/page-status${normalisedPath}`;
}

async function runPageLocker(request: NextRequest) {
  const pathname = normalisePath(request.nextUrl.pathname);

  if (shouldSkipPageLocker(pathname)) {
    return null;
  }

  const page = await getSitePage(pathname);

  if (!page) {
    return null;
  }

  const statusUrl = request.nextUrl.clone();
  statusUrl.pathname = buildPageStatusPath(pathname);
  statusUrl.searchParams.set("route", pathname);

  if (!page.is_enabled) {
    statusUrl.searchParams.set("reason", "disabled");
    return NextResponse.rewrite(statusUrl);
  }

  if (page.status === "hidden") {
    statusUrl.searchParams.set("reason", "hidden");
    return NextResponse.rewrite(statusUrl);
  }

  if (page.status === "coming_soon") {
    statusUrl.searchParams.set("reason", "coming_soon");
    return NextResponse.rewrite(statusUrl);
  }

  if (page.password_protected) {
    const cookieName = `site_page_access_${page.id}`;
    const hasAccess = request.cookies.get(cookieName)?.value === "true";

    if (!hasAccess) {
      statusUrl.searchParams.set("reason", "password");
      return NextResponse.rewrite(statusUrl);
    }
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const pathname = normalisePath(request.nextUrl.pathname);

  if (pathname.startsWith("/Admin") || pathname.startsWith("/api/admin")) {
    return await updateSession(request);
  }

  const lockedResponse = await runPageLocker(request);

  if (lockedResponse) {
    return lockedResponse;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/Admin/:path*",
    "/api/admin/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};