import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export type AccountingLockActor = {
  userId: string;
  adminName: string;
  adminEmail: string | null;
};

export type AccountingLockType = "year" | "month";

export type AccountingLockAuditAction =
  | "lock_year"
  | "unlock_year"
  | "lock_month"
  | "unlock_month";

type LockRow = {
  id?: string;
  year?: string | number | null;
  month_key?: string | null;
  is_locked?: boolean | null;
  locked_at?: string | null;
  locked_by?: string | null;
  unlocked_at?: string | null;
  unlocked_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type WriteAccountingLockAuditLogArgs = {
  actor: AccountingLockActor;
  action: AccountingLockAuditAction;
  lockType: AccountingLockType;
  year: string;
  monthKey?: string | null;
  before: LockRow | null;
  after: LockRow;
  createdFrom: string;
};

function getRecordTitle({
  lockType,
  year,
  monthKey,
}: {
  lockType: AccountingLockType;
  year: string;
  monthKey?: string | null;
}) {
  return lockType === "year"
    ? `Year lock: ${year}`
    : `Month lock: ${monthKey || "Unknown month"}`;
}

function getDescription({
  action,
  year,
  monthKey,
}: {
  action: AccountingLockAuditAction;
  year: string;
  monthKey?: string | null;
}) {
  if (action === "lock_year") {
    return `Locked the full ${year} accounting year.`;
  }

  if (action === "unlock_year") {
    return `Unlocked the full ${year} accounting year.`;
  }

  if (action === "lock_month") {
    return `Locked the ${monthKey || "unknown"} accounting month.`;
  }

  return `Unlocked the ${monthKey || "unknown"} accounting month.`;
}

export async function writeAccountingLockAuditLog({
  actor,
  action,
  lockType,
  year,
  monthKey = null,
  before,
  after,
  createdFrom,
}: WriteAccountingLockAuditLogArgs) {
  const now = new Date().toISOString();

  const metadata = {
    actor_id: actor.userId,
    actor_name: actor.adminName,
    actor_email: actor.adminEmail,
    created_by: actor.adminName,
    created_by_email: actor.adminEmail,
    source: lockType === "year" ? "money_year_locks" : "money_month_locks",
    created_from: createdFrom,
    lock_type: lockType,
    year,
    month_key: monthKey,
    description: getDescription({
      action,
      year,
      monthKey,
    }),
  };

  const commonPayload = {
    action,
    transaction_id: null,
    transaction_title: getRecordTitle({
      lockType,
      year,
      monthKey,
    }),
    before_data: before,
    after_data: after,
    changed_fields: {
      is_locked: {
        before: before?.is_locked ?? null,
        after: after.is_locked ?? null,
      },
    },
    metadata,
    created_at: now,
  };

  /**
   * These attempts keep this helper compatible with older and newer
   * admin_money_audit_logs schemas while your database migration settles.
   */
  const attempts = [
    {
      ...commonPayload,
      created_by: actor.adminName,
      created_by_email: actor.adminEmail,
      actor_user_id: actor.userId,
      actor_name: actor.adminName,
      actor_email: actor.adminEmail,
    },
    {
      ...commonPayload,
      created_by: actor.adminName,
      created_by_email: actor.adminEmail,
    },
    commonPayload,
  ];

  let lastError: any = null;

  for (const payload of attempts) {
    const { error } = await supabaseAdmin
      .from("admin_money_audit_logs")
      .insert(payload);

    if (!error) return;

    lastError = error;
  }

  throw new Error(
    lastError?.message ||
      "The accounting lock changed, but the audit log could not be created."
  );
}
