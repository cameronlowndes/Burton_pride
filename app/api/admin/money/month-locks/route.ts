import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";
const SESSION_COOKIE = "burton_admin_session";
const PASSWORD_ACTION_KEY = "delete_all_donations";
const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

type CurrentAdmin = {
  userId: string;
  adminName: string;
  adminEmail: string | null;
};

type MonthLockRow = {
  id?: string;
  year: string;
  month_key: string;
  is_locked: boolean;
  locked_at?: string | null;
  locked_by?: string | null;
  unlocked_at?: string | null;
  unlocked_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function normaliseEmail(value: unknown) {
  return cleanString(value).toLowerCase();
}

function validYear(value: string) {
  return /^\d{4}$/.test(value);
}

function nameFromEmail(email?: string | null) {
  const cleanEmail = cleanString(email);

  if (!cleanEmail || !cleanEmail.includes("@")) return "";

  return cleanEmail
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}

function getPassword(body: Record<string, unknown>) {
  return cleanString(
    body.password ||
      body.mainAdminPassword ||
      body.adminPassword ||
      body.monthLockPassword
  );
}

function getAction(body: Record<string, unknown>) {
  return cleanString(body.action).toLowerCase();
}

function getMonthKey(body: Record<string, unknown>) {
  return cleanString(
    body.monthKey ||
      body.month_key ||
      body.periodKey ||
      body.period_key
  );
}

function getYear(body: Record<string, unknown>, monthKey: string) {
  return cleanString(body.year || body.selectedYear || monthKey.slice(0, 4));
}

function toLockedMonths(rows: MonthLockRow[]) {
  return rows
    .filter(
      (row) =>
        row.is_locked === true && MONTH_KEY_PATTERN.test(cleanString(row.month_key))
    )
    .map((row) => cleanString(row.month_key));
}

async function getCurrentAdmin(): Promise<CurrentAdmin> {
  const cookieStore = await cookies();

  const adminId = cookieStore.get(ADMIN_ID_COOKIE)?.value || "";
  const adminEmail = cookieStore.get(ADMIN_EMAIL_COOKIE)?.value || "";
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value || "";

  if (!adminId || !adminEmail || !sessionToken) {
    throw new Error("You must be signed in.");
  }

  const { data: admin, error } = await supabaseAdmin
    .from("admin_users")
    .select("id, email, name, full_name, role, is_active")
    .eq("id", adminId)
    .eq("email", normaliseEmail(adminEmail))
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load admin account.");
  }

  if (!admin) {
    throw new Error("No active admin account is linked to this admin session.");
  }

  if (admin.role !== "main_admin") {
    throw new Error("Main admin access required.");
  }

  const cleanEmail = normaliseEmail(admin.email || adminEmail) || null;

  return {
    userId: String(admin.id),
    adminName:
      cleanString(admin.name) ||
      cleanString(admin.full_name) ||
      nameFromEmail(cleanEmail) ||
      "Unknown admin",
    adminEmail: cleanEmail,
  };
}

async function verifyMainAdminPassword(password: string) {
  if (!password) {
    return {
      ok: false,
      status: 400,
      error: "Please enter the main admin password.",
      details: null,
    };
  }

  const { data: setting, error } = await supabaseAdmin
    .from("admin_delete_settings")
    .select("password_hash")
    .eq("action_key", PASSWORD_ACTION_KEY)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 500,
      error: "Failed to load the main admin password setting.",
      details: error.message,
    };
  }

  if (!setting?.password_hash) {
    return {
      ok: false,
      status: 400,
      error: "No main admin password has been set yet.",
      details:
        "Set the main admin delete password first in the Main Admin Delete Password page.",
    };
  }

  const matches = await bcrypt.compare(password, setting.password_hash);

  if (!matches) {
    return {
      ok: false,
      status: 403,
      error: "Main admin password is wrong.",
      details: null,
    };
  }

  return { ok: true, status: 200, error: null, details: null };
}

function authStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message === "You must be signed in." ||
    message === "No active admin account is linked to this admin session."
  ) {
    return 401;
  }

  if (message === "Main admin access required.") return 403;

  return 500;
}

async function loadActiveMonthLocks() {
  const { data, error } = await supabaseAdmin
    .from("money_month_locks")
    .select("*")
    .eq("is_locked", true)
    .order("month_key", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load active month locks.");
  }

  return (data || []) as MonthLockRow[];
}

