import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMainAdmin } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminRole = "main_admin" | "admin" | "editor";

type PermissionMap = Record<string, boolean>;

type AdminPermissionRow = {
  is_allowed: boolean | null;
  admin_permissions:
    | {
        permission_key: string;
      }
    | {
        permission_key: string;
      }[]
    | null;
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

  "donations:view": false,
  "donations:manage": false,

  "raffle:view": false,
  "raffle:manage": false,
  "raffle:draw_winners": false,

  "site_pages:view": true,
  "site_pages:manage": false,

  "audit_logs:view": false,
};

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
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

function cleanPermissions(value: unknown, role: AdminRole): PermissionMap {
  if (role === "main_admin") return permissionsForRole("main_admin");

  const defaults = permissionsForRole(role);
  const incoming =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const cleaned: PermissionMap = { ...defaults };

  for (const key of ALL_PERMISSION_KEYS) {
    if (typeof incoming[key] === "boolean") {
      cleaned[key] = incoming[key] as boolean;
    }
  }

  /**
   * Only main admins should manage admin users.
   * This prevents accidentally creating another user manager via checkbox.
   */
  cleaned["admin:users:manage"] = false;

  return cleaned;
}

async function findClerkUserByEmail(email: string) {
  try {
    const clerk = await clerkClient();

    const users = await clerk.users.getUserList({
      emailAddress: [email],
      limit: 1,
    });

    return users.data[0] || null;
  } catch (error) {
    console.error("findClerkUserByEmail error:", error);
    return null;
  }
}

async function getClerkProfile(clerkUserId: string | null) {
  if (!clerkUserId) {
    return {
      clerk_email: null,
      clerk_name: null,
    };
  }

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(clerkUserId);

    const primaryEmail =
      user.emailAddresses.find(
        (email) => email.id === user.primaryEmailAddressId
      )?.emailAddress ||
      user.emailAddresses[0]?.emailAddress ||
      "";

    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.username ||
      "";

    return {
      clerk_email: primaryEmail || null,
      clerk_name: name || null,
    };
  } catch (error) {
    console.error("getClerkProfile error:", error);

    return {
      clerk_email: null,
      clerk_name: null,
    };
  }
}

async function loadAdminPermissions(adminUserId: string, role: AdminRole) {
  if (role === "main_admin") {
    return permissionsForRole("main_admin");
  }

  const permissions = permissionsForRole(role);

  const { data, error } = await supabaseAdmin
    .from("admin_user_permissions")
    .select(
      `
      is_allowed,
      admin_permissions!inner (
        permission_key
      )
      `
    )
    .eq("admin_user_id", adminUserId);

  if (error) {
    console.error("loadAdminPermissions error:", error);
    return permissions;
  }

  const rows = (data || []) as AdminPermissionRow[];

  for (const row of rows) {
    const permissionData = Array.isArray(row.admin_permissions)
      ? row.admin_permissions[0]
      : row.admin_permissions;

    const key = permissionData?.permission_key;

    if (key && ALL_PERMISSION_KEYS.includes(key as any)) {
      permissions[key] = row.is_allowed === true;
    }
  }

  permissions["admin:users:manage"] = false;

  return permissions;
}

async function saveAdminPermissions(
  adminUserId: string,
  role: AdminRole,
  permissionsInput: unknown
) {
  const permissions = cleanPermissions(permissionsInput, role);

  if (role === "main_admin") {
    await supabaseAdmin
      .from("admin_user_permissions")
      .delete()
      .eq("admin_user_id", adminUserId);

    return permissionsForRole("main_admin");
  }

  const keys = Object.keys(permissions);

  const { data: permissionRows, error: permissionError } = await supabaseAdmin
    .from("admin_permissions")
    .select("id, permission_key")
    .in("permission_key", keys);

  if (permissionError) {
    throw permissionError;
  }

  const rows =
    (permissionRows || []).map((permission) => ({
      admin_user_id: adminUserId,
      admin_permission_id: permission.id,
      is_allowed: permissions[permission.permission_key] === true,
    })) || [];

  await supabaseAdmin
    .from("admin_user_permissions")
    .delete()
    .eq("admin_user_id", adminUserId);

  if (rows.length === 0) {
    return permissions;
  }

  /**
   * Most builds use admin_permission_id. If your table uses permission_id,
   * the fallback below keeps the route working.
   */
  const { error: insertError } = await supabaseAdmin
    .from("admin_user_permissions")
    .insert(rows);

  if (!insertError) {
    return permissions;
  }

  const fallbackRows = rows.map((row) => ({
    admin_user_id: row.admin_user_id,
    permission_id: row.admin_permission_id,
    is_allowed: row.is_allowed,
  }));

  const { error: fallbackError } = await supabaseAdmin
    .from("admin_user_permissions")
    .insert(fallbackRows);

  if (fallbackError) {
    console.error("saveAdminPermissions insert error:", insertError);
    console.error("saveAdminPermissions fallback error:", fallbackError);
    throw fallbackError;
  }

  return permissions;
}

