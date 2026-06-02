import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

const MAIN_ADMIN_EMAILS = ["cameronlowndes@burtonpride.co.uk"];

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

function normaliseEmail(email: string | null | undefined) {
  return String(email || "").trim().toLowerCase();
}

function isMainAdminEmail(email: string | null | undefined) {
  return MAIN_ADMIN_EMAILS.map(normaliseEmail).includes(normaliseEmail(email));
}

export async function getCurrentAdminPermissions(): Promise<AdminPermissionResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    throw new Error("Unauthorized. Please sign in with your admin account.");
  }

  const email = normaliseEmail(user.email);

  if (!email) {
    throw new Error("Your signed-in account does not have an email address.");
  }

  const isMainAdmin = isMainAdminEmail(email);

  return {
    userId: user.id,
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
  const result = await getCurrentAdminPermissions();

  return {
    userId: result.userId,
    email: result.email,
    isMainAdmin: result.isMainAdmin,
    permissions: result.permissions,
  };
}

export async function requireMainAdmin() {
  const result = await getCurrentAdminPermissions();

  if (!result.isMainAdmin) {
    throw new Error("Main admin access required.");
  }

  return {
    userId: result.userId,
    email: result.email,
    isMainAdmin: result.isMainAdmin,
    permissions: result.permissions,
  };
}

export async function requirePermission(
  permission: keyof AdminPermissionResult["permissions"]
) {
  const result = await getCurrentAdminPermissions();

  if (!result.permissions[permission]) {
    throw new Error("You do not have permission to do this.");
  }

  return {
    userId: result.userId,
    email: result.email,
    isMainAdmin: result.isMainAdmin,
    permissions: result.permissions,
  };
}