import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export type LotteryAdmin = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  permissions: string[];
};

/**
 * Adapter for Burton Pride's existing Admin Portal auth.
 *
 * This reads the existing Burton Admin cookies and then verifies the admin
 * server-side against admin_users. If your existing admin helper already
 * performs this check, replace this file with that helper and keep the
 * requireLotteryPermission() API.
 */
function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server database configuration is missing.");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireLotteryPermission(permission: string): Promise<LotteryAdmin> {
  const cookieStore = await cookies();
  const adminId = cookieStore.get("burton_admin_id")?.value;
  const cookieEmail = cookieStore.get("burton_admin_email")?.value ?? null;

  if (!adminId) {
    throw Object.assign(new Error("Authentication required."), { status: 401 });
  }

  const db = adminDb();

  const { data, error } = await db
    .from("admin_users")
    .select("id,email,name,role,permissions,is_active")
    .eq("id", adminId)
    .maybeSingle();

  if (error || !data || data.is_active === false) {
    throw Object.assign(new Error("Authentication required."), { status: 401 });
  }

  const permissions = Array.isArray(data.permissions)
    ? data.permissions.filter((x: unknown): x is string => typeof x === "string")
    : [];

  const roleAllowsEverything = data.role === "main_admin";
  const allowed = roleAllowsEverything || permissions.includes(permission);

  if (!allowed) {
    throw Object.assign(new Error("You do not have permission to perform this action."), {
      status: 403,
    });
  }

  return {
    id: String(data.id),
    email: data.email ?? cookieEmail,
    name: data.name ?? null,
    role: data.role ?? null,
    permissions,
  };
}

export function lotteryAdminDb() {
  return adminDb();
}
