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

type CurrentAdmin = {
  userId: string;
  adminName: string;
  adminEmail: string | null;
};

type YearLockRow = {
  id?: string;
  year: string;
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

function getYear(body: Record<string, unknown>) {
  return cleanString(
    body.year ||
      body.selectedYear ||
      body.yearKey ||
      body.year_key ||
      body.periodKey ||
      body.period_key
  );
}

function getPassword(body: Record<string, unknown>) {
  return cleanString(
    body.password ||
      body.mainAdminPassword ||
      body.adminPassword ||
      body.yearLockPassword
  );
}

function getAction(body: Record<string, unknown>) {
  return cleanString(body.action).toLowerCase();
}

function getYearRange(year: string) {
  return {
    startDate: `${year}-01-01`,
    endDate: `${Number(year) + 1}-01-01`,
  };
}

function toLockedYears(rows: YearLockRow[]) {
  return rows
    .filter((row) => row.is_locked === true && validYear(cleanString(row.year)))
    .map((row) => cleanString(row.year));
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

async function loadActiveYearLocks() {
  const { data, error } = await supabaseAdmin
    .from("money_year_locks")
    .select("*")
    .eq("is_locked", true)
    .order("year", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load active year locks.");
  }

  return (data || []) as YearLockRow[];
}

async function restorePreviousLockState({
  year,
  previous,
}: {
  year: string;
  previous: YearLockRow | null;
}) {
  if (!previous) {
    await supabaseAdmin.from("money_year_locks").delete().eq("year", year);
    return;
  }

  await supabaseAdmin
    .from("money_year_locks")
    .upsert(previous, { onConflict: "year" });
}

async function writeYearLockAuditLog({
  actor,
  action,
  year,
  before,
  after,
}: {
  actor: CurrentAdmin;
  action: "lock_year" | "unlock_year";
  year: string;
  before: YearLockRow | null;
  after: YearLockRow;
}) {
  const now = new Date().toISOString();

  const description =
    action === "lock_year"
      ? `Locked the full ${year} accounting year.`
      : `Unlocked the full ${year} accounting year.`;

  const metadata = {
    actor_id: actor.userId,
    actor_name: actor.adminName,
    actor_email: actor.adminEmail,
    created_by: actor.adminName,
    created_by_email: actor.adminEmail,
    source: "money_year_locks",
    created_from: "app/api/admin/money/year-locks/route.ts",
    lock_type: "year",
    year,
    description,
  };

  const attempts = [
    {
      action,
      transaction_id: null,
      transaction_title: `Year lock: ${year}`,
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
      transaction_title: `Year lock: ${year}`,
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
      created_at: now,
    },
    {
      action,
      transaction_id: null,
      transaction_title: `Year lock: ${year}`,
      before_data: before,
      after_data: after,
      changed_fields: {
        is_locked: {
          before: before?.is_locked ?? null,
          after: after.is_locked,
        },
      },
      metadata,
      created_at: now,
    },
  ];

  let lastError: any = null;

  for (const payload of attempts) {
    const { error } = await supabaseAdmin
      .from("admin_money_audit_logs")
      .insert(payload as any);

    if (!error) return;

    lastError = error;
  }

  throw new Error(
    lastError?.message ||
      "Year lock changed, but the audit log could not be created."
  );
}

export async function GET() {
  try {
    await getCurrentAdmin();

    const locks = await loadActiveYearLocks();

    return json({
      ok: true,
      lockedYears: toLockedYears(locks),
      locks,
    });
  } catch (error: unknown) {
    return json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to load year locks.",
        details: null,
        lockedYears: [],
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

    const year = getYear(body);
    const action = getAction(body) || "lock";
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
          error: "Please choose a valid year before locking.",
          details: {
            receivedYear: year,
            expectedFormat: "YYYY",
          },
        },
        400
      );
    }

    if (action !== "lock" && action !== "unlock") {
      return json(
        {
          ok: false,
          error: "Invalid year lock action.",
          details: {
            receivedAction: action,
            expected: ["lock", "unlock"],
          },
        },
        400
      );
    }

    const { data: previousLock, error: previousError } = await supabaseAdmin
      .from("money_year_locks")
      .select("*")
      .eq("year", year)
      .maybeSingle();

    if (previousError) {
      return json(
        {
          ok: false,
          error: "Failed to load the current year-lock state.",
          details: previousError.message,
        },
        500
      );
    }

    if (action === "lock") {
      const { startDate, endDate } = getYearRange(year);

      const { data: yearTransactions, error: transactionError } =
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
            error: "Failed to check this year before locking.",
            details: transactionError.message,
          },
          500
        );
      }

      const rows = yearTransactions || [];

      if (rows.length === 0) {
        return json(
          {
            ok: false,
            error:
              "You cannot lock an empty year. Add or check transactions first.",
            details: { year, startDate, endDate },
          },
          400
        );
      }

      const unchecked = rows.filter((item) => !item.checked_at);

      if (unchecked.length > 0) {
        return json(
          {
            ok: false,
            error: `You cannot lock ${year} yet. ${unchecked.length} transaction(s) still need checking.`,
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
            is_locked: true,
            locked_at: now,
            locked_by: actor.adminName,
            unlocked_at: null,
            unlocked_by: null,
            updated_at: now,
          }
        : {
            year,
            is_locked: false,
            unlocked_at: now,
            unlocked_by: actor.adminName,
            updated_at: now,
          };

    const { data: savedLock, error: saveError } = await supabaseAdmin
      .from("money_year_locks")
      .upsert(nextPayload as any, { onConflict: "year" })
      .select("*")
      .single();

    if (saveError || !savedLock) {
      return json(
        {
          ok: false,
          error:
            saveError?.message ||
            `Failed to ${action === "lock" ? "lock" : "unlock"} ${year}.`,
          details: saveError || null,
        },
        500
      );
    }

    try {
      await writeYearLockAuditLog({
        actor,
        action: action === "lock" ? "lock_year" : "unlock_year",
        year,
        before: (previousLock as YearLockRow | null) || null,
        after: savedLock as YearLockRow,
      });
    } catch (auditError) {
      await restorePreviousLockState({
        year,
        previous: (previousLock as YearLockRow | null) || null,
      });

      return json(
        {
          ok: false,
          error:
            "The year lock was not saved because the audit log could not be created.",
          details:
            auditError instanceof Error
              ? auditError.message
              : "Unknown audit-log error.",
        },
        500
      );
    }

    const activeLocks = await loadActiveYearLocks();

    return json({
      ok: true,
      message:
        action === "lock"
          ? `${year} has been locked. The whole year is now read-only and the action was added to the audit logs.`
          : `${year} has been unlocked and the action was added to the audit logs.`,
      lock: savedLock,
      lockedYears: toLockedYears(activeLocks),
      locks: activeLocks,
    });
  } catch (error: unknown) {
    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update year lock.",
        details: null,
      },
      authStatus(error)
    );
  }
}
