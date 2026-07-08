import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Put this file here:
 *
 * app/api/admin/logout/route.ts
 *
 * This route clears the Burton Pride admin session cookies and likely
 * Supabase auth cookies. It supports:
 *
 * POST /api/admin/logout  -> returns JSON
 * GET  /api/admin/logout  -> clears cookies and redirects to login
 */

const ADMIN_COOKIE_NAMES = [
  "burton_admin_session",
  "burton_admin_id",
  "burton_admin_email",
  "burton_admin_role",
  "burton_admin_permissions",

  /**
   * Older / fallback names, in case earlier code used them.
   */
  "admin_session",
  "admin_id",
  "admin_email",
  "admin_role",
  "admin_permissions",

  /**
   * Common Supabase token names.
   * The route also clears any request cookie starting with sb-.
   */
  "sb-access-token",
  "sb-refresh-token",
];

const COOKIE_PATHS = [
  "/",
  "/Admin",
  "/Admin/Login",
  "/Admin/Dashboard",
  "/Admin/Money",
  "/Admin/MoneyManagement",
  "/Admin/Email",
  "/Admin/BurtonPrideEventHub",
  "/api",
  "/api/admin",
];

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getCookieNamesToClear(request: NextRequest) {
  const requestCookieNames = request.cookies
    .getAll()
    .map((cookie) => cookie.name);

  const matchedRequestCookieNames = requestCookieNames.filter((name) => {
    const lower = name.toLowerCase();

    return (
      lower.startsWith("sb-") ||
      lower.includes("supabase") ||
      lower.includes("auth-token") ||
      lower.includes("admin") ||
      lower.includes("burton")
    );
  });

  return unique([...ADMIN_COOKIE_NAMES, ...matchedRequestCookieNames]);
}

function getDomainCandidates(request: NextRequest) {
  const host = request.nextUrl.hostname;

  if (!host || host === "localhost" || /^[\d.]+$/.test(host)) {
    return [];
  }

  const parts = host.split(".").filter(Boolean);

  const candidates = [host, `.${host}`];

  if (parts.length > 2) {
    candidates.push(`.${parts.slice(-2).join(".")}`);
  }

  return unique(candidates);
}

function serializeExpiredCookie(args: {
  name: string;
  path: string;
  domain?: string;
  httpOnly?: boolean;
  secure?: boolean;
}) {
  const parts = [
    `${encodeURIComponent(args.name)}=`,
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    `Path=${args.path}`,
    "SameSite=Lax",
  ];

  if (args.domain) parts.push(`Domain=${args.domain}`);
  if (args.httpOnly) parts.push("HttpOnly");
  if (args.secure) parts.push("Secure");

  return parts.join("; ");
}

function clearAllTargetCookies(request: NextRequest, response: NextResponse) {
  const secure = process.env.NODE_ENV === "production";
  const names = getCookieNamesToClear(request);
  const domains = getDomainCandidates(request);

  for (const name of names) {
    for (const path of COOKIE_PATHS) {
      /**
       * Clear both HttpOnly and non-HttpOnly versions.
       * Cookies can exist multiple times with different path/domain settings,
       * so this intentionally appends many Set-Cookie headers.
       */
      response.headers.append(
        "Set-Cookie",
        serializeExpiredCookie({
          name,
          path,
          httpOnly: true,
          secure,
        })
      );

      response.headers.append(
        "Set-Cookie",
        serializeExpiredCookie({
          name,
          path,
          httpOnly: false,
          secure,
        })
      );

      for (const domain of domains) {
        response.headers.append(
          "Set-Cookie",
          serializeExpiredCookie({
            name,
            path,
            domain,
            httpOnly: true,
            secure,
          })
        );

        response.headers.append(
          "Set-Cookie",
          serializeExpiredCookie({
            name,
            path,
            domain,
            httpOnly: false,
            secure,
          })
        );
      }
    }
  }
}

function buildJsonLogoutResponse(request: NextRequest) {
  const response = NextResponse.json(
    {
      ok: true,
      loggedOut: true,
      message: "Admin session cookies cleared.",
    },
    {
      status: 200,
      headers: noStoreHeaders(),
    }
  );

  clearAllTargetCookies(request, response);

  return response;
}

export async function POST(request: NextRequest) {
  return buildJsonLogoutResponse(request);
}

export async function GET(request: NextRequest) {
  const loginUrl = new URL("/Admin/Login", request.url);

  loginUrl.searchParams.set("loggedOut", "1");
  loginUrl.searchParams.set("t", String(Date.now()));

  const response = NextResponse.redirect(loginUrl, {
    status: 303,
    headers: noStoreHeaders(),
  });

  clearAllTargetCookies(request, response);

  return response;
}
