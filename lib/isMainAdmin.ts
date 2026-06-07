import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

const MAIN_ADMIN_EMAILS = [
  "cameronlowndes@burtonpride.co.uk",
  "simonwhale@burtonpride.co.uk",
  "isaactimmins@burtonpride.co.uk",
  "olga@burtonpride.co.uk",
  "isaac@burtonpride.co.uk",
];

export type AdminPermissionResult = {
  userId: string;
  email: string;
  isMainAdmin: boolean;
  permissions: {
    canAddTransactions: boolean;
    canEditTransactions: boolean;
    canEditOldYears: boolean;
    canHideTransactions: boolean;
    canDeleteAllTransactions: boolean;
    canDeleteSelectedYear: boolean;
    canManageYearLocks: boolean;
    canManageSponsors: boolean;
    canChangeSponsorTotals: boolean;
    canSyncWebsitePayments: boolean;
    canPrintReports: boolean;
    canExportReports: boolean;
  };
};

function normaliseEmail(email: unknown) {
  return String(email || "").trim().toLowerCase();
}

function isMainAdminEmail(email: unknown) {
  return MAIN_ADMIN_EMAILS.map(normaliseEmail).includes(normaliseEmail(email));
}

async function getCookieValue(names: string[]) {
  const cookieStore = await cookies();

  for (const name of names) {
    const value = cookieStore.get(name)?.value;
    if (value) return value;
  }

  return "";
}

export async function getCurrentAdminPermissions(): Promise<AdminPermissionResult> {
  const adminId = await getCookieValue([
    "admin_user_id",
    "adminId",
    "admin_id",
    "bp_admin_id",
  ]);

  const adminEmailCookie = await getCookieValue([
    "admin_email",
    "adminEmail",
    "bp_admin_email",
  ]);

  if (!adminId && !adminEmailCookie) {
    throw new Error("Unauthorized. Please sign in with your admin account.");
  }

  let query = supabaseAdmin
    .from("admin_users")
    .select("id, email, is_active")
    .limit(1);

  if (adminId) {
    query = query.eq("id", adminId);
  } else {
    query = query.eq("email", normaliseEmail(adminEmailCookie));
  }

  const { data: admin, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Admin lookup failed: ${error.message}`);
  }

  if (!admin?.id) {
    throw new Error("Unauthorized. Admin account could not be found.");
  }

  if (admin.is_active === false) {
    throw new Error("Unauthorized. This admin account is not active.");
  }

  const email = normaliseEmail(admin.email);

  if (!email) {
    throw new Error("Admin account does not have an email address.");
  }

  const isMainAdmin = isMainAdminEmail(email);

  return {
    userId: String(admin.id),
    email,
    isMainAdmin,
    permissions: {
      canAddTransactions: true,

      canEditTransactions: isMainAdmin,
      canEditOldYears: isMainAdmin,
      canHideTransactions: isMainAdmin,
      canDeleteAllTransactions: isMainAdmin,
      canDeleteSelectedYear: isMainAdmin,
      canManageYearLocks: isMainAdmin,
      canManageSponsors: isMainAdmin,
      canChangeSponsorTotals: isMainAdmin,
      canSyncWebsitePayments: isMainAdmin,

      canPrintReports: true,
      canExportReports: true,
    },
  };
}

export async function requireAdmin() {
  return getCurrentAdminPermissions();
}

export async function requireMainAdmin() {
  const result = await getCurrentAdminPermissions();

  if (!result.isMainAdmin) {
    throw new Error("Main admin access required.");
  }

  return result;
}

export async function requirePermission(
  permission: keyof AdminPermissionResult["permissions"]
) {
  const result = await getCurrentAdminPermissions();

  if (!result.permissions[permission]) {
    throw new Error("You do not have permission to do this.");
  }

  return result;
}