import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

type AdminUser = {
  id: string;
  email: string;
  role: string | null;
  is_active: boolean;
  supabase_user_id: string | null;
};

const ADMIN_LOGIN_PATH = "/Admin/Login";

const PUBLIC_ADMIN_PAGE_PATHS = new Set([
  "/admin/login",
]);

const PUBLIC_ADMIN_API_PATHS = new Set([
  "/api/admin/settings/login",
  "/api/admin/logout",
]);

function normalisePath(pathname: string) {
  if (!pathname || pathname === "/") return "/";

  const cleanPath = pathname.split("?")[0].split("#")[0].trim();

  if (!cleanPath || cleanPath === "/") return "/";

  const withSlash = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;

  return withSlash.endsWith("/") && withSlash !== "/"
    ? withSlash.slice(0, -1)
    : withSlash;
}

function isAdminPage(pathname: string) {
  const path = normalisePath(pathname).toLowerCase();

  return path === "/admin" || path.startsWith("/admin/");
}

function isAdminApi(pathname: string) {
  return normalisePath(pathname).toLowerCase().startsWith("/api/admin");
}

function isPublicAdminPath(pathname: string) {
  const path = normalisePath(pathname).toLowerCase();

  return PUBLIC_ADMIN_PAGE_PATHS.has(path) || PUBLIC_ADMIN_API_PATHS.has(path);
}

function isApiRequest(pathname: string) {
  return isAdminApi(pathname);
}

function jsonBlocked(message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    },
  );
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = request.nextUrl.clone();

  loginUrl.pathname = ADMIN_LOGIN_PATH;
  loginUrl.search = "";

  const currentPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (
    currentPath &&
    !normalisePath(currentPath).toLowerCase().startsWith("/admin/login")
  ) {
    loginUrl.searchParams.set("next", currentPath);
  }

  const response = NextResponse.redirect(loginUrl);

  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");

  return response;
}

function addAdminSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  return response;
}

async function getAdminUserBySupabaseId(
  supabase: ReturnType<typeof createServerClient>,
  supabaseUserId: string,
) {
  const { data, error } = await supabase
    .from("admin_users")
    .select("id,email,role,is_active,supabase_user_id")
    .eq("supabase_user_id", supabaseUserId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Admin session check failed", {
      reason: "admin_user_lookup_failed",
      status: error.code,
    });

    return null;
  }

  return data as AdminUser | null;
}

export async function updateSession(request: NextRequest) {
  const pathname = normalisePath(request.nextUrl.pathname);
  const apiRequest = isApiRequest(pathname);
  const adminRequest = isAdminPage(pathname) || isAdminApi(pathname);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (apiRequest) {
      return jsonBlocked("Service unavailable.", 503);
    }

    const response = new NextResponse("Service unavailable.", {
      status: 503,
    });

    return addAdminSecurityHeaders(response);
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, {
            ...options,
            sameSite: options?.sameSite ?? "lax",
            secure: process.env.NODE_ENV === "production" || options?.secure,
          });
        });
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!adminRequest) {
    return response;
  }

  if (isPublicAdminPath(pathname)) {
    return addAdminSecurityHeaders(response);
  }

  if (userError || !user) {
    if (apiRequest) {
      return jsonBlocked("Unauthorised.", 401);
    }

    return redirectToLogin(request);
  }

  const adminUser = await getAdminUserBySupabaseId(supabase, user.id);

  if (!adminUser || !adminUser.is_active) {
    if (apiRequest) {
      return jsonBlocked("Forbidden.", 403);
    }

    return redirectToLogin(request);
  }

  response.headers.set("x-admin-user-id", adminUser.id);
  response.headers.set("x-admin-role", adminUser.role || "admin");

  return addAdminSecurityHeaders(response);
}