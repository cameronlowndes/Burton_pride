import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";
const SESSION_COOKIE = "burton_admin_session";

const MAIN_ADMIN_EMAILS = [
  "cameronlowndes@burtonpride.co.uk",
  "cameronlowndes@gmail.com",
  "simonwhale@burtonpride.co.uk",
  "isaactimmins@burtonpride.co.uk",
  "olga@burtonpride.co.uk",
].map((email) => email.toLowerCase());


type AdminRole = "main_admin" | "admin" | "editor";
type PermissionMap = Record<string, boolean>;

type AdminUserRow = {
  id: string;
  supabase_user_id: string | null;
  email: string | null;
  full_name: string | null;
  role: AdminRole;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  permissions: unknown;
};

const VALID_ROLES: AdminRole[] = ["main_admin", "admin", "editor"];

const ALL_PERMISSION_KEYS = [
  "admin:dashboard:view",
  "admin:users:manage",

  "money:view",
  "money:add_transactions",
  "money:edit_transactions",
  "money:edit_old_years",
  "money:hide_transactions",
  "money:delete_all",
  "money:delete_year",
  "money:manage_year_locks",
  "money:manage_sponsors",
  "money:change_sponsor_totals",
  "money:sync_website_payments",
  "money:print_reports",
  "money:export_reports",
  "money:manage_refunds",

  "donations:view",
  "donations:manage",

  "raffle:view",
  "raffle:manage",
  "raffle:draw_winners",

  "site_pages:view",
  "site_pages:manage",

  "audit_logs:view",
] as const;

const MAIN_ADMIN_PERMISSIONS = Object.fromEntries(
  ALL_PERMISSION_KEYS.map((key) => [key, true])
) as PermissionMap;

const ADMIN_DEFAULT_PERMISSIONS: PermissionMap = {
  "admin:dashboard:view": true,
  "admin:users:manage": false,

  "money:view": true,
  "money:add_transactions": true,
  "money:edit_transactions": false,
  "money:edit_old_years": false,
  "money:hide_transactions": false,
  "money:delete_all": false,
  "money:delete_year": false,
  "money:manage_year_locks": false,
  "money:manage_sponsors": false,
  "money:change_sponsor_totals": false,
  "money:sync_website_payments": false,
  "money:print_reports": true,
  "money:export_reports": true,
  "money:manage_refunds": false,

  "donations:view": false,
  "donations:manage": false,

  "raffle:view": false,
  "raffle:manage": false,
  "raffle:draw_winners": false,

  "site_pages:view": false,
  "site_pages:manage": false,

  "audit_logs:view": false,
};

