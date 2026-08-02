import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";
const SESSION_COOKIE = "burton_admin_session";

const ADMIN_USERS_TABLE = "admin_users";

const MAIN_ADMIN_EMAILS = [
  "cameronlowndes@burtonpride.co.uk",
  "cameronlowndes@gmail.com",
  "simonwhale@burtonpride.co.uk",
  "isaactimmins@burtonpride.co.uk",
  "olga@burtonpride.co.uk",
].map((email) => email.toLowerCase());

type AdminRole = "main_admin" | "admin" | "editor";
type TwoFactorMethod = "email" | "totp";
type PermissionMap = Record<string, boolean>;

type AdminUserRow = {
  id: string;
  supabase_user_id: string | null;
  email: string | null;
  full_name: string | null;
  role: AdminRole;
  is_active: boolean;
  permissions: unknown;

  two_factor_required: boolean | null;
  two_factor_enabled: boolean | null;
  two_factor_email_enabled: boolean | null;
  two_factor_method: TwoFactorMethod | null;

  created_at: string | null;
  updated_at: string | null;
};

type CurrentAdmin = {
  id: string;
  email: string | null;
  role: AdminRole;
  is_active: boolean;
  permissions: unknown;
};

type RequestBody = Record<string, unknown>;

const VALID_ROLES: AdminRole[] = [
  "main_admin",
  "admin",
  "editor",
];

const VALID_TWO_FACTOR_METHODS: TwoFactorMethod[] = [
  "email",
  "totp",
];

/*
 * Keep this list in sync with AdminUsersClient_AllPortalFeatures.tsx.
 */
const ALL_PERMISSION_KEYS = [
  /*
   * Admin Portal
   */
  "admin:dashboard:view",
  "admin:users:view",
  "admin:users:manage",
  "admin:users:manage_2fa",
  "admin:sidebar:manage",

  /*
   * Money Management
   */
  "money:view",
  "money:add_transactions",
  "money:edit_transactions",
  "money:hide_transactions",
  "money:restore_transactions",
  "money:edit_old_years",
  "money:manage_month_locks",
  "money:manage_year_locks",
  "money:delete_year",
  "money:delete_all",

  "money:budgets:view",
  "money:budgets:manage",

  "money:sponsors:view",
  "money:sponsors:manage",
  "money:sponsors:change_totals",

  "money:suppliers:view",
  "money:suppliers:manage",

  "money:refunds:view",
  "money:manage_refunds",

  "money:direct_debits:view",
  "money:direct_debits:manage",

  "money:reconciliation:view",
  "money:reconciliation:manage",

  "money:saving_targets:manage",
  "money:csv_import",
  "money:sync_website_payments",
  "money:receipts:manage",
  "money:print_reports",
  "money:export_reports",

  /*
   * Event Hub
   */
  "event_hub:view",
  "event_hub:events:manage",
  "event_hub:contacts:view",
  "event_hub:contacts:manage",
  "event_hub:checklists:view",
  "event_hub:checklists:manage",
  "event_hub:applications:view",
  "event_hub:applications:manage",
  "event_hub:files:view",
  "event_hub:files:manage",
  "event_hub:email",
  "event_hub:export",

  "event_audit:view",
  "event_audit:view_all_events",
  "event_audit:view_security",

  /*
   * Stock Management
   */
  "stock:view",
  "stock:items:view",
  "stock:items:manage",
  "stock:items:delete",
  "stock:quantity:adjust",
  "stock:movements:view",
  "stock:movements:create",
  "stock:locations:view",
  "stock:locations:manage",
  "stock:locations:delete",
  "stock:low_stock:view",
  "stock:orders:view",
  "stock:orders:manage",
  "stock:deliveries:manage",
  "stock:suppliers:view",
  "stock:suppliers:manage",
  "stock:suppliers:override_block",
  "stock:export",
  "stock:audit:view",

  /*
   * Community Art
   */
  "community_art:view",
  "community_art:manage",
  "community_art:add",
  "community_art:files",

  /*
   * Donations
   */
  "donations:view",
  "donations:manage",
  "donations:export",

  /*
   * Raffle
   */
  "raffle:view",
  "raffle:manage",
  "raffle:draw_winners",

  /*
   * Website and content
   */
  "site_pages:view",
  "site_pages:manage",
  "site_pages:hide",

  "website:sponsors:view",
  "website:sponsors:manage",
  "website:forms:view",
  "website:forms:manage",

  /*
   * Email
   */
  "email:view",
  "email:send",
  "email:templates:manage",

  /*
   * Audit and security
   */
  "audit_logs:view",
  "audit_logs:view_security",
  "audit_logs:export",

  "security:settings:view",
  "security:settings:manage",
] as const;

