import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMainAdmin } from "@/lib/isMainAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    year: string;
  }>;
};

type MoneyTransaction = {
  id: string;
  created_at: string | null;
  transaction_date: string | null;
  type: "income" | "expense" | string | null;
  category: string | null;
  amount_pence: number | null;
  payment_method: string | null;
  is_personal_funds: boolean | null;
  personal_funds_repaid: boolean | null;
  sponsor_id: string | null;
  sponsor_name: string | null;
  source: string | null;
};

type MoneySponsor = {
  id: string;
  created_at: string | null;
  sponsor_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  agreed_amount_pence: number | null;
  received_amount_pence: number | null;
};

function isValidYear(year: string) {
  return /^\d{4}$/.test(year);
}

function getYearFromDate(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    const match = String(value).match(/^(\d{4})-/);
    return match?.[1] || "";
  }

  return String(date.getFullYear());
}

function sponsorNameMatches(
  a: string | null | undefined,
  b: string | null | undefined
) {
  return Boolean(a && b && a.toLowerCase().trim() === b.toLowerCase().trim());
}

function isSponsorshipTransaction(item: MoneyTransaction) {
  return (
    Boolean(item.sponsor_id || item.sponsor_name) ||
    item.source === "sponsorship" ||
    item.category?.toLowerCase() === "sponsorship"
  );
}

function isPersonalFundsTransaction(item: MoneyTransaction) {
  return (
    item.type === "expense" &&
    (item.is_personal_funds === true ||
      item.payment_method?.toLowerCase() === "personal funds")
  );
}