async function restorePreviousLockState({
  monthKey,
  previous,
}: {
  monthKey: string;
  previous: MonthLockRow | null;
}) {
  if (!previous) {
    await supabaseAdmin
      .from("money_month_locks")
      .delete()
      .eq("month_key", monthKey);
    return;
  }

  await supabaseAdmin
    .from("money_month_locks")
    .upsert(previous, { onConflict: "month_key" });
}

async function writeMonthLockAuditLog({
  actor,
  action,
  year,
  monthKey,
  before,
  after,
}: {
  actor: CurrentAdmin;
  action: "lock_month" | "unlock_month";
  year: string;
  monthKey: string;
  before: MonthLockRow | null;
  after: MonthLockRow;
}) {
  const now = new Date().toISOString();

  const description =
    action === "lock_month"
      ? `Locked the ${monthKey} accounting month.`
      : `Unlocked the ${monthKey} accounting month.`;

  const metadata = {
    actor_id: actor.userId,
    actor_name: actor.adminName,
    actor_email: actor.adminEmail,
    created_by: actor.adminName,
    created_by_email: actor.adminEmail,
    source: "money_month_locks",
    created_from: "app/api/admin/money/month-locks/route.ts",
    lock_type: "month",
    year,
    month_key: monthKey,
    description,
  };

  const attempts = [
    {
      action,
      transaction_id: null,
      transaction_title: `Month lock: ${monthKey}`,
      before_data: before,
      after_data: after,
      changed_fields: {
        is_locked: {
          before: before?.is_locked ?? null,
          after: after.is_locked,
        },
      },
      metadata,
      created_by: actor.adminName,
      created_by_email: actor.adminEmail,
      actor_user_id: actor.userId,
      actor_name: actor.adminName,
      actor_email: actor.adminEmail,
      created_at: now,
    },
    {
      action,
      transaction_id: null,
      transaction_title: `Month lock: ${monthKey}`,
      before_data: before,
      after_data: after,
      changed_fields: {
        is_locked: {
          before: before?.is_locked ?? null,
          after: after.is_locked,
        },
      },
      metadata,
      created_by: actor.adminName,
      created_by_email: actor.adminEmail,
      actor_user_id: actor.userId,
      actor_name: actor.adminName,
      actor_email: actor.adminEmail,
      created_at: now,
    },
    {
      action,
      transaction_id: null,
      transaction_title: `Month lock: ${monthKey}`,
      before_data: before,
      after_data: after,
      changed_fields: {
        is_locked: {
          before: before?.is_locked ?? null,
          after: after.is_locked,
        },
      },
      metadata,
      created_by: actor.adminName,
      created_by_email: actor.adminEmail,
      actor_user_id: actor.userId,
      actor_name: actor.adminName,
      actor_email: actor.adminEmail,
      created_at: now,
    },
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
      "Month lock changed, but the audit log could not be created."
  );
}

export async function GET(req: Request) {
  try {
    await getCurrentAdmin();

    const { searchParams } = new URL(req.url);
    const selectedYear = cleanString(searchParams.get("year"));

    const activeLocks = await loadActiveMonthLocks();

    const locks = selectedYear
      ? activeLocks.filter((item) => String(item.year) === selectedYear)
      : activeLocks;

    return json({
      ok: true,
      lockedMonths: toLockedMonths(locks),
      locks,
    });
  } catch (error: unknown) {
    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load month locks.",
        details: null,
        lockedMonths: [],
        locks: [],
      },
      authStatus(error)
    );
  }
}

