import {
  type NextRequest,
  NextResponse,
} from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

type SitePageStatus =
  | "live"
  | "hidden"
  | "coming_soon";

type SitePage = {
  id: string;
  route: string;
  status: SitePageStatus;
  is_enabled: boolean;
  password_protected: boolean;
};

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_READ_KEY =
  process.env.SUPABASE_SITE_PAGES_READ_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const PAGE_LOCKER_FAIL_CLOSED =
  process.env.PAGE_LOCKER_FAIL_CLOSED === "true";

const PUBLIC_ROOT_FILES = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.json",
]);

const PUBLIC_ASSET_PREFIXES = [
  "/_next/",
  "/assets/",
  "/images/",
  "/img/",
  "/icons/",
  "/fonts/",
];

const PUBLIC_ADMIN_API_PATHS = new Set([
  "/api/admin/settings/login",
  "/api/admin/settings/login/two-factor/verify",
  "/api/admin/settings/login/two-factor/resend",
  "/api/admin/logout",
]);

function normalisePath(pathname: string) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  const cleanPath = pathname
    .split("?")[0]
    .split("#")[0]
    .trim();

  if (!cleanPath || cleanPath === "/") {
    return "/";
  }

  const withSlash =
    cleanPath.startsWith("/")
      ? cleanPath
      : `/${cleanPath}`;

  const noTrailingSlash =
    withSlash.endsWith("/") &&
    withSlash !== "/"
      ? withSlash.slice(0, -1)
      : withSlash;

  return noTrailingSlash.replace(
    /\/{2,}/g,
    "/",
  );
}

function isSafeRoute(pathname: string) {
  const route =
    normalisePath(pathname);

  if (route.length > 300) {
    return false;
  }

  if (route.includes("..")) {
    return false;
  }

  if (route.includes("\\")) {
    return false;
  }

  if (
    route.toLowerCase().includes("%00")
  ) {
    return false;
  }

  return /^\/[a-zA-Z0-9/_-]*$/.test(
    route,
  );
}

function isAdminRoute(pathname: string) {
  const path =
    normalisePath(pathname)
      .toLowerCase();

  return (
    path === "/admin" ||
    path.startsWith("/admin/")
  );
}

function isAdminApiRoute(
  pathname: string,
) {
  return normalisePath(pathname)
    .toLowerCase()
    .startsWith("/api/admin");
}

function isPublicAdminApiPath(
  pathname: string,
) {
  const path =
    normalisePath(pathname)
      .toLowerCase();

  return PUBLIC_ADMIN_API_PATHS.has(
    path,
  );
}

function isAdminMutation(
  request: NextRequest,
) {
  if (
    !isAdminApiRoute(
      request.nextUrl.pathname,
    )
  ) {
    return false;
  }

  return [
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
  ].includes(
    request.method.toUpperCase(),
  );
}

function hasValidOrigin(
  request: NextRequest,
) {
  const expectedOrigin =
    request.nextUrl.origin;

  const origin =
    request.headers.get("origin");

  if (origin) {
    try {
      return (
        new URL(origin).origin ===
        expectedOrigin
      );
    } catch {
      return false;
    }
  }

  const referer =
    request.headers.get("referer");

  if (referer) {
    try {
      return (
        new URL(referer).origin ===
        expectedOrigin
      );
    } catch {
      return false;
    }
  }

  return false;
}

function shouldSkipPageLocker(
  pathname: string,
) {
  const path =
    normalisePath(pathname);

  const lowerPath =
    path.toLowerCase();

  if (
    PUBLIC_ROOT_FILES.has(lowerPath)
  ) {
    return true;
  }

  if (isAdminRoute(path)) {
    return true;
  }

  if (isAdminApiRoute(path)) {
    return true;
  }

  if (
    lowerPath.startsWith("/api/")
  ) {
    return true;
  }

  if (
    lowerPath.startsWith(
      "/page-status",
    )
  ) {
    return true;
  }

  return PUBLIC_ASSET_PREFIXES.some(
    (prefix) =>
      lowerPath.startsWith(prefix),
  );
}

function withSecurityHeaders(
  response: NextResponse,
  options?: {
    admin?: boolean;
    lockedPage?: boolean;
    noStore?: boolean;
  },
) {
  response.headers.set(
    "X-Content-Type-Options",
    "nosniff",
  );

  response.headers.set(
    "X-Frame-Options",
    "DENY",
  );

  response.headers.set(
    "Referrer-Policy",
    options?.admin
      ? "no-referrer"
      : "strict-origin-when-cross-origin",
  );

  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );

  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  if (
    options?.admin ||
    options?.lockedPage
  ) {
    response.headers.set(
      "X-Robots-Tag",
      "noindex, nofollow, noarchive",
    );
  }

  if (
    options?.admin ||
    options?.noStore
  ) {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );

    response.headers.set(
      "Pragma",
      "no-cache",
    );

    response.headers.set(
      "Expires",
      "0",
    );
  }

  return response;
}

function buildPageStatusPath(
  pathname: string,
) {
  const path =
    normalisePath(pathname);

  if (path === "/") {
    return "/page-status/home";
  }

  return `/page-status${path}`;
}

