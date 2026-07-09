import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type AdminPermissionValue = boolean | string | number | null;

export type BurtonAdminRole = "main_admin" | "admin" | "editor" | string;

export type BurtonAdminUser = {
  id: string;
  email: string;
  role: BurtonAdminRole | null;
  is_active: boolean;
  supabase_user_id: string | null;
  permissions: Record<string, AdminPermissionValue> | null;
};

export type CurrentUserResult = {
  supabase: SupabaseClient;
  user: User | null;
  error: string | null;
};

export type ActiveAdminResult = {
  supabase: SupabaseClient;
  user: User | null;
  admin: BurtonAdminUser | null;
  error:
    | null
    | "not_authenticated"
    | "admin_not_found"
    | "admin_inactive"
    | "admin_lookup_failed";
};

const REQUIRED_ENV = {
  url: "NEXT_PUBLIC_SUPABASE_URL",
  anonKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
} as const;

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`${name} is missing. Check your environment variables.`);
  }

  return value.trim();
}

function getSupabaseEnv() {
  return {
    url: getRequiredEnv(REQUIRED_ENV.url),
    anonKey: getRequiredEnv(REQUIRED_ENV.anonKey),
  };
}

function hardenCookieOptions(options: Record<string, unknown> | undefined) {
  const sameSite =
    options?.sameSite === "strict" ||
    options?.sameSite === "lax" ||
    options?.sameSite === "none"
      ? (options.sameSite as "strict" | "lax" | "none")
      : "lax";

  return {
    ...options,
    path: typeof options?.path === "string" ? options.path : "/",
    sameSite,
    secure:
      process.env.NODE_ENV === "production"
        ? true
        : Boolean(options?.secure),
  };
}

function normaliseEmail(email: string | null | undefined) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/**
 * Main Supabase server client.
 *
 * Important:
 * - This uses the ANON key only.
 * - Do not use the Supabase service role key here.
 * - Service role should stay in a separate admin-only server helper.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },

      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(
              name,
              value,
              hardenCookieOptions(options as Record<string, unknown>),
            );
          });
        } catch {
          /**
           * This can happen inside Server Components where cookie writing is not
           * allowed. Middleware should refresh auth cookies on normal requests.
           *
           * Do not log cookie values here.
           */
        }
      },
    },
  });
}

/**
 * Alias used by older files.
 */
export const createSupabaseServerClient = createClient;

/**
 * Gets the current Supabase Auth user safely.
 *
 * Use this in server components or route handlers when you only need to know
 * whether someone is signed in.
 */
export async function getCurrentUser(): Promise<CurrentUserResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase,
      user: null,
      error: "not_authenticated",
    };
  }

  return {
    supabase,
    user,
    error: null,
  };
}

/**
 * Checks whether the current Supabase user is an active Burton Pride admin.
 *
 * Use this inside sensitive admin server pages and API routes.
 * Middleware is the front gate, but each important API route should still check.
 */
export async function getActiveAdminUser(): Promise<ActiveAdminResult> {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    return {
      supabase,
      user: null,
      admin: null,
      error: "not_authenticated",
    };
  }

  const { data, error } = await supabase
    .from("admin_users")
    .select("id,email,role,is_active,supabase_user_id,permissions")
    .eq("supabase_user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Admin user lookup failed", {
      reason: "admin_lookup_failed",
      code: error.code,
    });

    return {
      supabase,
      user,
      admin: null,
      error: "admin_lookup_failed",
    };
  }

  if (!data) {
    return {
      supabase,
      user,
      admin: null,
      error: "admin_not_found",
    };
  }

  const admin = data as BurtonAdminUser;

  if (!admin.is_active) {
    return {
      supabase,
      user,
      admin: null,
      error: "admin_inactive",
    };
  }

  return {
    supabase,
    user,
    admin,
    error: null,
  };
}

/**
 * Main-admin check.
 *
 * Use this before dangerous actions like:
 * - managing admin users
 * - deleting records
 * - changing permissions
 * - locking/unlocking years
 * - viewing full audit/security pages
 */
export async function requireMainAdmin() {
  const result = await getActiveAdminUser();

  if (!result.admin || result.admin.role !== "main_admin") {
    return {
      ...result,
      allowed: false,
    };
  }

  return {
    ...result,
    allowed: true,
  };
}

/**
 * Permission helper.
 *
 * Example:
 * const result = await requirePermission("money:export");
 */
export async function requirePermission(permissionKey: string) {
  const result = await getActiveAdminUser();

  if (!result.admin) {
    return {
      ...result,
      allowed: false,
    };
  }

  if (result.admin.role === "main_admin") {
    return {
      ...result,
      allowed: true,
    };
  }

  const permissions = result.admin.permissions || {};
  const hasPermission = permissions[permissionKey] === true;

  return {
    ...result,
    allowed: hasPermission,
  };
}

/**
 * Safe email match helper.
 *
 * Use only when you need to compare the logged-in user email with the admin row.
 */
export function adminEmailMatchesAuthUser(admin: BurtonAdminUser, user: User) {
  return normaliseEmail(admin.email) === normaliseEmail(user.email);
}