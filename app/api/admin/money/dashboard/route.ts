import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TransactionType = "income" | "expense";

type MoneyTransaction = {
  id: string;
  name: string | null;
  category: string | null;
  transaction_date: string | null;
  amount: number | string | null;
  type: TransactionType | string | null;
};

type MoneyAccount = {
  id: string;
  current_balance: number | string | null;
};

type MoneyBudget = {
  id: string;
  name: string | null;
  budget_amount: number | string | null;
  spent_amount: number | string | null;
  is_active: boolean | null;
};

type MoneySavingsGoal = {
  id: string;
  name: string | null;
  target_amount: number | string | null;
  current_amount: number | string | null;
  is_active: boolean | null;
};

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
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value: number) {
  return `£${value.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function safePercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function GET() {
  try {
    const access = await requireAdmin();

    if (!access.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: access.error,
        },
        {
          status: access.status,
        }
      );
    }

    const { start, end } = monthRange();

    const [transactionsRes, accountsRes, budgetsRes, goalsRes] =
      await Promise.all([
        supabaseAdmin
          .from("money_transactions")
          .select("id, name, category, transaction_date, amount, type")
          .order("transaction_date", { ascending: false })
          .limit(6),

        supabaseAdmin
          .from("money_accounts")
          .select("id, current_balance"),

        supabaseAdmin
          .from("money_budgets")
          .select("id, name, budget_amount, spent_amount, is_active")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1),

        supabaseAdmin
          .from("money_savings_goals")
          .select("id, name, target_amount, current_amount, is_active")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

    if (transactionsRes.error) {
      return NextResponse.json(
        {
          ok: false,
          error: transactionsRes.error.message,
        },
        { status: 500 }
      );
    }

    if (accountsRes.error) {
      return NextResponse.json(
        {
          ok: false,
          error: accountsRes.error.message,
        },
        { status: 500 }
      );
    }

    if (budgetsRes.error) {
      return NextResponse.json(
        {
          ok: false,
          error: budgetsRes.error.message,
        },
        { status: 500 }
      );
    }

    if (goalsRes.error) {
      return NextResponse.json(
        {
          ok: false,
          error: goalsRes.error.message,
        },
        { status: 500 }
      );
    }

    const { data: monthTransactionsData, error: monthTransactionsError } =
      await supabaseAdmin
        .from("money_transactions")
        .select("id, name, category, transaction_date, amount, type")
        .gte("transaction_date", start)
        .lt("transaction_date", end);

    if (monthTransactionsError) {
      return NextResponse.json(
        {
          ok: false,
          error: monthTransactionsError.message,
        },
        { status: 500 }
      );
    }

    const accounts = (accountsRes.data || []) as MoneyAccount[];
    const transactions = (transactionsRes.data || []) as MoneyTransaction[];
    const monthRows = (monthTransactionsData || []) as MoneyTransaction[];
    const activeBudget = (budgetsRes.data?.[0] || null) as MoneyBudget | null;
    const activeGoal = (goalsRes.data?.[0] ||
      null) as MoneySavingsGoal | null;

    const currentBalance = accounts.reduce(
      (sum, account) => sum + toNumber(account.current_balance),
      0
    );

    const monthlyIncome = monthRows
      .filter((row) => row.type === "income")
      .reduce((sum, row) => sum + toNumber(row.amount), 0);

    const monthlySpending = monthRows
      .filter((row) => row.type === "expense")
      .reduce((sum, row) => sum + toNumber(row.amount), 0);

    const moneyLeft = monthlyIncome - monthlySpending;

    const breakdownMap = new Map<string, number>();

    for (const row of monthRows) {
      if (row.type !== "expense") continue;

      const key = row.category || "Other";
      const amount = toNumber(row.amount);

      breakdownMap.set(key, (breakdownMap.get(key) || 0) + amount);
    }

    const maxBreakdown = Math.max(...Array.from(breakdownMap.values()), 1);

    const spendingBreakdown = Array.from(breakdownMap.entries())
      .map(([label, amount]) => ({
        label,
        value: formatMoney(amount),
        width: `${Math.max(
          12,
          safePercent((amount / maxBreakdown) * 100)
        )}%`,
        rawAmount: amount,
      }))
      .sort((a, b) => b.rawAmount - a.rawAmount)
      .slice(0, 5)
      .map(({ rawAmount, ...item }) => item);

    const recentTransactions = transactions.map((transaction) => {
      const type: TransactionType =
        transaction.type === "income" ? "income" : "expense";

      const amount = toNumber(transaction.amount);

      return {
        id: transaction.id,
        name: transaction.name || "Transaction",
        category: transaction.category || "Other",
        date: formatDate(transaction.transaction_date),
        amount:
          type === "income"
            ? `+${formatMoney(amount)}`
            : `-${formatMoney(amount)}`,
        type,
      };
    });

    const budgetAmount = toNumber(activeBudget?.budget_amount);

    const budgetSpent =
      activeBudget?.spent_amount !== null &&
      activeBudget?.spent_amount !== undefined
        ? toNumber(activeBudget.spent_amount)
        : monthlySpending;

    const budgetUsed =
      budgetAmount > 0 ? safePercent((budgetSpent / budgetAmount) * 100) : 0;

    const goalTarget = toNumber(activeGoal?.target_amount);
    const goalCurrent = toNumber(activeGoal?.current_amount);

    const savingsGoal =
      goalTarget > 0 ? safePercent((goalCurrent / goalTarget) * 100) : 0;

    return NextResponse.json({
      ok: true,
      stats: {
        currentBalance: formatMoney(currentBalance),
        monthlyIncome: formatMoney(monthlyIncome),
        monthlySpending: formatMoney(monthlySpending),
        savingsPot: formatMoney(goalCurrent),
      },
      budget: {
        label: activeBudget?.name || "Monthly Budget",
        monthLabel: new Date().toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
        }),
        usedText:
          budgetAmount > 0
            ? `${formatMoney(budgetSpent)} / ${formatMoney(budgetAmount)}`
            : formatMoney(budgetSpent),
        usedPercent: budgetUsed,
        remainingText: formatMoney(Math.max(0, budgetAmount - budgetSpent)),
      },
      savings: {
        label: activeGoal?.name || "Savings Goal",
        progressText:
          goalTarget > 0
            ? `${formatMoney(goalCurrent)} / ${formatMoney(goalTarget)}`
            : formatMoney(goalCurrent),
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
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal server error",
      },
      { status: 500 }
    );
  }
}