async function buildAdminResponse(admin: any) {
  const clerkProfile = await getClerkProfile(admin.clerk_user_id || null);
  const email = admin.email || clerkProfile.clerk_email || null;

  if (!admin.email && email) {
    await supabaseAdmin
      .from("admin_users")
      .update({
        email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", admin.id);
  }

  const permissions = await loadAdminPermissions(admin.id, admin.role);

  return {
    ...admin,
    email,
    clerk_email: clerkProfile.clerk_email,
    clerk_name: clerkProfile.clerk_name,
    permissions,
  };
}

export async function GET() {
  try {
    await requireMainAdmin();

    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .select(
        `
        id,
        clerk_user_id,
        email,
        role,
        is_active,
        created_at,
        updated_at
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const admins = await Promise.all((data || []).map(buildAdminResponse));

    return NextResponse.json({
      ok: true,
      permissions: ALL_PERMISSION_KEYS,
      admins,
    });
  } catch (error: any) {
    console.error("GET /api/admin/users error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load admin users.",
      },
      { status: error?.message === "Unauthorized" ? 401 : 403 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const currentAdmin = await requireMainAdmin();

    const body = await req.json().catch(() => ({}));

    const email = cleanEmail(body.email);
    const role = cleanRole(body.role);
    const permissions = cleanPermissions(body.permissions, role);
    const isActive =
      typeof body.isActive === "boolean" ? body.isActive : true;

    if (!email) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter an email address.",
        },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter a valid email address.",
        },
        { status: 400 }
      );
    }

    const clerkUser = await findClerkUserByEmail(email);
    const clerkUserId = clerkUser?.id || null;

    const { data: existingByEmail, error: existingEmailError } =
      await supabaseAdmin
        .from("admin_users")
        .select("id, email, clerk_user_id")
        .or(
          clerkUserId
            ? `email.eq.${email},clerk_user_id.eq.${clerkUserId}`
            : `email.eq.${email}`
        )
        .maybeSingle();

    if (existingEmailError) {
      throw existingEmailError;
    }

    if (existingByEmail?.id) {
      const { data, error } = await supabaseAdmin
        .from("admin_users")
        .update({
          email,
          role,
          is_active: isActive,
          clerk_user_id: clerkUserId || existingByEmail.clerk_user_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingByEmail.id)
        .select(
          `
          id,
          clerk_user_id,
          email,
          role,
          is_active,
          created_at,
          updated_at
        `
        )
        .single();

      if (error) {
        throw error;
      }

      await saveAdminPermissions(data.id, role, permissions);

      return NextResponse.json({
        ok: true,
        admin: await buildAdminResponse(data),
        message: `${email} has been updated.`,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .insert({
        email,
        clerk_user_id: clerkUserId,
        role,
        is_active: isActive,
        created_by: currentAdmin.id,
        updated_at: new Date().toISOString(),
      })
      .select(
        `
        id,
        clerk_user_id,
        email,
        role,
        is_active,
        created_at,
        updated_at
      `
      )
      .single();

    if (error) {
      throw error;
    }

    await saveAdminPermissions(data.id, role, permissions);

    return NextResponse.json({
      ok: true,
      admin: await buildAdminResponse(data),
      message: clerkUserId
        ? `${email} has been added as ${role.replace("_", " ")}.`
        : `${email} has been added, but they have not logged in yet. Their Clerk ID will be linked when they first sign in.`,
    });
  } catch (error: any) {
    console.error("POST /api/admin/users error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to save admin user.",
      },
      { status: error?.message === "Unauthorized" ? 401 : 403 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    await requireMainAdmin();

    const body = await req.json().catch(() => ({}));

    const id = String(body.id || "").trim();
    const role = cleanRole(body.role);
    const permissions = cleanPermissions(body.permissions, role);
    const isActive =
      typeof body.isActive === "boolean" ? body.isActive : true;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing admin user ID.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .update({
        role,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        `
        id,
        clerk_user_id,
        email,
        role,
        is_active,
        created_at,
        updated_at
      `
      )
      .single();

    if (error) {
      throw error;
    }

    await saveAdminPermissions(id, role, permissions);

    return NextResponse.json({
      ok: true,
      admin: await buildAdminResponse(data),
      message: "Admin user updated.",
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/users error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update admin user.",
      },
      { status: error?.message === "Unauthorized" ? 401 : 403 }
    );
  }
}