function makeLockedPageRewrite(
  request: NextRequest,
  pathname: string,
  reason:
    | "unavailable"
    | "access_required",
) {
  const statusUrl =
    request.nextUrl.clone();

  statusUrl.pathname =
    buildPageStatusPath(pathname);

  statusUrl.searchParams.set(
    "reason",
    reason,
  );

  statusUrl.searchParams.set(
    "route",
    normalisePath(pathname),
  );

  return withSecurityHeaders(
    NextResponse.rewrite(statusUrl),
    {
      lockedPage: true,
      noStore: true,
    },
  );
}

async function getSitePage(
  route: string,
) {
  if (
    !SUPABASE_URL ||
    !SUPABASE_READ_KEY
  ) {
    return {
      page: null as SitePage | null,
      failed: false,
    };
  }

  const normalisedRoute =
    normalisePath(route);

  const lowerRoute =
    normalisedRoute.toLowerCase();

  if (
    !isSafeRoute(normalisedRoute)
  ) {
    return {
      page: null as SitePage | null,
      failed: false,
    };
  }

  try {
    const url = new URL(
      `${SUPABASE_URL}/rest/v1/site_pages`,
    );

    url.searchParams.set(
      "select",
      "id,route,status,is_enabled,password_protected",
    );

    if (
      normalisedRoute === lowerRoute
    ) {
      url.searchParams.set(
        "route",
        `eq.${lowerRoute}`,
      );
    } else {
      url.searchParams.set(
        "or",
        `(route.eq.${normalisedRoute},route.eq.${lowerRoute})`,
      );
    }

    url.searchParams.set(
      "limit",
      "1",
    );

    const response =
      await fetch(
        url.toString(),
        {
          headers: {
            apikey:
              SUPABASE_READ_KEY,

            Authorization:
              `Bearer ${SUPABASE_READ_KEY}`,
          },

          cache: "no-store",
        },
      );

    if (!response.ok) {
      console.error(
        "Website page locker failed",
        {
          status:
            response.status,
          route:
            normalisedRoute,
        },
      );

      return {
        page:
          null as SitePage | null,
        failed: true,
      };
    }

    const data =
      (await response.json()) as SitePage[];

    return {
      page:
        data[0] ?? null,
      failed: false,
    };
  } catch (error) {
    console.error(
      "Website page locker failed",
      {
        route:
          normalisedRoute,

        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
    );

    return {
      page:
        null as SitePage | null,
      failed: true,
    };
  }
}

async function runPageLocker(
  request: NextRequest,
) {
  const pathname =
    normalisePath(
      request.nextUrl.pathname,
    );

  if (
    shouldSkipPageLocker(pathname)
  ) {
    return null;
  }

  if (
    !isSafeRoute(pathname)
  ) {
    return null;
  }

  const result =
    await getSitePage(pathname);

  if (
    result.failed &&
    PAGE_LOCKER_FAIL_CLOSED
  ) {
    return makeLockedPageRewrite(
      request,
      pathname,
      "unavailable",
    );
  }

  const page =
    result.page;

  if (!page) {
    return null;
  }

  if (!page.is_enabled) {
    return makeLockedPageRewrite(
      request,
      pathname,
      "unavailable",
    );
  }

  if (
    page.status === "hidden"
  ) {
    return makeLockedPageRewrite(
      request,
      pathname,
      "unavailable",
    );
  }

  if (
    page.status ===
    "coming_soon"
  ) {
    return makeLockedPageRewrite(
      request,
      pathname,
      "unavailable",
    );
  }

  if (
    page.status !== "live"
  ) {
    return makeLockedPageRewrite(
      request,
      pathname,
      "unavailable",
    );
  }

  if (
    page.password_protected
  ) {
    const oldCookieName =
      `site_page_access_${page.id}`;

    const hasOldAccessCookie =
      request.cookies.get(
        oldCookieName,
      )?.value === "true";

    if (!hasOldAccessCookie) {
      return makeLockedPageRewrite(
        request,
        pathname,
        "access_required",
      );
    }
  }

  return null;
}

export async function middleware(
  request: NextRequest,
) {
  const pathname =
    normalisePath(
      request.nextUrl.pathname,
    );
  if (
    isAdminRoute(pathname) ||
    isAdminApiRoute(pathname)
  ) {
    if (
      isAdminMutation(request) &&
      !isPublicAdminApiPath(
        pathname,
      ) &&
      !hasValidOrigin(request)
    ) {
      return withSecurityHeaders(
        NextResponse.json(
          {
            ok: false,
            message:
              "Request blocked.",
          },
          {
            status: 403,
          },
        ),
        {
          admin: true,
          noStore: true,
        },
      );
    }
    const adminResponse =
      await updateSession(
        request,
      );

    return withSecurityHeaders(
      adminResponse,
      {
        admin: true,
        noStore: true,
      },
    );
  }

  const lockedResponse =
    await runPageLocker(
      request,
    );

  if (lockedResponse) {
    return lockedResponse;
  }

  return withSecurityHeaders(
    NextResponse.next(),
  );
}

export const config = {
  runtime: "nodejs",

  matcher: [
    "/Admin/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};