const EDITOR_DEFAULT_PERMISSIONS: PermissionMap = {
  "admin:dashboard:view": true,
  "admin:users:manage": false,

  "money:view": false,
  "money:add_transactions": false,
  "money:edit_transactions": false,
  "money:edit_old_years": false,
  "money:hide_transactions": false,
  "money:delete_all": false,
  "money:delete_year": false,
  "money:manage_year_locks": false,
  "money:manage_sponsors": false,
  "money:change_sponsor_totals": false,
  "money:sync_website_payments": false,
  "money:print_reports": false,
  "money:export_reports": false,
  "money:manage_refunds": false,

  "donations:view": false,
  "donations:manage": false,

  "raffle:view": false,
  "raffle:manage": false,
  "raffle:draw_winners": false,

  "site_pages:view": true,
  "site_pages:manage": false,

  "audit_logs:view": false,
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function cleanFullName(value: unknown) {
  const name = String(value || "").trim();
  return name.length > 0 ? name : null;
}

function cleanRole(value: unknown): AdminRole {
  const role = String(value || "").trim().toLowerCase();

  if (VALID_ROLES.includes(role as AdminRole)) {
    return role as AdminRole;
  }

  return "admin";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function permissionsForRole(role: AdminRole): PermissionMap {
  if (role === "main_admin") return { ...MAIN_ADMIN_PERMISSIONS };
  if (role === "editor") return { ...EDITOR_DEFAULT_PERMISSIONS };
  return { ...ADMIN_DEFAULT_PERMISSIONS };
}

function normalisePermissionInput(value: unknown): PermissionMap {
  const permissions: PermissionMap = {};

  if (Array.isArray(value)) {
    for (const item of value) {
      const key = String(item || "").trim();
      if (ALL_PERMISSION_KEYS.includes(key as any)) {
        permissions[key] = true;
      }
    }

    return permissions;
  }

  if (value && typeof value === "object") {
    for (const [key, allowed] of Object.entries(value)) {
      if (ALL_PERMISSION_KEYS.includes(key as any)) {
        permissions[key] = allowed === true;
      }
    }
  }

  return permissions;
}

function cleanPermissions(value: unknown, role: AdminRole): PermissionMap {
  if (role === "main_admin") return permissionsForRole("main_admin");

  const defaults = permissionsForRole(role);
  const incoming = normalisePermissionInput(value);

  const cleaned: PermissionMap = { ...defaults };

  for (const key of ALL_PERMISSION_KEYS) {
    if (typeof incoming[key] === "boolean") {
      cleaned[key] = incoming[key] === true;
    }
  }

  return cleaned;
}

function permissionMapToKeys(value: unknown, role: AdminRole): string[] {
  if (role === "main_admin") return [...ALL_PERMISSION_KEYS];

  const permissions = cleanPermissions(value, role);

  return Object.entries(permissions)
    .filter(([, allowed]) => allowed === true)
    .map(([key]) => key);
}

function hasPermissionValue(permissions: unknown, permissionKey: string) {
  if (!permissions) return false;

  if (Array.isArray(permissions)) {
    return permissions.map(String).includes(permissionKey);
  }

  if (typeof permissions === "object") {
    return (permissions as Record<string, unknown>)[permissionKey] === true;
  }

  return false;
}

function isMainAdminEmail(email: unknown) {
  return MAIN_ADMIN_EMAILS.includes(String(email || "").trim().toLowerCase());
}

async function requireCurrentMainAdmin() {
  const cookieStore = await cookies();

  const adminId = cookieStore.get(ADMIN_ID_COOKIE)?.value || "";
  const adminEmail = cookieStore.get(ADMIN_EMAIL_COOKIE)?.value || "";
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value || "";

  if (!adminId || !adminEmail || !sessionToken) {
    throw new Error(
      "Unauthorized: your admin session cookies are missing. Please log out and log back in."
    );
  }

  const { data: admin, error } = await supabaseAdmin
    .from("admin_users")
    .select("id,email,role,is_active,supabase_user_id,permissions")
    .eq("id", adminId)
    .eq("email", adminEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!admin) {
    throw new Error(
      `Forbidden: no active admin_users row was found for ${adminEmail}.`
    );
  }

  const allowedByRole = admin.role === "main_admin";
  const allowedByEmail = isMainAdminEmail(admin.email || adminEmail);
  const allowedByPermission = hasPermissionValue(
    admin.permissions,
    "admin:users:manage"
  );

  if (!allowedByRole && !allowedByEmail && !allowedByPermission) {
    throw new Error(
      `Forbidden: ${admin.email || adminEmail} is logged in but is not allowed to manage admin users. Set role to main_admin or give admin:users:manage permission.`
    );
  }

  if (allowedByEmail && admin.role !== "main_admin") {
    await supabaseAdmin
      .from("admin_users")
      .update({
        role: "main_admin",
        permissions: MAIN_ADMIN_PERMISSIONS,
        updated_at: new Date().toISOString(),
      })
      .eq("id", admin.id);

    return {
      ...admin,
      role: "main_admin",
      permissions: MAIN_ADMIN_PERMISSIONS,
    };
  }

  return admin;
}

async function findSupabaseUserByEmail(email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) {
    console.error("findSupabaseUserByEmail error:", error);
    return null;
  }

  const found = data.users.find(
    (user) => String(user.email || "").toLowerCase() === email.toLowerCase()
  );

  return found || null;
}

async function buildAdminResponse(admin: AdminUserRow) {
  let supabaseUserId = admin.supabase_user_id || null;

  if (!supabaseUserId && admin.email) {
    const authUser = await findSupabaseUserByEmail(admin.email);

    if (authUser?.id) {
      supabaseUserId = authUser.id;

      await supabaseAdmin
        .from("admin_users")
        .update({
          supabase_user_id: authUser.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", admin.id);
    }
  }

  return {
    ...admin,
    supabase_user_id: supabaseUserId,
    permissions: permissionMapToKeys(admin.permissions, admin.role),
  };
}

export async function GET() {
  try {
    await requireCurrentMainAdmin();

    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .select(
        `
        id,
        supabase_user_id,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at,
        permissions
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    const admins = await Promise.all(
      ((data || []) as AdminUserRow[]).map(buildAdminResponse)
    );

    return jsonResponse({
      ok: true,
      permissions: ALL_PERMISSION_KEYS,
      admins,
    });
  } catch (error: unknown) {
    console.error("GET /api/admin/users error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to load admin users.";

    return jsonResponse(
      {
        ok: false,
        error: message,
        likelyFix:
          message.includes("Forbidden")
            ? "Set your admin_users role to main_admin, add your email to MAIN_ADMIN_EMAILS, or give admin:users:manage permission."
            : "Please log out and log back in so the custom admin cookies are refreshed.",
      },
      message.startsWith("Unauthorized") ? 401 : 403
    );
  }
}

export async function POST(req: Request) {
  try {
    const currentAdmin = await requireCurrentMainAdmin();

    const body = await req.json().catch(() => ({}));

    const email = cleanEmail(body.email);
    const fullName = cleanFullName(body.fullName ?? body.full_name);
    const role = cleanRole(body.role);
    const permissions = cleanPermissions(body.permissions, role);
    const isActive =
      typeof body.isActive === "boolean" ? body.isActive : true;

    if (!email) {
      return jsonResponse(
        {
          ok: false,
          error: "Please enter an email address.",
        },
        400
      );
    }

    if (!isValidEmail(email)) {
      return jsonResponse(
        {
          ok: false,
          error: "Please enter a valid email address.",
        },
        400
      );
    }

    const authUser = await findSupabaseUserByEmail(email);
    const supabaseUserId = authUser?.id || null;

    const query = supabaseUserId
      ? `email.eq.${email},supabase_user_id.eq.${supabaseUserId}`
      : `email.eq.${email}`;

    const { data: existingAdmin, error: existingError } = await supabaseAdmin
      .from("admin_users")
      .select("id,email,supabase_user_id")
      .or(query)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingAdmin?.id) {
      const { data, error } = await supabaseAdmin
        .from("admin_users")
        .update({
          email,
          full_name: fullName,
          role,
          is_active: isActive,
          permissions,
          supabase_user_id: supabaseUserId || existingAdmin.supabase_user_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingAdmin.id)
        .select(
          `
          id,
          supabase_user_id,
          email,
          full_name,
          role,
          is_active,
          created_at,
          updated_at,
          permissions
        `
        )
        .single();

      if (error) throw error;

      return jsonResponse({
        ok: true,
        admin: await buildAdminResponse(data as AdminUserRow),
        message: `${email} has been updated.`,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .insert({
        email,
        full_name: fullName,
        supabase_user_id: supabaseUserId,
        role,
        is_active: isActive,
        permissions,
        created_by: currentAdmin.id,
        updated_at: new Date().toISOString(),
      })
      .select(
        `
        id,
        supabase_user_id,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at,
        permissions
      `
      )
      .single();

    if (error) throw error;

    return jsonResponse({
      ok: true,
      admin: await buildAdminResponse(data as AdminUserRow),
      message: supabaseUserId
        ? `${email} has been added as ${role.replace("_", " ")}.`
        : `${email} has been added, but they have not created a Supabase Auth login yet.`,
    });
  } catch (error: unknown) {
    console.error("POST /api/admin/users error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to save admin user.";

    return jsonResponse(
      {
        ok: false,
        error: message,
        likelyFix:
          message.includes("Forbidden")
            ? "Set your admin_users role to main_admin, add your email to MAIN_ADMIN_EMAILS, or give admin:users:manage permission."
            : "Please log out and log back in so the custom admin cookies are refreshed.",
      },
      message.startsWith("Unauthorized") ? 401 : 403
    );
  }
}

export async function PATCH(req: Request) {
  try {
    await requireCurrentMainAdmin();

    const body = await req.json().catch(() => ({}));

    const id = String(body.id || "").trim();
    const role = cleanRole(body.role);
    const permissions = cleanPermissions(body.permissions, role);
    const fullName =
      "fullName" in body || "full_name" in body
        ? cleanFullName(body.fullName ?? body.full_name)
        : undefined;

    const isActive =
      typeof body.isActive === "boolean" ? body.isActive : true;

    if (!id) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing admin user ID.",
        },
        400
      );
    }

    const updatePayload: Record<string, unknown> = {
      role,
      is_active: isActive,
      permissions,
      updated_at: new Date().toISOString(),
    };

    if (fullName !== undefined) {
      updatePayload.full_name = fullName;
    }

    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .update(updatePayload)
      .eq("id", id)
      .select(
        `
        id,
        supabase_user_id,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at,
        permissions
      `
      )
      .single();

    if (error) throw error;

    return jsonResponse({
      ok: true,
      admin: await buildAdminResponse(data as AdminUserRow),
      message: "Admin user updated.",
    });
  } catch (error: unknown) {
    console.error("PATCH /api/admin/users error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to update admin user.";

    return jsonResponse(
      {
        ok: false,
        error: message,
        likelyFix:
          message.includes("Forbidden")
            ? "Set your admin_users role to main_admin, add your email to MAIN_ADMIN_EMAILS, or give admin:users:manage permission."
            : "Please log out and log back in so the custom admin cookies are refreshed.",
      },
      message.startsWith("Unauthorized") ? 401 : 403
    );
  }
}