type PermissionKey = (typeof ALL_PERMISSION_KEYS)[number];

const MAIN_ADMIN_PERMISSIONS = createPermissionMap(
  ALL_PERMISSION_KEYS,
);

const ADMIN_DEFAULT_PERMISSION_KEYS: PermissionKey[] = [
  "admin:dashboard:view",
  "money:view",
  "event_hub:view",
  "stock:view",
  "community_art:view",
  "site_pages:view",
  "audit_logs:view",
];

const EDITOR_DEFAULT_PERMISSION_KEYS: PermissionKey[] = [
  "admin:dashboard:view",
  "community_art:view",
  "community_art:manage",
  "site_pages:view",
  "site_pages:manage",
  "website:sponsors:view",
  "website:sponsors:manage",
];

const ADMIN_DEFAULT_PERMISSIONS = createPermissionMap(
  ADMIN_DEFAULT_PERMISSION_KEYS,
);

const EDITOR_DEFAULT_PERMISSIONS = createPermissionMap(
  EDITOR_DEFAULT_PERMISSION_KEYS,
);

const ADMIN_SELECT = `
  id,
  supabase_user_id,
  email,
  full_name,
  role,
  is_active,
  permissions,
  two_factor_required,
  two_factor_enabled,
  two_factor_email_enabled,
  two_factor_method,
  created_at,
  updated_at
`;

