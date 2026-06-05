import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";
const SESSION_COOKIE = "burton_admin_session";

type CurrentAdmin = {
  userId: string;
  adminName: string;
  adminEmail: string | null;
};

function validMonthKey(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function getMonthRange(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function nameFromEmail(email?: string | null) {
  const cleanEmail = cleanString(email);

  if (!cleanEmail || !cleanEmail.includes("@")) {
    return "";
  }

  return cleanEmail
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

async function getCurrentAdmin(): Promise<CurrentAdmin> {
  const cookieStore = await cookies();

  const adminId = cookieStore.get(ADMIN_ID_COOKIE)?.value || "";
  const adminEmail = cookieStore.get(ADMIN_EMAIL_COOKIE)?.value || "";
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value || "";

  if (!adminId || !adminEmail || !sessionToken) {
    throw new Error("You must be signed in.");
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("admin_users")
    .select("id, email, name, full_name, role, is_active")
    .eq("id", adminId)
    .eq("email", adminEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError) {
    throw new Error(adminError.message || "Failed to load admin account.");
  }

  if (!admin) {
    throw new Error("No active admin account is linked to this admin session.");
  }

  const adminEmailValue = cleanString(admin.email || adminEmail) || null;

  const adminName =
    cleanString(admin.name) ||
    cleanString(admin.full_name) ||
    nameFromEmail(adminEmailValue) ||
    "Unknown admin";

  return {
    userId: String(admin.id),
    adminName,
    adminEmail: adminEmailValue,
  };
}

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message === "You must be signed in." ||
    message === "No active admin account is linked to this admin session."
  ) {
    return 401;
  }

  return 500;
}

export async function GET() {
  try {
    await getCurrentAdmin();

    const { data, error } = await supabaseAdmin
      .from("money_month_locks")
      .select("*")
      .order("month_key", { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to load month locks.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      locks: data || [],
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load month locks.",
      },
      { status: errorStatus(error) }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { adminName } = await getCurrentAdmin();

    const body = await req.json();

    const year = String(body.year || "").trim();
    const monthKey = String(body.monthKey || "").trim();
    const action = String(body.action || "").trim();

    if (!year) {
      return NextResponse.json(
        { ok: false, error: "Missing year." },
        { status: 400 }
      );
    }

    if (!validMonthKey(monthKey)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please choose a valid month before locking.",
        },
        { status: 400 }
      );
    }

    if (action !== "lock" && action !== "unlock") {
      return NextResponse.json(
        { ok: false, error: "Invalid month lock action." },
        { status: 400 }
      );
    }

    if (!monthKey.startsWith(`${year}-`)) {
      return NextResponse.json(
        {
          ok: false,
          error: "The selected month does not match the selected year.",
        },
        { status: 400 }
      );
    }

    if (action === "lock") {
      const { startDate, endDate } = getMonthRange(monthKey);

      const { data: monthTransactions, error: transactionError } =
        await supabaseAdmin
          .from("money_transactions")
          .select(
            "id, title, checked_at, deleted_at, transaction_date, created_at"
          )
          .is("deleted_at", null)
          .gte("transaction_date", startDate)
          .lt("transaction_date", endDate);

      if (transactionError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to check this month before locking.",
            details: transactionError.message,
          },
          { status: 500 }
        );
      }

      const transactions = monthTransactions || [];

      if (transactions.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "You cannot lock an empty month. Add or check transactions first.",
          },
          { status: 400 }
        );
      }

      const unchecked = transactions.filter((item) => !item.checked_at);

      if (unchecked.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: `You cannot lock ${monthKey} yet. ${unchecked.length} transaction(s) still need checking.`,
            unchecked,
          },
          { status: 400 }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("money_month_locks")
        .upsert(
          {
            year,
            month_key: monthKey,
            is_locked: true,
            locked_at: new Date().toISOString(),
            locked_by: adminName,
            unlocked_at: null,
            unlocked_by: null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "month_key",
          }
        )
        .select("*")
        .single();

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: `Failed to lock ${monthKey}.`,
            details: error.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        lock: data,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("money_month_locks")
      .upsert(
        {
          year,
          month_key: monthKey,
          is_locked: false,
          unlocked_at: new Date().toISOString(),
          unlocked_by: adminName,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "month_key",
        }
      )
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: `Failed to unlock ${monthKey}.`,
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      lock: data,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update month lock.",
      },
      { status: errorStatus(error) }
    );
  }
}