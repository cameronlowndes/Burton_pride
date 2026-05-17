import { auth, clerkClient } from "@clerk/nextjs/server";

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
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);

  const primaryEmail =
    user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId
    )?.emailAddress ||
    user.emailAddresses[0]?.emailAddress ||
    "";

  const isMainAdmin = isMainAdminEmail(primaryEmail);

  return {
    userId,
    email: primaryEmail,
    isMainAdmin,
    permissions: {
      /**
       * Normal admins can add new transactions.
       */
      canAddTransactions: true,

      /**
       * Main admin only permissions.
       */
      canEditTransactions: isMainAdmin,
      canEditOldYears: isMainAdmin,
      canHideTransactions: isMainAdmin,
      canDeleteAllTransactions: isMainAdmin,
      canDeleteSelectedYear: isMainAdmin,
      canManageYearLocks: isMainAdmin,
      canManageSponsors: isMainAdmin,
      canChangeSponsorTotals: isMainAdmin,
      canSyncWebsitePayments: isMainAdmin,

      /**
       * Reporting can stay open to all admins.
       */
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
    throw new Error("Main admin access required");
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