function createPermissionMap(
  enabledKeys: readonly string[],
): PermissionMap {
  const enabled = new Set(enabledKeys);

  return Object.fromEntries(
    ALL_PERMISSION_KEYS.map((key) => [
      key,
      enabled.has(key),
    ]),
  ) as PermissionMap;
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function safeErrorResponse(
  status: number,
  error: string,
  code: string,
) {
  return jsonResponse(
    {
      ok: false,
      error,
      code,
    },
    status,
  );
}

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function cleanFullName(value: unknown) {
  const name = String(value || "").trim();

  if (!name) return null;

  return name.slice(0, 160);
}

function cleanRole(value: unknown): AdminRole {
  const role = String(value || "")
    .trim()
    .toLowerCase();

  if (VALID_ROLES.includes(role as AdminRole)) {
    return role as AdminRole;
  }

  return "admin";
}

function cleanTwoFactorMethod(
  value: unknown,
  fallback: TwoFactorMethod = "email",
): TwoFactorMethod {
  const method = String(value || "")
    .trim()
    .toLowerCase();

  if (
    VALID_TWO_FACTOR_METHODS.includes(
      method as TwoFactorMethod,
    )
  ) {
    return method as TwoFactorMethod;
  }

  return fallback;
}

function readBoolean(
  value: unknown,
  fallback: boolean,
) {
  return typeof value === "boolean" ? value : fallback;
}

function isValidEmail(email: string) {
  return (
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function permissionsForRole(
  role: AdminRole,
): PermissionMap {
  if (role === "main_admin") {
    return { ...MAIN_ADMIN_PERMISSIONS };
  }

  if (role === "editor") {
    return { ...EDITOR_DEFAULT_PERMISSIONS };
  }

  return { ...ADMIN_DEFAULT_PERMISSIONS };
}

function isPermissionKey(
  value: string,
): value is PermissionKey {
  return ALL_PERMISSION_KEYS.includes(
    value as PermissionKey,
  );
}

function normalisePermissionInput(
  value: unknown,
): Partial<PermissionMap> {
  const permissions: Partial<PermissionMap> = {};

  if (Array.isArray(value)) {
    for (const item of value) {
      const key = String(item || "").trim();

      if (isPermissionKey(key)) {
        permissions[key] = true;
      }
    }

    return permissions;
  }

  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    for (const [key, allowed] of Object.entries(value)) {
      if (isPermissionKey(key)) {
        permissions[key] = allowed === true;
      }
    }
  }

  return permissions;
}

function cleanPermissions(
  value: unknown,
  role: AdminRole,
): PermissionMap {
  if (role === "main_admin") {
    return permissionsForRole("main_admin");
  }

  const defaults = permissionsForRole(role);
  const incoming = normalisePermissionInput(value);

  const cleaned: PermissionMap = {
    ...defaults,
  };

  for (const key of ALL_PERMISSION_KEYS) {
    if (typeof incoming[key] === "boolean") {
      cleaned[key] = incoming[key] === true;
    }
  }

  return cleaned;
}

function permissionMapToKeys(
  value: unknown,
  role: AdminRole,
): PermissionKey[] {
  if (role === "main_admin") {
    return [...ALL_PERMISSION_KEYS];
  }

  const permissions = cleanPermissions(value, role);

  return ALL_PERMISSION_KEYS.filter(
    (key) => permissions[key] === true,
  );
}

function hasPermissionValue(
  permissions: unknown,
  permissionKey: PermissionKey,
) {
  if (!permissions) return false;

  if (Array.isArray(permissions)) {
    return permissions
      .map((item) => String(item))
      .includes(permissionKey);
  }

  if (typeof permissions === "object") {
    return (
      (permissions as Record<string, unknown>)[
        permissionKey
      ] === true
    );
  }

  return false;
}

function isMainAdminEmail(email: unknown) {
  return MAIN_ADMIN_EMAILS.includes(
    String(email || "")
      .trim()
      .toLowerCase(),
  );
}

function getSafeStatus(error: unknown) {
  if (!(error instanceof Error)) return 500;

  if (error.message === "AUTH_REQUIRED") return 401;
  if (error.message === "ACCESS_DENIED") return 403;

  return 500;
}

function getSafeMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "The request could not be completed.";
  }

  if (error.message === "AUTH_REQUIRED") {
    return "Your secure admin session has expired. Please sign in again.";
  }

  if (error.message === "ACCESS_DENIED") {
    return "You do not have permission to manage admin users.";
  }

  return "The request could not be completed.";
}

async function requireCurrentAdminManager(): Promise<CurrentAdmin> {
  const cookieStore = await cookies();

  const adminId =
    cookieStore.get(ADMIN_ID_COOKIE)?.value || "";
  const adminEmail =
    cookieStore.get(ADMIN_EMAIL_COOKIE)?.value || "";
  const sessionToken =
    cookieStore.get(SESSION_COOKIE)?.value || "";

  if (!adminId || !adminEmail || !sessionToken) {
    throw new Error("AUTH_REQUIRED");
  }

  const { data: admin, error } = await supabaseAdmin
    .from(ADMIN_USERS_TABLE)
    .select(
      "id,email,role,is_active,permissions",
    )
    .eq("id", adminId)
    .eq("email", adminEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error(
      "requireCurrentAdminManager database error:",
      error,
    );

    throw new Error("ACCESS_DENIED");
  }

  if (!admin) {
    throw new Error("AUTH_REQUIRED");
  }

  const allowed =
    admin.role === "main_admin" ||
    isMainAdminEmail(admin.email || adminEmail) ||
    hasPermissionValue(
      admin.permissions,
      "admin:users:manage",
    );

  if (!allowed) {
    throw new Error("ACCESS_DENIED");
  }

  return {
    id: String(admin.id),
    email: admin.email,
    role: cleanRole(admin.role),
    is_active: admin.is_active === true,
    permissions: admin.permissions,
  };
}

