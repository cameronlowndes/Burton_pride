"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  Coins,
  FileText,
  HandCoins,
  LayoutDashboard,
  PiggyBank,
  PlusCircle,
  RefreshCcw,
  RotateCcw,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";

import MoneyHeader from "../../../components/money/MoneyHeader";
import MoneyStatsCards from "../../../components/money/MoneySummaryCards";
import MoneyPageStatus from "../../../components/money/MoneyPageStatus";
import MoneyDashboardAlerts from "../../../components/money/MoneyDashboardAlerts";
import MoneySponsorSection from "../../../components/money/MoneySponsorSection";
import MoneyMonthlyBreakdown from "../../../components/money/MoneyMonthlyBreakdown";
import MoneyDashboardCharts from "../../../components/money/MoneyDashboardCharts";
import MoneyTransactionForm from "../../../components/money/MoneyTransactionForm";
import MoneyTransactionsTable from "../../../components/money/MoneyTransactionsTable";
import MoneyPageModals from "../../../components/money/MoneyPageModals";
import ManualBankBalanceCheck from "../../../components/money/ManualBankBalanceCheck";

import { useMoneyTransactionsPage } from "@/hooks/useMoneyTransactionsPage";
import { money } from "@/lib/money/helpers";


type RefundType = "money_received_back" | "money_sent_back";
type RefundStatus = "pending" | "completed" | "cancelled";

type DashboardRefund = {
  id: string;
  year: number;
  refund_date: string;
  refund_type: RefundType;
  amount_pence: number;
  title: string;
  notes?: string | null;
  reference_number?: string | null;
  status: RefundStatus;
  is_hidden?: boolean | null;
  created_at?: string | null;
};

type RefundApiResponse = {
  refunds?: DashboardRefund[];
  message?: string;
  error?: string;
  details?: unknown;
};

async function readJsonResponse(response: Response) {
  const rawBody = await response.text();

  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return {
      rawResponse: rawBody,
    };
  }
}

