import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";



const TRUSTED_DEVICE_COOKIE =
  "burton_admin_trusted_device";

const ADMIN_COOKIE_NAMES = [
  "burton_admin_session",
  "burton_admin_id",
  "burton_admin_email",
  "burton_admin_role",
  "burton_admin_permissions",
  "burton_admin_security_session",
  "burton_admin_2fa_pending",

 
  "admin_session",
  "admin_id",
  "admin_email",
  "admin_role",
  "admin_permissions",


  "sb-access-token",
  "sb-refresh-token",
];


const PRESERVED_COOKIE_NAMES = new Set([
  TRUSTED_DEVICE_COOKIE,
]);

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

function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
    "X-Robots-Tag":
      "noindex, nofollow, noarchive",
  };
}

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function unique(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map(cleanString)
        .filter(Boolean),
    ),
  );
}

function shouldPreserveCookie(
  name: string,
): boolean {
  return PRESERVED_COOKIE_NAMES.has(
    cleanString(name),
  );
}

function getCookieNamesToClear(
  request: NextRequest,
): string[] {
  const requestCookieNames =
    request.cookies
      .getAll()
      .map((cookie) =>
        cleanString(cookie.name),
      )
      .filter(Boolean);

  const matchedRequestCookieNames =
    requestCookieNames.filter(
      (name) => {
        if (shouldPreserveCookie(name)) {
          return false;
        }

        const lower =
          name.toLowerCase();

        return (
          lower.startsWith("sb-") ||
          lower.includes("supabase") ||
          lower.includes("auth-token") ||
          lower ===
            "burton_admin_security_session" ||
          lower ===
            "burton_admin_2fa_pending" ||
          lower ===
            "burton_admin_session" ||
          lower ===
            "burton_admin_id" ||
          lower ===
            "burton_admin_email" ||
          lower ===
            "burton_admin_role" ||
          lower ===
            "burton_admin_permissions" ||
          lower === "admin_session" ||
          lower === "admin_id" ||
          lower === "admin_email" ||
          lower === "admin_role" ||
          lower === "admin_permissions"
        );
      },
    );

  return unique([
    ...ADMIN_COOKIE_NAMES,
    ...matchedRequestCookieNames,
  ]).filter(
    (name) =>
      !shouldPreserveCookie(name),
  );
}

function getDomainCandidates(
  request: NextRequest,
): string[] {
  const host =
    cleanString(
      request.nextUrl.hostname,
    ).toLowerCase();

  if (
    !host ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    /^[\d.]+$/.test(host)
  ) {
    return [];
  }

  const parts =
    host
      .split(".")
      .filter(Boolean);

  const candidates = [
    host,
    `.${host}`,
  ];

  if (parts.length > 2) {
    candidates.push(
      `.${parts
        .slice(-2)
        .join(".")}`,
    );
  }

  return unique(candidates);
}

function serializeExpiredCookie(args: {
  name: string;
  path: string;
  domain?: string;
  httpOnly?: boolean;
  secure?: boolean;
}): string {
  const parts = [
    `${encodeURIComponent(
      args.name,
    )}=`,
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    `Path=${args.path}`,
    "SameSite=Lax",
  ];

  if (args.domain) {
    parts.push(
      `Domain=${args.domain}`,
    );
  }

  if (args.httpOnly) {
    parts.push("HttpOnly");
  }

  if (args.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function clearAllTargetCookies(
  request: NextRequest,
  response: NextResponse,
): void {
  const secure =
    process.env.NODE_ENV ===
    "production";

  const names =
    getCookieNamesToClear(
      request,
    );

  const domains =
    getDomainCandidates(
      request,
    );

  for (const name of names) {
    if (shouldPreserveCookie(name)) {
      continue;
    }

    for (const path of COOKIE_PATHS) {
      response.headers.append(
        "Set-Cookie",
        serializeExpiredCookie({
          name,
          path,
          httpOnly: true,
          secure,
        }),
      );

      response.headers.append(
        "Set-Cookie",
        serializeExpiredCookie({
          name,
          path,
          httpOnly: false,
          secure,
        }),
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
          }),
        );

        response.headers.append(
          "Set-Cookie",
          serializeExpiredCookie({
            name,
            path,
            domain,
            httpOnly: false,
            secure,
          }),
        );
      }
    }
  }
}

function getLogoutDiagnostics(
  request: NextRequest,
) {
  const trustedDevicePresent =
    Boolean(
      cleanString(
        request.cookies.get(
          TRUSTED_DEVICE_COOKIE,
        )?.value,
      ),
    );

  return {
    trustedDevicePreserved: true,
    trustedDevicePresent,
  };
}

function buildJsonLogoutResponse(
  request: NextRequest,
): NextResponse {
  const diagnostics =
    getLogoutDiagnostics(
      request,
    );

  const response =
    NextResponse.json(
      {
        ok: true,
        loggedOut: true,
        message:
          "Admin session ended successfully.",
        security: {
          trustedDevicePreserved:
            diagnostics
              .trustedDevicePreserved,
        },
      },
      {
        status: 200,
        headers:
          noStoreHeaders(),
      },
    );

  clearAllTargetCookies(
    request,
    response,
  );

  return response;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  return buildJsonLogoutResponse(
    request,
  );
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const loginUrl =
    new URL(
      "/Admin/Login",
      request.url,
    );

  loginUrl.searchParams.set(
    "loggedOut",
    "1",
  );

  loginUrl.searchParams.set(
    "t",
    String(Date.now()),
  );

  const response =
    NextResponse.redirect(
      loginUrl,
      {
        status: 303,
        headers:
          noStoreHeaders(),
      },
    );

  clearAllTargetCookies(
    request,
    response,
  );

  return response;
}