async function findSupabaseUserByEmail(
  email: string,
) {
  const perPage = 200;
  let page = 1;

  while (page <= 10) {
    const { data, error } =
      await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

    if (error) {
      console.error(
        "findSupabaseUserByEmail error:",
        error,
      );

      return null;
    }

    const found = data.users.find(
      (user) =>
        String(user.email || "").toLowerCase() ===
        email.toLowerCase(),
    );

    if (found) return found;

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return null;
}

async function linkSupabaseUserIfNeeded(
  admin: AdminUserRow,
) {
  if (admin.supabase_user_id || !admin.email) {
    return admin.supabase_user_id || null;
  }

  const authUser = await findSupabaseUserByEmail(
    admin.email,
  );

  if (!authUser?.id) return null;

  const { error } = await supabaseAdmin
    .from(ADMIN_USERS_TABLE)
    .update({
      supabase_user_id: authUser.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", admin.id);

  if (error) {
    console.error(
      "Failed to link Supabase Auth user:",
      error,
    );

    return null;
  }

  return authUser.id;
}

async function buildAdminResponse(
  admin: AdminUserRow,
) {
  const supabaseUserId =
    await linkSupabaseUserIfNeeded(admin);

  return {
    id: admin.id,
    supabase_user_id: supabaseUserId,
    email: admin.email,
    full_name: admin.full_name,
    role: admin.role,
    is_active: admin.is_active,
    permissions: permissionMapToKeys(
      admin.permissions,
      admin.role,
    ),

    two_factor_required:
      admin.two_factor_required !== false,
    two_factor_enabled:
      admin.two_factor_enabled === true,
    two_factor_email_enabled:
      admin.two_factor_email_enabled === true,
    two_factor_method:
      admin.two_factor_method || null,

    created_at: admin.created_at,
    updated_at: admin.updated_at,
  };
}

async function getAdminById(id: string) {
  const { data, error } = await supabaseAdmin
    .from(ADMIN_USERS_TABLE)
    .select(ADMIN_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return (data || null) as AdminUserRow | null;
}

async function countActiveMainAdmins() {
  const { count, error } = await supabaseAdmin
    .from(ADMIN_USERS_TABLE)
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("role", "main_admin")
    .eq("is_active", true);

  if (error) throw error;

  return count || 0;
}

async function ensureMainAdminSafety({
  currentAdmin,
  targetAdmin,
  nextRole,
  nextIsActive,
}: {
  currentAdmin: CurrentAdmin;
  targetAdmin: AdminUserRow;
  nextRole: AdminRole;
  nextIsActive: boolean;
}) {
  if (
    currentAdmin.id === targetAdmin.id &&
    nextIsActive === false
  ) {
    throw new Error(
      "SELF_DEACTIVATION_BLOCKED",
    );
  }

  const removingMainAdmin =
    targetAdmin.role === "main_admin" &&
    (nextRole !== "main_admin" ||
      nextIsActive === false);

  if (!removingMainAdmin) return;

  const activeMainAdminCount =
    await countActiveMainAdmins();

  if (activeMainAdminCount <= 1) {
    throw new Error(
      "LAST_MAIN_ADMIN_BLOCKED",
    );
  }
}

function safeMutationError(
  error: unknown,
  fallbackCode: string,
) {
  if (
    error instanceof Error &&
    error.message === "SELF_DEACTIVATION_BLOCKED"
  ) {
    return safeErrorResponse(
      409,
      "You cannot deactivate your own active admin account.",
      "SELF_DEACTIVATION_BLOCKED",
    );
  }

  if (
    error instanceof Error &&
    error.message === "LAST_MAIN_ADMIN_BLOCKED"
  ) {
    return safeErrorResponse(
      409,
      "The final active main administrator cannot be removed or deactivated.",
      "LAST_MAIN_ADMIN_BLOCKED",
    );
  }

  const status = getSafeStatus(error);

  return safeErrorResponse(
    status,
    getSafeMessage(error),
    status === 401
      ? "AUTH_REQUIRED"
      : status === 403
        ? "ACCESS_DENIED"
        : fallbackCode,
  );
}

export async function GET() {
  try {
    await requireCurrentAdminManager();

    const { data, error } = await supabaseAdmin
      .from(ADMIN_USERS_TABLE)
      .select(ADMIN_SELECT)
      .order("created_at", {
        ascending: false,
      });

    if (error) throw error;

    const admins = await Promise.all(
      ((data || []) as AdminUserRow[]).map(
        buildAdminResponse,
      ),
    );

    return jsonResponse({
      ok: true,
      permissions: [...ALL_PERMISSION_KEYS],
      permissionCount: ALL_PERMISSION_KEYS.length,
      admins,
    });
  } catch (error: unknown) {
    console.error(
      "GET /api/admin/settings/users failed:",
      error,
    );

    return safeMutationError(
      error,
      "ADMIN_USERS_LOAD_FAILED",
    );
  }
}

export async function POST(request: Request) {
  try {
    const currentAdmin =
      await requireCurrentAdminManager();

    const body = (await request
      .json()
      .catch(() => ({}))) as RequestBody;

    const email = cleanEmail(body.email);
    const fullName = cleanFullName(
      body.fullName ?? body.full_name,
    );
    const role = cleanRole(body.role);
    const permissions = cleanPermissions(
      body.permissions,
      role,
    );

    const isActive = readBoolean(
      body.isActive,
      true,
    );

    const twoFactorRequired = readBoolean(
      body.twoFactorRequired,
      true,
    );

    const twoFactorEnabled = readBoolean(
      body.twoFactorEnabled,
      twoFactorRequired,
    );

    const twoFactorMethod =
      cleanTwoFactorMethod(
        body.twoFactorMethod,
        "email",
      );

    const twoFactorEmailEnabled = readBoolean(
      body.twoFactorEmailEnabled,
      twoFactorEnabled &&
        twoFactorMethod === "email",
    );

    if (!email) {
      return safeErrorResponse(
        400,
        "Please enter an email address.",
        "EMAIL_REQUIRED",
      );
    }

    if (!isValidEmail(email)) {
      return safeErrorResponse(
        400,
        "Please enter a valid email address.",
        "EMAIL_INVALID",
      );
    }

    const authUser =
      await findSupabaseUserByEmail(email);

    const supabaseUserId = authUser?.id || null;

    let existingAdmin: {
      id: string;
      supabase_user_id: string | null;
    } | null = null;

    const { data: existingByEmail, error: emailError } =
      await supabaseAdmin
        .from(ADMIN_USERS_TABLE)
        .select("id,supabase_user_id")
        .eq("email", email)
        .maybeSingle();

    if (emailError) throw emailError;

    existingAdmin = existingByEmail;

    if (!existingAdmin && supabaseUserId) {
      const {
        data: existingBySupabaseId,
        error: supabaseIdError,
      } = await supabaseAdmin
        .from(ADMIN_USERS_TABLE)
        .select("id,supabase_user_id")
        .eq("supabase_user_id", supabaseUserId)
        .maybeSingle();

      if (supabaseIdError) throw supabaseIdError;

      existingAdmin = existingBySupabaseId;
    }

    const now = new Date().toISOString();

    const payload = {
      email,
      full_name: fullName,
      role,
      is_active: isActive,
      permissions,

      supabase_user_id:
        supabaseUserId ||
        existingAdmin?.supabase_user_id ||
        null,

      two_factor_required: twoFactorRequired,
      two_factor_enabled: twoFactorEnabled,
      two_factor_email_enabled:
        twoFactorEmailEnabled,
      two_factor_method: twoFactorEnabled
        ? twoFactorMethod
        : null,

      updated_at: now,
    };

    if (existingAdmin?.id) {
      const currentTarget = await getAdminById(
        existingAdmin.id,
      );

      if (!currentTarget) {
        return safeErrorResponse(
          404,
          "The admin user could not be found.",
          "ADMIN_NOT_FOUND",
        );
      }

      await ensureMainAdminSafety({
        currentAdmin,
        targetAdmin: currentTarget,
        nextRole: role,
        nextIsActive: isActive,
      });

      const { data, error } = await supabaseAdmin
        .from(ADMIN_USERS_TABLE)
        .update(payload)
        .eq("id", existingAdmin.id)
        .select(ADMIN_SELECT)
        .single();

      if (error) throw error;

      return jsonResponse({
        ok: true,
        created: false,
        admin: await buildAdminResponse(
          data as AdminUserRow,
        ),
        message: "Admin user updated successfully.",
      });
    }

    const { data, error } = await supabaseAdmin
      .from(ADMIN_USERS_TABLE)
      .insert({
        ...payload,
        created_by: currentAdmin.id,
        created_at: now,
      })
      .select(ADMIN_SELECT)
      .single();

    if (error) throw error;

    return jsonResponse(
      {
        ok: true,
        created: true,
        admin: await buildAdminResponse(
          data as AdminUserRow,
        ),
        message: supabaseUserId
          ? "Admin user added successfully."
          : "Admin access record added. The user still needs a matching Supabase Auth account.",
      },
      201,
    );
  } catch (error: unknown) {
    console.error(
      "POST /api/admin/settings/users failed:",
      error,
    );

    return safeMutationError(
      error,
      "ADMIN_USER_SAVE_FAILED",
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const currentAdmin =
      await requireCurrentAdminManager();

    const body = (await request
      .json()
      .catch(() => ({}))) as RequestBody;

    const id = String(body.id || "").trim();

    if (!id) {
      return safeErrorResponse(
        400,
        "Missing admin user ID.",
        "ADMIN_ID_REQUIRED",
      );
    }

    const existingAdmin = await getAdminById(id);

    if (!existingAdmin) {
      return safeErrorResponse(
        404,
        "The admin user could not be found.",
        "ADMIN_NOT_FOUND",
      );
    }

    const role =
      "role" in body
        ? cleanRole(body.role)
        : existingAdmin.role;

    const isActive =
      typeof body.isActive === "boolean"
        ? body.isActive
        : existingAdmin.is_active;

    const permissions =
      "permissions" in body
        ? cleanPermissions(
            body.permissions,
            role,
          )
        : cleanPermissions(
            existingAdmin.permissions,
            role,
          );

    const fullName =
      "fullName" in body ||
      "full_name" in body
        ? cleanFullName(
            body.fullName ?? body.full_name,
          )
        : existingAdmin.full_name;

    const twoFactorRequired =
      typeof body.twoFactorRequired === "boolean"
        ? body.twoFactorRequired
        : existingAdmin.two_factor_required !== false;

    const twoFactorEnabled =
      typeof body.twoFactorEnabled === "boolean"
        ? body.twoFactorEnabled
        : existingAdmin.two_factor_enabled === true;

    const twoFactorMethod =
      "twoFactorMethod" in body
        ? cleanTwoFactorMethod(
            body.twoFactorMethod,
            existingAdmin.two_factor_method ||
              "email",
          )
        : existingAdmin.two_factor_method ||
          "email";

    const twoFactorEmailEnabled =
      typeof body.twoFactorEmailEnabled === "boolean"
        ? body.twoFactorEmailEnabled
        : existingAdmin.two_factor_email_enabled ===
          true;

    await ensureMainAdminSafety({
      currentAdmin,
      targetAdmin: existingAdmin,
      nextRole: role,
      nextIsActive: isActive,
    });

    const { data, error } = await supabaseAdmin
      .from(ADMIN_USERS_TABLE)
      .update({
        role,
        is_active: isActive,
        permissions,
        full_name: fullName,

        two_factor_required: twoFactorRequired,
        two_factor_enabled: twoFactorEnabled,
        two_factor_email_enabled:
          twoFactorEmailEnabled,
        two_factor_method: twoFactorEnabled
          ? twoFactorMethod
          : null,

        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(ADMIN_SELECT)
      .single();

    if (error) throw error;

    return jsonResponse({
      ok: true,
      admin: await buildAdminResponse(
        data as AdminUserRow,
      ),
      message: "Admin user updated successfully.",
    });
  } catch (error: unknown) {
    console.error(
      "PATCH /api/admin/settings/users failed:",
      error,
    );

    return safeMutationError(
      error,
      "ADMIN_USER_UPDATE_FAILED",
    );
  }
}
