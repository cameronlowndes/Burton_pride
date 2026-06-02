import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function getName(user: Awaited<ReturnType<typeof currentUser>>) {
  const email = user?.emailAddresses?.[0]?.emailAddress || null;

  return (
    user?.fullName ||
    user?.firstName ||
    email ||
    user?.id ||
    "Unknown admin"
  );
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "You must be signed in." },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("money_month_locks")
      .select("*")
      .order("month_key", { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to load month locks.",
          details: error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      locks: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load month locks.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "You must be signed in." },
        { status: 401 }
      );
    }

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

    const adminName = getName(user);

    if (action === "lock") {
      const { startDate, endDate } = getMonthRange(monthKey);

      const { data: monthTransactions, error: transactionError } =
        await supabaseAdmin
          .from("money_transactions")
          .select("id, title, checked_at, deleted_at, transaction_date, created_at")
          .is("deleted_at", null)
          .gte("transaction_date", startDate)
          .lt("transaction_date", endDate);

      if (transactionError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to check this month before locking.",
            details: transactionError,
          },
          { status: 500 }
        );
      }

      const transactions = monthTransactions || [];

      if (transactions.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "You cannot lock an empty month. Add or check transactions first.",
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
            details: error,
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
          details: error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      lock: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update month lock.",
      },
      { status: 500 }
    );
  }
}