function getRefundTimestamp(refund: DashboardRefund) {
  const value = refund.refund_date || refund.created_at || "";

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getRefundMonthKey(refund: DashboardRefund) {
  return String(refund.refund_date || refund.created_at || "").slice(0, 7);
}

export default function MoneyDashboardPage() {
  const moneyPage = useMoneyTransactionsPage();

  const [refunds, setRefunds] = useState<DashboardRefund[]>([]);
  const [refundsLoading, setRefundsLoading] = useState(false);
  const [refundsError, setRefundsError] = useState("");
  const [refundsErrorDetails, setRefundsErrorDetails] =
    useState<unknown>(null);

  const [addTransactionOpen, setAddTransactionOpen] = useState(false);
  const [transactionsWindowOpen, setTransactionsWindowOpen] = useState(false);
  const [sponsorWindowOpen, setSponsorWindowOpen] = useState(false);
  const [reportsWindowOpen, setReportsWindowOpen] = useState(false);

  const loadRefunds = useCallback(async () => {
    setRefundsLoading(true);
    setRefundsError("");
    setRefundsErrorDetails(null);

    try {
      const response = await fetch(
        `/api/admin/money/refunds?year=${encodeURIComponent(
          moneyPage.selectedYear
        )}&limit=500`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const payload = (await readJsonResponse(response)) as RefundApiResponse;

      if (!response.ok) {
        throw {
          message:
            payload.message ||
            payload.error ||
            "Refund records could not be loaded.",
          details: payload,
          status: response.status,
        };
      }

      setRefunds(
        Array.isArray(payload.refunds)
          ? payload.refunds.filter((refund) => !refund.is_hidden)
          : []
      );
    } catch (error: any) {
      setRefunds([]);

      setRefundsError(
        error?.message || "Refund records could not be loaded."
      );

      setRefundsErrorDetails(error);
    } finally {
      setRefundsLoading(false);
    }
  }, [moneyPage.selectedYear]);

  useEffect(() => {
    void loadRefunds();
  }, [loadRefunds]);

  const visibleRefunds = useMemo(() => {
    if (moneyPage.selectedViewMonth === "all") {
      return refunds;
    }

    return refunds.filter(
      (refund) => getRefundMonthKey(refund) === moneyPage.selectedViewMonth
    );
  }, [moneyPage.selectedViewMonth, refunds]);

  const completedRefunds = useMemo(() => {
    return refunds.filter((refund) => refund.status === "completed");
  }, [refunds]);

  const completedVisibleRefunds = useMemo(() => {
    return visibleRefunds.filter((refund) => refund.status === "completed");
  }, [visibleRefunds]);

  const refundTotals = useMemo(() => {
    return completedRefunds.reduce(
      (acc, refund) => {
        if (refund.refund_type === "money_received_back") {
          acc.receivedBack += Number(refund.amount_pence || 0);
        }

        if (refund.refund_type === "money_sent_back") {
          acc.sentBack += Number(refund.amount_pence || 0);
        }

        return acc;
      },
      {
        receivedBack: 0,
        sentBack: 0,
      }
    );
  }, [completedRefunds]);

  const visibleRefundTotals = useMemo(() => {
    return completedVisibleRefunds.reduce(
      (acc, refund) => {
        if (refund.refund_type === "money_received_back") {
          acc.receivedBack += Number(refund.amount_pence || 0);
        }

        if (refund.refund_type === "money_sent_back") {
          acc.sentBack += Number(refund.amount_pence || 0);
        }

        return acc;
      },
      {
        receivedBack: 0,
        sentBack: 0,
      }
    );
  }, [completedVisibleRefunds]);

  const dashboardTotals = useMemo(() => {
    return {
      ...moneyPage.totals,
      income: moneyPage.totals.income + refundTotals.receivedBack,
      expense: moneyPage.totals.expense + refundTotals.sentBack,
      balance:
        moneyPage.totals.balance +
        refundTotals.receivedBack -
        refundTotals.sentBack,
      refundsReceivedBack: refundTotals.receivedBack,
      refundsSentBack: refundTotals.sentBack,
    };
  }, [moneyPage.totals, refundTotals]);

  const refreshDashboard = useCallback(() => {
    moneyPage.refreshAll();
    void loadRefunds();
  }, [loadRefunds, moneyPage]);

  async function writeMoneyAuditLog(
    action: string,
    description: string,
    extra?: Record<string, unknown>
  ) {
    try {
      await fetch("/api/admin/money/audit-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          description,
          selectedYear: moneyPage.selectedYear,
          selectedViewMonth: moneyPage.selectedViewMonth,
          selectedPrintMonth: moneyPage.selectedPrintMonth,
          transactionCount: moneyPage.filteredTransactions.length,
          yearTransactionCount: moneyPage.yearTransactions.length,
          refundCount: refunds.length,
          completedRefundCount: completedRefunds.length,
          refundsReceivedBack: refundTotals.receivedBack,
          refundsSentBack: refundTotals.sentBack,
          extra: extra || {},
        }),
      });
    } catch {
      // Do not block the dashboard if audit logging fails.
    }
  }

  const openAddTransactionModal = () => {
    moneyPage.cancelEditTransaction();
    setTransactionsWindowOpen(false);
    setSponsorWindowOpen(false);
    setReportsWindowOpen(false);
    setAddTransactionOpen(true);
  };

  const closeAddTransactionModal = () => {
    setAddTransactionOpen(false);
    moneyPage.cancelEditTransaction();
  };

  const openTransactionsWindow = () => {
    setAddTransactionOpen(false);
    setSponsorWindowOpen(false);
    setReportsWindowOpen(false);
    setTransactionsWindowOpen(true);
  };

  const closeTransactionsWindow = () => {
    setTransactionsWindowOpen(false);
  };

  const openSponsorWindow = () => {
    setAddTransactionOpen(false);
    setTransactionsWindowOpen(false);
    setReportsWindowOpen(false);
    setSponsorWindowOpen(true);
  };

  const closeSponsorWindow = () => {
    setSponsorWindowOpen(false);
  };

  const openReportsWindow = async () => {
    setAddTransactionOpen(false);
    setTransactionsWindowOpen(false);
    setSponsorWindowOpen(false);
    setReportsWindowOpen(true);

    await writeMoneyAuditLog(
      "reports_window_opened",
      `Opened reports window for ${moneyPage.selectedYear}.`
    );
  };

  const closeReportsWindow = () => {
    setReportsWindowOpen(false);
  };

  async function handlePrintReport() {
    await writeMoneyAuditLog(
      "report_printed",
      `Printed money report for ${moneyPage.selectedYear}.`,
      {
        printMonth: moneyPage.selectedPrintMonth,
        filteredTransactions: moneyPage.filteredTransactions.length,
        printTransactions: moneyPage.printTransactionsList.length,
        refunds: visibleRefunds.length,
        completedRefunds: completedVisibleRefunds.length,
        refundsReceivedBack: visibleRefundTotals.receivedBack,
        refundsSentBack: visibleRefundTotals.sentBack,
      }
    );

    moneyPage.printTransactions();
  }

  async function handleExportExcelReport() {
    await writeMoneyAuditLog(
      "transactions_excel_exported",
      `Exported transaction Excel report for ${moneyPage.selectedYear}.`,
      {
        selectedViewMonth: moneyPage.selectedViewMonth,
        filteredTransactions: moneyPage.filteredTransactions.length,
        refunds: visibleRefunds.length,
        completedRefunds: completedVisibleRefunds.length,
        refundsReceivedBack: visibleRefundTotals.receivedBack,
        refundsSentBack: visibleRefundTotals.sentBack,
      }
    );

    await moneyPage.exportTransactionsToExcel();
  }

  async function handleExportYearlyReport() {
    await writeMoneyAuditLog(
      "yearly_report_exported",
      `Exported full yearly money report for ${moneyPage.selectedYear}.`,
      {
        yearTransactions: moneyPage.yearTransactions.length,
        openingBalance: moneyPage.totals.openingBalance,
        income: moneyPage.totals.income,
        expense: moneyPage.totals.expense,
        balance: moneyPage.totals.balance,
        sponsorshipIncome: moneyPage.totals.sponsorshipIncome,
        sponsorshipSpent: moneyPage.totals.sponsorshipSpent,
        sponsorshipRemaining: moneyPage.totals.sponsorshipRemaining,
        refunds: refunds.length,
        completedRefunds: completedRefunds.length,
        refundsReceivedBack: refundTotals.receivedBack,
        refundsSentBack: refundTotals.sentBack,
        availableBalanceIncludingRefunds: dashboardTotals.balance,
      }
    );

    await moneyPage.exportFullYearlyReport();
  }

  const overspentSponsors = moneyPage.yearlySponsorBreakdown.filter(
    (sponsor) => sponsor.remaining_pence < 0
  );

  const lowSponsorBalances = moneyPage.yearlySponsorBreakdown.filter(
    (sponsor) =>
      sponsor.remaining_pence >= 0 &&
      sponsor.received_pence > 0 &&
      sponsor.remaining_pence <= sponsor.received_pence * 0.2
  );

  const recentActivity = useMemo(() => {
    const transactionActivity = moneyPage.yearTransactions.map((item) => ({
      id: `transaction-${item.id}`,
      recordType: "transaction" as const,
      title: item.title,
      date: item.transaction_date || item.created_at || "",
      amountPence: Number(item.amount_pence || 0),
      direction: item.type === "income" ? ("in" as const) : ("out" as const),
      label: item.sponsor_name || "",
    }));

    const refundActivity = refunds.map((refund) => ({
      id: `refund-${refund.id}`,
      recordType: "refund" as const,
      title: refund.title,
      date: refund.refund_date || refund.created_at || "",
      amountPence: Number(refund.amount_pence || 0),
      direction:
        refund.refund_type === "money_received_back"
          ? ("in" as const)
          : ("out" as const),
      label:
        refund.status === "completed"
          ? refund.refund_type === "money_received_back"
            ? "Completed refund received back"
            : "Completed refund sent back"
          : `${refund.status} refund`,
    }));

    return [...transactionActivity, ...refundActivity]
      .sort((a, b) => {
        const aDate = new Date(a.date).getTime();
        const bDate = new Date(b.date).getTime();

        return bDate - aDate;
      })
      .slice(0, 6);
  }, [moneyPage.yearTransactions, refunds]);

  return (
    <main className="min-h-screen w-full max-w-none overflow-x-auto bg-[#070716] px-1 py-5 text-white sm:px-2 lg:px-3">
      <div className="w-full max-w-none min-w-0 space-y-6">
        <MoneyHeader
          selectedYear={moneyPage.selectedYear}
          yearOptions={moneyPage.yearOptions}
          onYearChange={moneyPage.handleYearChange}
          onRefresh={refreshDashboard}
        />

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-white/[0.02] p-5 shadow-2xl sm:p-6 lg:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-pink-300/20 bg-pink-500/10 px-4 py-2 text-sm font-bold text-pink-100">
                <LayoutDashboard className="h-4 w-4" />
                Money Dashboard
              </div>

              <h1 className="break-words text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                Burton Pride money overview
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65 sm:text-base">
                A clear yearly view of income, spending, completed refunds,
                donations, sponsor balances, monthly movement, and warnings for
                anything that needs checking.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openAddTransactionModal}
                  className="hidden items-center gap-2 rounded-xl bg-pink-500 px-4 py-3 text-sm font-black text-white hover:bg-pink-400 md:inline-flex"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add transaction
                </button>

                <Link
                  href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts/AddTransaction"
                  className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-4 py-3 text-sm font-black text-white hover:bg-pink-400 md:hidden"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add transaction
                </Link>

                <button
                  type="button"
                  onClick={refreshDashboard}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh dashboard
                </button>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:min-w-[860px] xl:grid-cols-5">
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                <div className="mb-3 flex items-center gap-2 text-emerald-100">
                  <Banknote className="h-4 w-4" />

                  <p className="text-xs font-bold uppercase tracking-wide">
                    Money in
                  </p>
                </div>

                <p className="break-words text-2xl font-black text-white">
                  {money(dashboardTotals.income)}
                </p>

                <p className="mt-2 text-xs leading-5 text-emerald-100/65">
                  Includes completed refunds received back.
                </p>
              </div>

              <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
                <div className="mb-3 flex items-center gap-2 text-red-100">
                  <Wallet className="h-4 w-4" />

                  <p className="text-xs font-bold uppercase tracking-wide">
                    Money out
                  </p>
                </div>

                <p className="break-words text-2xl font-black text-white">
                  {money(dashboardTotals.expense)}
                </p>

                <p className="mt-2 text-xs leading-5 text-red-100/65">
                  Includes completed refunds sent back.
                </p>
              </div>

              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
                <div className="mb-3 flex items-center gap-2 text-cyan-100">
                  <RefreshCcw className="h-4 w-4" />

                  <p className="text-xs font-bold uppercase tracking-wide">
                    Refunds received
                  </p>
                </div>

                <p className="break-words text-2xl font-black text-white">
                  {money(refundTotals.receivedBack)}
                </p>

                <p className="mt-2 text-xs leading-5 text-cyan-100/65">
                  Added into Money In when completed.
                </p>
              </div>

              <div className="rounded-2xl border border-purple-300/20 bg-purple-500/10 p-4">
                <div className="mb-3 flex items-center gap-2 text-purple-100">
                  <RotateCcw className="h-4 w-4" />

                  <p className="text-xs font-bold uppercase tracking-wide">
                    Refunds sent
                  </p>
                </div>

                <p className="break-words text-2xl font-black text-white">
                  {money(refundTotals.sentBack)}
                </p>

                <p className="mt-2 text-xs leading-5 text-purple-100/65">
                  Added into Money Out when completed.
                </p>
              </div>

              <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4">
                <div className="mb-3 flex items-center gap-2 text-sky-100">
                  <ShieldCheck className="h-4 w-4" />

                  <p className="text-xs font-bold uppercase tracking-wide">
                    Available balance
                  </p>
                </div>

                <p
                  className={`break-words text-2xl font-black ${
                    dashboardTotals.balance >= 0
                      ? "text-emerald-200"
                      : "text-red-200"
                  }`}
                >
                  {money(dashboardTotals.balance)}
                </p>

                <p className="mt-2 text-xs leading-5 text-sky-100/65">
                  Includes completed refund adjustments.
                </p>
              </div>
            </div>
          </div>
        </section>

        <MoneyPageStatus
          error={moneyPage.error}
          errorDetails={moneyPage.errorDetails}
          selectedYear={moneyPage.selectedYear}
          selectedViewMonth={moneyPage.selectedViewMonth}
          filteredTransactionsLength={moneyPage.filteredTransactions.length}
          yearTransactionsLength={moneyPage.yearTransactions.length}
          filteredRefundsLength={visibleRefunds.length}
          yearRefundsLength={refunds.length}
          completedRefundsLength={completedRefunds.length}
          refundsLoading={refundsLoading}
          refundsError={refundsError}
          refundsErrorDetails={refundsErrorDetails}
        />

        <MoneyDashboardAlerts
          selectedYear={moneyPage.selectedYear}
          transactions={moneyPage.yearTransactions}
          yearlySponsorBreakdown={moneyPage.yearlySponsorBreakdown}
          failedCsvRows={(moneyPage as any).failedCsvRows || []}
          onSetFilter={moneyPage.setFilter}
          onSetSearchTerm={moneyPage.setSearchTerm}
          onMarkTransactionChecked={moneyPage.markTransactionChecked}
        />

        <MoneyStatsCards totals={dashboardTotals as any} />

        <ManualBankBalanceCheck
          selectedYear={moneyPage.selectedYear}
        />

        {(overspentSponsors.length > 0 || lowSponsorBalances.length > 0) && (
          <section className="rounded-3xl border border-red-300/20 bg-red-500/10 p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-2xl bg-red-500/20 p-3 text-red-100 ring-1 ring-red-300/20">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h2 className="text-xl font-black text-white">
                  Sponsor balance warnings
                </h2>

                <p className="text-sm text-red-100/70">
                  Check these before spending more sponsor money.
                </p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {overspentSponsors.map((sponsor) => (
                <div
                  key={`overspent-${sponsor.sponsor_id}`}
                  className="rounded-2xl border border-red-300/20 bg-black/20 p-4"
                >
                  <p className="break-words font-black text-white">
                    {sponsor.sponsor_name}
                  </p>

                  <p className="mt-1 text-sm text-red-100">
                    Overspent by{" "}
                    <strong>{money(Math.abs(sponsor.remaining_pence))}</strong>
                  </p>
                </div>
              ))}

              {lowSponsorBalances.map((sponsor) => (
                <div
                  key={`low-${sponsor.sponsor_id}`}
                  className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4"
                >
                  <p className="break-words font-black text-white">
                    {sponsor.sponsor_name}
                  </p>

                  <p className="mt-1 text-sm text-amber-100">
                    Low sponsor balance left:{" "}
                    <strong>{money(sponsor.remaining_pence)}</strong>
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
          <button
            type="button"
            onClick={openTransactionsWindow}
            className="group hidden rounded-3xl border border-sky-300/20 bg-sky-500/10 p-5 text-left text-sky-100 transition hover:-translate-y-1 hover:bg-white/[0.08] md:block"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <ReceiptText className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Transactions</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Add, edit, print, export, and manage all money records.
            </p>

            <p className="mt-4 text-sm font-black">Open floating window</p>
          </button>

          <Link
            href="/Admin/MoneyManagement/TrackingMoney"
            className="group rounded-3xl border border-sky-300/20 bg-sky-500/10 p-5 text-sky-100 transition hover:-translate-y-1 hover:bg-white/[0.08] md:hidden"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <ReceiptText className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Transactions</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Add, edit, print, export, and manage all money records.
            </p>

            <p className="mt-4 text-sm font-black">Open transactions page</p>
          </Link>

          <button
            type="button"
            onClick={openAddTransactionModal}
            className="group hidden rounded-3xl border border-pink-300/20 bg-pink-500/10 p-5 text-left text-pink-100 transition hover:-translate-y-1 hover:bg-white/[0.08] md:block"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <PlusCircle className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Add payment</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Quickly add money in, money out, personal funds, or sponsor spend.
            </p>

            <p className="mt-4 text-sm font-black">Open floating form</p>
          </button>

          <Link
            href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts/AddTransaction"
            className="group rounded-3xl border border-pink-300/20 bg-pink-500/10 p-5 text-pink-100 transition hover:-translate-y-1 hover:bg-white/[0.08] md:hidden"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <PlusCircle className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Add payment</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Quickly add money in, money out, personal funds, or sponsor spend.
            </p>

            <p className="mt-4 text-sm font-black">Open form page</p>
          </Link>

          <button
            type="button"
            onClick={openSponsorWindow}
            className="group hidden rounded-3xl border border-amber-300/20 bg-amber-500/10 p-5 text-left text-amber-100 transition hover:-translate-y-1 hover:bg-white/[0.08] md:block"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <HandCoins className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Sponsor tracking</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Check sponsor income, spending, remaining balances, and overspend.
            </p>

            <p className="mt-4 text-sm font-black">Open floating window</p>
          </button>

          <Link
            href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts/Sponsors"
            className="group rounded-3xl border border-amber-300/20 bg-amber-500/10 p-5 text-amber-100 transition hover:-translate-y-1 hover:bg-white/[0.08] md:hidden"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <HandCoins className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Sponsor tracking</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Check sponsor income, spending, remaining balances, and overspend.
            </p>

            <p className="mt-4 text-sm font-black">View sponsors</p>
          </Link>

          <button
            type="button"
            onClick={openReportsWindow}
            className="group hidden rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5 text-left text-emerald-100 transition hover:-translate-y-1 hover:bg-white/[0.08] md:block"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <FileText className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Reports</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Use the reports area to print reports and export Excel files.
            </p>

            <p className="mt-4 text-sm font-black">Open floating window</p>
          </button>

          <Link
            href="/Admin/MoneyManagement/TrackingMoney/Exports"
            className="group rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5 text-emerald-100 transition hover:-translate-y-1 hover:bg-white/[0.08] md:hidden"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <FileText className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Reports</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Use the reports area to print reports and export Excel files.
            </p>

            <p className="mt-4 text-sm font-black">Create Report</p>
          </Link>

          <Link
            href="/Admin/MoneyManagement/TrackingMoney/CashTinTracker"
            className="group rounded-3xl border border-amber-300/20 bg-amber-500/10 p-5 text-amber-100 transition hover:-translate-y-1 hover:bg-white/[0.08]"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <Coins className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Cash Tin Tracker</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Track cash fundraising days, starting cash, money received, money
              banked, cash spent, who counted it, and any difference.
            </p>

            <p className="mt-4 text-sm font-black">Open cash tracker</p>
          </Link>

          <Link
            href="/Admin/MoneyManagement/TrackingMoney/BudgetPlanning"
            className="group rounded-3xl border border-purple-300/20 bg-purple-500/10 p-5 text-purple-100 transition hover:-translate-y-1 hover:bg-white/[0.08]"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <PiggyBank className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Budget Planning</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Compare planned budget against actual spending for venue,
              insurance, printing, security, performers, equipment,
              accessibility, and other costs.
            </p>

            <p className="mt-4 text-sm font-black">Open budget planner</p>
          </Link>

          <Link
            href="/Admin/MoneyManagement/TrackingMoney/Refunds"
            className="group rounded-3xl border border-cyan-300/20 bg-cyan-500/10 p-5 text-cyan-100 transition hover:-translate-y-1 hover:bg-white/[0.08]"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <RotateCcw className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Refund Tracker</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Track money returned to Burton Pride and money sent back to other
              people separately from ordinary transactions. Completed refunds
              automatically adjust Money In, Money Out, and the available
              balance.
            </p>

            <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-100 ring-1 ring-emerald-300/20">
                Received: {money(refundTotals.receivedBack)}
              </span>

              <span className="rounded-full bg-purple-500/10 px-3 py-1 text-purple-100 ring-1 ring-purple-300/20">
                Sent: {money(refundTotals.sentBack)}
              </span>
            </div>

            <p className="mt-4 text-sm font-black">Open refund tracker</p>
          </Link>
        </section>

        <section className="min-w-0 space-y-6">
          <MoneyDashboardCharts
            selectedYear={moneyPage.selectedYear}
            transactions={moneyPage.transactions}
            yearlySponsorBreakdown={moneyPage.yearlySponsorBreakdown}
          />

          <div className="w-full max-w-none min-w-0">
            <MoneyMonthlyBreakdown
              selectedYear={moneyPage.selectedYear}
              transactions={moneyPage.transactions}
            />
          </div>

          <section className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-2xl bg-purple-500/15 p-3 text-purple-200 ring-1 ring-purple-300/20">
                  <CalendarDays className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <h2 className="text-xl font-black text-white">
                    Recent activity
                  </h2>

                  <p className="text-sm text-white/50">
                    Latest transactions and refunds in {moneyPage.selectedYear}.
                  </p>
                </div>
              </div>

              {moneyPage.loading ? (
                <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">
                  Loading recent activity...
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">
                  No transactions or refunds found for {moneyPage.selectedYear}.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {recentActivity.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-bold text-white">
                            {item.title}
                          </p>

                          <p className="mt-1 text-xs text-white/45">
                            {item.date}
                          </p>

                          {item.label ? (
                            <p
                              className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                                item.recordType === "refund"
                                  ? "bg-cyan-500/10 text-cyan-100 ring-cyan-300/20"
                                  : "bg-amber-500/10 text-amber-100 ring-amber-300/20"
                              }`}
                            >
                              {item.label}
                            </p>
                          ) : null}
                        </div>

                        <p
                          className={`shrink-0 text-sm font-black ${
                            item.direction === "in"
                              ? "text-emerald-300"
                              : "text-red-300"
                          }`}
                        >
                          {item.direction === "in" ? "+" : "-"}
                          {money(item.amountPence)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={openTransactionsWindow}
                className="mt-4 hidden w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20 md:inline-flex"
              >
                View all transactions
                <ArrowRight className="h-4 w-4" />
              </button>

              <Link
                href="/Admin/Money/Transactions"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20 md:hidden"
              >
                View all transactions
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-200 ring-1 ring-amber-300/20">
                  <Sparkles className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <h2 className="text-xl font-black text-white">
                    Quick checks
                  </h2>

                  <p className="text-sm text-white/50">
                    Things worth checking before reports are shared.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-2xl bg-black/20 p-4">
                  <div className="flex justify-between gap-3">
                    <span className="text-white/60">
                      Transactions this year
                    </span>

                    <strong className="text-white">
                      {moneyPage.yearTransactions.length}
                    </strong>
                  </div>
                </div>

                <div className="rounded-2xl bg-black/20 p-4">
                  <div className="flex justify-between gap-3">
                    <span className="text-white/60">Refunds this year</span>

                    <strong className="text-cyan-200">{refunds.length}</strong>
                  </div>
                </div>

                <div className="rounded-2xl bg-black/20 p-4">
                  <div className="flex justify-between gap-3">
                    <span className="text-white/60">
                      Net completed refund adjustment
                    </span>

                    <strong
                      className={
                        refundTotals.receivedBack - refundTotals.sentBack >= 0
                          ? "text-emerald-300"
                          : "text-red-300"
                      }
                    >
                      {money(
                        refundTotals.receivedBack - refundTotals.sentBack
                      )}
                    </strong>
                  </div>
                </div>

                <div className="rounded-2xl bg-black/20 p-4">
                  <div className="flex justify-between gap-3">
                    <span className="text-white/60">Sponsor warnings</span>

                    <strong
                      className={
                        overspentSponsors.length > 0
                          ? "text-red-300"
                          : "text-emerald-300"
                      }
                    >
                      {overspentSponsors.length}
                    </strong>
                  </div>
                </div>

                <div className="rounded-2xl bg-black/20 p-4">
                  <div className="flex justify-between gap-3">
                    <span className="text-white/60">
                      Personal funds outstanding
                    </span>

                    <strong
                      className={
                        moneyPage.totals.personalFundsOutstanding > 0
                          ? "text-orange-300"
                          : "text-emerald-300"
                      }
                    >
                      {money(moneyPage.totals.personalFundsOutstanding)}
                    </strong>
                  </div>
                </div>

                <div className="rounded-2xl bg-black/20 p-4">
                  <div className="flex justify-between gap-3">
                    <span className="text-white/60">Sponsor money left</span>

                    <strong
                      className={
                        moneyPage.totals.sponsorshipRemaining >= 0
                          ? "text-amber-200"
                          : "text-red-300"
                      }
                    >
                      {money(moneyPage.totals.sponsorshipRemaining)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>
      </div>

      {reportsWindowOpen && (
        <div className="fixed inset-0 z-50 hidden items-start justify-center overflow-y-auto bg-black/75 px-1 py-4 backdrop-blur-sm sm:px-2 md:flex">
          <div className="w-full max-w-none rounded-[2rem] border border-white/10 bg-[#070716] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-white">Reports</h2>

                <p className="text-xs text-white/50">
                  Print reports, export Excel files, and check monthly
                  breakdowns. Completed refunds are included in report totals
                  and exported in a separate Refunds section. These actions are
                  saved to audit logs.
                </p>
              </div>

              <button
                type="button"
                onClick={closeReportsWindow}
                className="shrink-0 rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <button
                type="button"
                onClick={handlePrintReport}
                disabled={moneyPage.printTransactionsList.length === 0 && visibleRefunds.length === 0}
                className="rounded-3xl border border-sky-300/20 bg-sky-500/10 p-5 text-left text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileText className="mb-4 h-6 w-6" />
                <h3 className="text-lg font-black text-white">Print report</h3>
                <p className="mt-2 text-sm text-white/60">
                  Print the selected year or selected month. Refunds are
                  included in a separate section and completed refunds adjust
                  the printed totals.
                </p>
                <p className="mt-4 text-sm font-black">Print now</p>
              </button>

              <button
                type="button"
                onClick={handleExportExcelReport}
                disabled={moneyPage.filteredTransactions.length === 0 && visibleRefunds.length === 0}
                className="rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5 text-left text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileText className="mb-4 h-6 w-6" />
                <h3 className="text-lg font-black text-white">Export Excel</h3>
                <p className="mt-2 text-sm text-white/60">
                  Export the current transaction view to Excel with a
                  separate Refunds worksheet and refund-adjusted summary.
                </p>
                <p className="mt-4 text-sm font-black">Export transactions</p>
              </button>

              <button
                type="button"
                onClick={handleExportYearlyReport}
                disabled={moneyPage.yearTransactions.length === 0 && refunds.length === 0}
                className="rounded-3xl border border-purple-300/20 bg-purple-500/10 p-5 text-left text-purple-100 transition hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileText className="mb-4 h-6 w-6" />
                <h3 className="text-lg font-black text-white">Yearly report</h3>
                <p className="mt-2 text-sm text-white/60">
                  Export the full yearly report with refund-adjusted totals,
                  sponsor breakdown, ordinary transactions, and a Refunds
                  worksheet.
                </p>
                <p className="mt-4 text-sm font-black">Export yearly report</p>
              </button>
            </div>

            <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <MoneyMonthlyBreakdown
                selectedYear={moneyPage.selectedYear}
                transactions={moneyPage.transactions}
              />
            </div>
          </div>
        </div>
      )}

      {sponsorWindowOpen && (
        <div className="fixed inset-0 z-50 hidden items-start justify-center overflow-y-auto bg-black/75 px-1 py-4 backdrop-blur-sm sm:px-2 md:flex">
          <div className="w-full max-w-none rounded-[2rem] border border-white/10 bg-[#070716] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-white">
                  Sponsor tracking
                </h2>

                <p className="text-xs text-white/50">
                  Check sponsor income, spending, remaining balances, and
                  overspend.
                </p>
              </div>

              <button
                type="button"
                onClick={closeSponsorWindow}
                className="shrink-0 rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <MoneySponsorSection
              selectedYear={moneyPage.selectedYear}
              yearlySponsorBreakdown={moneyPage.yearlySponsorBreakdown}
              openNewSponsorForm={moneyPage.openNewSponsorForm}
              startEditSponsor={moneyPage.startEditSponsor}
              setDeleteSponsorId={moneyPage.setDeleteSponsorId}
              openLoanRepaymentModal={moneyPage.openLoanRepaymentModal}
              openLoanInterestModal={moneyPage.openLoanInterestModal}
            />
          </div>
        </div>
      )}

      {transactionsWindowOpen && (
        <div className="fixed inset-0 z-50 hidden items-start justify-center overflow-y-auto bg-black/75 px-1 py-4 backdrop-blur-sm sm:px-2 md:flex">
          <div className="w-full max-w-none rounded-[2rem] border border-white/10 bg-[#070716] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-white">
                  Transactions
                </h2>

                <p className="text-xs text-white/50">
                  View, search, filter, print, export, edit, and hide
                  transactions.
                </p>
              </div>

              <button
                type="button"
                onClick={closeTransactionsWindow}
                className="shrink-0 rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <MoneyTransactionsTable
              loading={moneyPage.loading}
              transactions={moneyPage.transactions}
              filteredTransactions={moneyPage.filteredTransactions}
              yearTransactions={moneyPage.yearTransactions}
              printTransactionsList={moneyPage.printTransactionsList}
              printMonthOptions={moneyPage.printMonthOptions}
              selectedYear={moneyPage.selectedYear}
              selectedViewMonth={moneyPage.selectedViewMonth}
              setSelectedViewMonth={moneyPage.setSelectedViewMonth}
              selectedPrintMonth={moneyPage.selectedPrintMonth}
              setSelectedPrintMonth={moneyPage.setSelectedPrintMonth}
              searchTerm={moneyPage.searchTerm}
              setSearchTerm={moneyPage.setSearchTerm}
              filter={moneyPage.filter}
              setFilter={moneyPage.setFilter}
              selectedSponsorId={moneyPage.selectedSponsorId}
              setSelectedSponsorId={moneyPage.setSelectedSponsorId}
              selectedSponsor={moneyPage.selectedSponsor}
              selectedPaymentMethod={moneyPage.selectedPaymentMethod}
              setSelectedPaymentMethod={moneyPage.setSelectedPaymentMethod}
              displaySponsors={moneyPage.displaySponsors}
              deletingYear={moneyPage.deletingYear}
              deletingAll={moneyPage.deletingAll}
              repayingId={moneyPage.repayingId}
              checkingId={moneyPage.checkingId}
              bankReconcilingId={moneyPage.bankReconcilingId}
              financeNoteUpdatingId={moneyPage.financeNoteUpdatingId}
              deleting={moneyPage.deleting}
              openingBalancePence={moneyPage.totals.openingBalance}
              onPrint={moneyPage.printTransactions}
              onExportExcel={moneyPage.exportTransactionsToExcel}
              onExportYearlyReport={moneyPage.exportFullYearlyReport}
              onOpenDeleteYear={() => moneyPage.setDeleteYearOpen(true)}
              onOpenDeleteAll={() => moneyPage.setDeleteAllOpen(true)}
              onEditTransaction={(item) => {
                setTransactionsWindowOpen(false);
                moneyPage.startEditTransaction(item);
                setAddTransactionOpen(true);
              }}
              onHideTransaction={moneyPage.setDeleteId}
              onTogglePersonalFundsRepaid={moneyPage.togglePersonalFundsRepaid}
              onMarkTransactionChecked={moneyPage.markTransactionChecked}
              onUpdateBankReconciliationStatus={
                moneyPage.updateBankReconciliationStatus
              }
              onUpdateFinanceNote={moneyPage.updateFinanceNote}
            />
          </div>
        </div>
      )}

      {addTransactionOpen && (
        <div className="fixed inset-0 z-50 hidden items-start justify-center overflow-y-auto bg-black/75 px-1 py-4 backdrop-blur-sm sm:px-2 md:flex">
          <div className="w-full max-w-[520px] rounded-[2rem] border border-white/10 bg-[#070716] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-white">
                  Add transaction
                </h2>

                <p className="text-xs text-white/50">
                  Save money in, money out, sponsor spend, or personal funds.
                </p>
              </div>

              <button
                type="button"
                onClick={closeAddTransactionModal}
                className="shrink-0 rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <MoneyTransactionForm
              form={moneyPage.form}
              setForm={moneyPage.setForm}
              invoiceFiles={moneyPage.invoiceFiles}
              setInvoiceFiles={moneyPage.setInvoiceFiles}
              editingTransaction={moneyPage.editingTransaction}
              displaySponsors={moneyPage.displaySponsors}
              yearlySponsorBreakdown={moneyPage.yearlySponsorBreakdown}
              saving={moneyPage.saving}
              handleSubmit={moneyPage.handleSubmit}
              cancelEditTransaction={closeAddTransactionModal}
              openNewSponsorForm={moneyPage.openNewSponsorForm}
            />
          </div>
        </div>
      )}

      <MoneyPageModals
        sponsorFormOpen={moneyPage.sponsorFormOpen}
        editingSponsor={moneyPage.editingSponsor}
        sponsorForm={moneyPage.sponsorForm}
        setSponsorForm={moneyPage.setSponsorForm}
        savingSponsor={moneyPage.savingSponsor}
        onCloseSponsorForm={moneyPage.closeSponsorForm}
        onSaveSponsor={moneyPage.saveSponsor}
        deleteYearOpen={moneyPage.deleteYearOpen}
        selectedYear={moneyPage.selectedYear}
        yearTransactionsLength={moneyPage.yearTransactions.length}
        deletingYear={moneyPage.deletingYear}
        deleteYearPassword={moneyPage.deleteYearPassword}
        setDeleteYearPassword={moneyPage.setDeleteYearPassword}
        onCloseDeleteYear={moneyPage.closeDeleteYear}
        onDeleteYear={moneyPage.deleteSelectedYearTransactions}
        deleteSponsorId={moneyPage.deleteSponsorId}
        deletingSponsor={moneyPage.deletingSponsor}
        setDeleteSponsorId={moneyPage.setDeleteSponsorId}
        onDeleteSponsor={moneyPage.deleteSponsor}
        deleteId={moneyPage.deleteId}
        deleting={moneyPage.deleting}
        setDeleteId={moneyPage.setDeleteId}
        onHidePayment={moneyPage.deleteTransaction}
        deleteAllOpen={moneyPage.deleteAllOpen}
        transactionsLength={moneyPage.transactions.length}
        deletingAll={moneyPage.deletingAll}
        deleteAllPassword={moneyPage.deleteAllPassword}
        setDeleteAllPassword={moneyPage.setDeleteAllPassword}
        onCloseDeleteAll={moneyPage.closeDeleteAll}
        onDeleteAll={moneyPage.deleteAllTransactions}
        loanRepaymentSponsor={moneyPage.loanRepaymentSponsor}
        loanRepaymentForm={moneyPage.loanRepaymentForm}
        setLoanRepaymentForm={moneyPage.setLoanRepaymentForm}
        savingLoanRepayment={moneyPage.savingLoanRepayment}
        onCloseLoanRepayment={moneyPage.closeLoanRepaymentModal}
        onSaveLoanRepayment={moneyPage.saveLoanRepayment}
        loanInterestSponsor={moneyPage.loanInterestSponsor}
        loanInterestForm={moneyPage.loanInterestForm}
        setLoanInterestForm={moneyPage.setLoanInterestForm}
        savingLoanInterest={moneyPage.savingLoanInterest}
        onCloseLoanInterest={moneyPage.closeLoanInterestModal}
        onSaveLoanInterest={moneyPage.saveLoanInterest}
      />
    </main>
  );
}
