import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function requireAdmin() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      error: "Unauthorized",
      status: 401,
    };
  }

  return {
    ok: true as const,
    userId,
  };
}

function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function formatMoney(value: number) {
  return `£${value.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export async function GET() {
  try {
    const access = await requireAdmin();

    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status }
      );
    }

    const { start, end } = monthRange();

    // Example tables:
    // money_transactions
    // money_accounts
    // money_budgets
    // money_savings_goals
    //
    // Adjust field names below if your schema differs.

    const [
      transactionsRes,
      accountsRes,
      budgetsRes,
      goalsRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("money_transactions")
        .select("id, name, category, transaction_date, amount, type")
        .order("transaction_date", { ascending: false })
        .limit(5),

      supabaseAdmin
        .from("money_accounts")
        .select("id, current_balance"),

      supabaseAdmin
        .from("money_budgets")
        .select("id, name, budget_amount, spent_amount, is_active")
        .eq("is_active", true)
        .limit(1),

      supabaseAdmin
        .from("money_savings_goals")
        .select("id, name, target_amount, current_amount, is_active")
        .eq("is_active", true)
        .limit(1),
    ]);

    if (transactionsRes.error) {
      console.error("money dashboard transactions error:", transactionsRes.error);
      return NextResponse.json(
        { ok: false, error: transactionsRes.error.message },
        { status: 500 }
      );
    }

    if (accountsRes.error) {
      console.error("money dashboard accounts error:", accountsRes.error);
      return NextResponse.json(
        { ok: false, error: accountsRes.error.message },
        { status: 500 }
      );
    }

    if (budgetsRes.error) {
      console.error("money dashboard budgets error:", budgetsRes.error);
      return NextResponse.json(
        { ok: false, error: budgetsRes.error.message },
        { status: 500 }
      );
    }

    if (goalsRes.error) {
      console.error("money dashboard goals error:", goalsRes.error);
      return NextResponse.json(
        { ok: false, error: goalsRes.error.message },
        { status: 500 }
      );
    }

    const { data: monthTransactions, error: monthTransactionsError } =
      await supabaseAdmin
        .from("money_transactions")
        .select("id, category, amount, type, transaction_date")
        .gte("transaction_date", start)
        .lt("transaction_date", end);

    if (monthTransactionsError) {
      console.error(
        "money dashboard month transactions error:",
        monthTransactionsError
      );
      return NextResponse.json(
        { ok: false, error: monthTransactionsError.message },
        { status: 500 }
      );
    }

    const accounts = accountsRes.data || [];
    const transactions = transactionsRes.data || [];
    const monthRows = monthTransactions || [];
    const activeBudget = budgetsRes.data?.[0] || null;
    const activeGoal = goalsRes.data?.[0] || null;

    const currentBalance = accounts.reduce(
      (sum, account) => sum + Number(account.current_balance || 0),
      0
    );

    const monthlyIncome = monthRows
      .filter((row) => row.type === "income")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const monthlySpending = monthRows
      .filter((row) => row.type === "expense")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const moneyLeft = monthlyIncome - monthlySpending;

    const breakdownMap = new Map<string, number>();

    for (const row of monthRows) {
      if (row.type !== "expense") continue;
      const key = row.category || "Other";
      breakdownMap.set(key, (breakdownMap.get(key) || 0) + Number(row.amount || 0));
    }

    const maxBreakdown = Math.max(...Array.from(breakdownMap.values()), 1);

    const spendingBreakdown = Array.from(breakdownMap.entries())
      .map(([label, amount]) => ({
        label,
        value: formatMoney(amount),
        width: `${Math.max(12, Math.round((amount / maxBreakdown) * 100))}%`,
      }))
      .sort((a, b) => {
        const aNum = Number(a.value.replace(/[^\d.-]/g, ""));
        const bNum = Number(b.value.replace(/[^\d.-]/g, ""));
        return bNum - aNum;
      })
      .slice(0, 5);

    const recentTransactions = transactions.map((transaction) => ({
      id: transaction.id,
      name: transaction.name,
      category: transaction.category || "Other",
      date: formatDate(transaction.transaction_date),
      amount:
        transaction.type === "income"
          ? `+${formatMoney(Number(transaction.amount || 0))}`
          : `-${formatMoney(Number(transaction.amount || 0))}`,
      type: transaction.type,
    }));

    const budgetAmount = Number(activeBudget?.budget_amount || 0);
    const budgetSpent =
      activeBudget?.spent_amount !== null && activeBudget?.spent_amount !== undefined
        ? Number(activeBudget.spent_amount)
        : monthlySpending;

    const budgetUsed =
      budgetAmount > 0 ? Math.min(100, Math.round((budgetSpent / budgetAmount) * 100)) : 0;

    const goalTarget = Number(activeGoal?.target_amount || 0);
    const goalCurrent = Number(activeGoal?.current_amount || 0);

    const savingsGoal =
      goalTarget > 0 ? Math.min(100, Math.round((goalCurrent / goalTarget) * 100)) : 0;

    return NextResponse.json({
      ok: true,
      stats: {
        currentBalance: formatMoney(currentBalance),
        monthlyIncome: formatMoney(monthlyIncome),
        monthlySpending: formatMoney(monthlySpending),
        savingsPot: formatMoney(goalCurrent),
      },
      budget: {
        label: "Monthly Budget",
        monthLabel: new Date().toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
        }),
        usedText: `${formatMoney(budgetSpent)} / ${formatMoney(budgetAmount)}`,
        usedPercent: budgetUsed,
        remainingText: formatMoney(Math.max(0, budgetAmount - budgetSpent)),
      },
      savings: {
        label: activeGoal?.name || "Savings Goal",
        progressText: `${formatMoney(goalCurrent)} / ${formatMoney(goalTarget)}`,
        progressPercent: savingsGoal,
      },
      summary: {
        totalIncome: formatMoney(monthlyIncome),
        totalExpenses: formatMoney(monthlySpending),
        moneyLeft: formatMoney(moneyLeft),
      },
      spendingBreakdown,
      recentTransactions,
    });
  } catch (error) {
    console.error("Unexpected money dashboard error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}