async function checkDeletePasswordThroughSettingsApi(
  req: NextRequest,
  password: string
) {
  const passwordCheck = await fetch(
    `${req.nextUrl.origin}/api/admin/settings/delete-password`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.get("cookie") || "",
      },
      body: JSON.stringify({
        password,
      }),
    }
  );

  const passwordData = await passwordCheck.json().catch(() => ({}));

  if (!passwordCheck.ok || !passwordData.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: passwordData.error || "Main admin password check failed.",
          details: passwordData,
        },
        { status: passwordCheck.status || 500 }
      ),
    };
  }

  return {
    ok: true,
    response: null,
  };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    await requireMainAdmin();

    const { year: rawYear } = await params;
    const year = String(rawYear || "").trim();

    if (!isValidYear(year)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Year must be a 4 digit year, for example 2026.",
        },
        { status: 400 }
      );
    }

    const { data: transactions, error: transactionsError } =
      await supabaseAdmin
        .from("money_transactions")
        .select("*")
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

    if (transactionsError) {
      return NextResponse.json(
        {
          ok: false,
          error: transactionsError.message,
          details: transactionsError,
        },
        { status: 500 }
      );
    }

    const { data: sponsors, error: sponsorsError } = await supabaseAdmin
      .from("money_sponsors")
      .select("*")
      .order("created_at", { ascending: false });

    if (sponsorsError) {
      return NextResponse.json(
        {
          ok: false,
          error: sponsorsError.message,
          details: sponsorsError,
        },
        { status: 500 }
      );
    }

    const allTransactions = (transactions || []) as MoneyTransaction[];
    const allSponsors = (sponsors || []) as MoneySponsor[];

    const yearTransactions = allTransactions.filter((item) => {
      const transactionYear = getYearFromDate(
        item.transaction_date || item.created_at
      );

      return transactionYear === year;
    });

    const sponsorBreakdown = allSponsors
      .map((sponsor) => {
        const sponsorTransactions = yearTransactions.filter((item) => {
          if (!isSponsorshipTransaction(item)) return false;

          return (
            item.sponsor_id === sponsor.id ||
            sponsorNameMatches(item.sponsor_name, sponsor.sponsor_name)
          );
        });

        const receivedFromTransactions = sponsorTransactions
          .filter((item) => item.type === "income")
          .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

        const spentPence = sponsorTransactions
          .filter((item) => item.type === "expense")
          .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

        const sponsorCreatedYear = getYearFromDate(sponsor.created_at);
        const wasCreatedThisYear = sponsorCreatedYear === year;
        const hasTransactionsThisYear = sponsorTransactions.length > 0;

        const receivedPence =
          receivedFromTransactions > 0
            ? receivedFromTransactions
            : wasCreatedThisYear
              ? sponsor.received_amount_pence || 0
              : 0;

        const agreedAmountPence =
          wasCreatedThisYear || hasTransactionsThisYear
            ? sponsor.agreed_amount_pence || 0
            : 0;

        return {
          sponsor_id: sponsor.id,
          sponsor_name: sponsor.sponsor_name,
          contact_name: sponsor.contact_name,
          email: sponsor.email,
          phone: sponsor.phone,
          agreed_amount_pence: agreedAmountPence,
          received_pence: receivedPence,
          spent_pence: spentPence,
          remaining_pence: receivedPence - spentPence,
        };
      })
      .filter(
        (item) =>
          item.agreed_amount_pence > 0 ||
          item.received_pence > 0 ||
          item.spent_pence > 0
      );

    const personalFunds = yearTransactions
      .filter((item) => isPersonalFundsTransaction(item))
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const personalFundsRepaid = yearTransactions
      .filter(
        (item) =>
          isPersonalFundsTransaction(item) &&
          item.personal_funds_repaid === true
      )
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const normalExpense = yearTransactions
      .filter(
        (item) => item.type === "expense" && !isPersonalFundsTransaction(item)
      )
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const expense = normalExpense + personalFundsRepaid;

    const income = yearTransactions
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const sponsorshipReceived = sponsorBreakdown.reduce(
      (sum, item) => sum + (item.received_pence || 0),
      0
    );

    const sponsorshipSpent = sponsorBreakdown.reduce(
      (sum, item) => sum + (item.spent_pence || 0),
      0
    );

    return NextResponse.json(
      {
        ok: true,
        year,
        transactions: yearTransactions,
        sponsors: allSponsors,
        breakdown: sponsorBreakdown,
        totals: {
          income,
          normalExpense,
          expense,
          personalFunds,
          personalFundsRepaid,
          personalFundsOutstanding: personalFunds - personalFundsRepaid,
          sponsorshipReceived,
          sponsorshipSpent,
          sponsorshipRemaining: sponsorshipReceived - sponsorshipSpent,
          balance: income - expense,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    console.error("Money transactions year GET error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    await requireMainAdmin();

    const { year: rawYear } = await params;
    const year = String(rawYear || "").trim();

    if (!isValidYear(year)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Year must be a 4 digit year, for example 2026.",
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const password = String(body.password || "").trim();

    if (!password) {
      return NextResponse.json(
        {
          ok: false,
          error: "Main admin password is required.",
        },
        { status: 400 }
      );
    }

    const passwordCheck = await checkDeletePasswordThroughSettingsApi(
      req,
      password
    );

    if (!passwordCheck.ok && passwordCheck.response) {
      return passwordCheck.response;
    }

    const { data: transactions, error: loadError } = await supabaseAdmin
      .from("money_transactions")
      .select("id, transaction_date, created_at");

    if (loadError) {
      return NextResponse.json(
        {
          ok: false,
          error: loadError.message,
          details: loadError,
        },
        { status: 500 }
      );
    }

    const ids = ((transactions || []) as Pick<
      MoneyTransaction,
      "id" | "transaction_date" | "created_at"
    >[])
      .filter((item) => {
        const transactionYear = getYearFromDate(
          item.transaction_date || item.created_at
        );

        return transactionYear === year;
      })
      .map((item) => item.id);

    if (ids.length === 0) {
      return NextResponse.json({
        ok: true,
        year,
        deletedCount: 0,
        message: `No transactions found for ${year}.`,
      });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("money_transactions")
      .delete()
      .in("id", ids);

    if (deleteError) {
      return NextResponse.json(
        {
          ok: false,
          error: deleteError.message,
          details: deleteError,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      year,
      deletedCount: ids.length,
      message: `All ${year} money tracker transactions deleted successfully.`,
    });
  } catch (err) {
    console.error("Money transactions year DELETE error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}