export async function POST(req: Request) {
  try {
    const actor = await getCurrentAdmin();

    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const action = getAction(body) || "lock";
    const monthKey = getMonthKey(body);
    const year = getYear(body, monthKey);
    const password = getPassword(body);

    const passwordCheck = await verifyMainAdminPassword(password);

    if (!passwordCheck.ok) {
      return json(
        {
          ok: false,
          error: passwordCheck.error,
          details: passwordCheck.details,
        },
        passwordCheck.status
      );
    }

    if (!validYear(year)) {
      return json(
        {
          ok: false,
          error: "Please choose a valid year.",
          details: { receivedYear: year, expectedFormat: "YYYY" },
        },
        400
      );
    }

    if (!MONTH_KEY_PATTERN.test(monthKey)) {
      return json(
        {
          ok: false,
          error: "Please choose a valid month.",
          details: {
            receivedMonthKey: monthKey,
            expectedFormat: "YYYY-MM",
          },
        },
        400
      );
    }

    if (!monthKey.startsWith(`${year}-`)) {
      return json(
        {
          ok: false,
          error: "The selected month does not belong to the selected year.",
          details: { year, monthKey },
        },
        400
      );
    }

    if (action !== "lock" && action !== "unlock") {
      return json(
        {
          ok: false,
          error: "Invalid month lock action.",
          details: {
            receivedAction: action,
            expected: ["lock", "unlock"],
          },
        },
        400
      );
    }

    const { data: previousLock, error: previousError } = await supabaseAdmin
      .from("money_month_locks")
      .select("*")
      .eq("month_key", monthKey)
      .maybeSingle();

    if (previousError) {
      return json(
        {
          ok: false,
          error: "Failed to load the current month-lock state.",
          details: previousError.message,
        },
        500
      );
    }

    if (action === "lock") {
      const startDate = `${monthKey}-01`;
      const [yearNumber, monthNumber] = monthKey.split("-").map(Number);
      const endDate = new Date(Date.UTC(yearNumber, monthNumber, 1))
        .toISOString()
        .slice(0, 10);

      const { data: monthTransactions, error: transactionError } =
        await supabaseAdmin
          .from("money_transactions")
          .select(
            "id, title, checked_at, deleted_at, transaction_date, created_at"
          )
          .is("deleted_at", null)
          .or(
            `and(transaction_date.gte.${startDate},transaction_date.lt.${endDate}),and(transaction_date.is.null,created_at.gte.${startDate},created_at.lt.${endDate})`
          );

      if (transactionError) {
        return json(
          {
            ok: false,
            error: "Failed to check this month before locking.",
            details: transactionError.message,
          },
          500
        );
      }

      const rows = monthTransactions || [];

      if (rows.length === 0) {
        return json(
          {
            ok: false,
            error:
              "You cannot lock an empty month. Add or check transactions first.",
            details: { year, monthKey, startDate, endDate },
          },
          400
        );
      }

      const unchecked = rows.filter((item) => !item.checked_at);

      if (unchecked.length > 0) {
        return json(
          {
            ok: false,
            error: `You cannot lock ${monthKey} yet. ${unchecked.length} transaction(s) still need checking.`,
            unchecked,
          },
          400
        );
      }
    }

    const now = new Date().toISOString();

    const nextPayload =
      action === "lock"
        ? {
            year,
            month_key: monthKey,
            is_locked: true,
            locked_at: now,
            locked_by: actor.adminName,
            unlocked_at: null,
            unlocked_by: null,
            updated_at: now,
          }
        : {
            year,
            month_key: monthKey,
            is_locked: false,
            unlocked_at: now,
            unlocked_by: actor.adminName,
            locked_at: null,
            locked_by: null,
            updated_at: now,
          };

    const { data: savedLock, error: saveError } = await supabaseAdmin
      .from("money_month_locks")
      // cast to any to satisfy varying nullable fields between lock/unlock payloads
      .upsert(nextPayload as any, { onConflict: "month_key" })
      .select("*")
      .single();

    if (saveError || !savedLock) {
      return json(
        {
          ok: false,
          error:
            saveError?.message ||
            `Failed to ${action === "lock" ? "lock" : "unlock"} ${monthKey}.`,
          details: saveError || null,
        },
        500
      );
    }

    try {
      await writeMonthLockAuditLog({
        actor,
        action: action === "lock" ? "lock_month" : "unlock_month",
        year,
        monthKey,
        before: (previousLock as MonthLockRow | null) || null,
        after: savedLock as MonthLockRow,
      });
    } catch (auditError) {
      await restorePreviousLockState({
        monthKey,
        previous: (previousLock as MonthLockRow | null) || null,
      });

      return json(
        {
          ok: false,
          error:
            "The month lock was not saved because the audit log could not be created.",
          details:
            auditError instanceof Error
              ? auditError.message
              : "Unknown audit-log error.",
        },
        500
      );
    }

    const activeLocks = await loadActiveMonthLocks();

    return json({
      ok: true,
      message:
        action === "lock"
          ? `${monthKey} has been locked and the action was added to the audit logs.`
          : `${monthKey} has been unlocked and the action was added to the audit logs.`,
      lock: savedLock,
      lockedMonths: toLockedMonths(activeLocks),
      locks: activeLocks,
    });
  } catch (error: unknown) {
    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update month lock.",
        details: null,
      },
      authStatus(error)
    );
  }
}
