import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  FileSpreadsheet,
  ShieldAlert,
} from "lucide-react";

import MoneyExportsClient from "../../../components/money/exports/MoneyExportsClient";
import FundingReportExportButton from "../../../components/money/exports/FundingReportExportButton";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportIconKey =
  | "archive"
  | "report"
  | "spreadsheet"
  | "receipt"
  | "history"
  | "personal"
  | "upload"
  | "bank"
  | "refund";

type ExportItem = {
  key: string;
  title: string;
  description: string;
  buttonText: string;
  url: string;
  fileName: string;
  iconKey: ExportIconKey;
  colour: string;
  buttonColour: string;
  recommended?: boolean;
};

type FundingExportRecord = {
  id: string;
  sponsor_name: string | null;
  contact_name?: string | null;
  email?: string | null;
  funding_type?: string | null;
  agreed_amount_pence?: number | null;
  received_amount_pence?: number | null;
  is_active?: boolean | null;
};

function poundsFromPence(value: number | null | undefined) {
  return Number(value || 0) / 100;
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(poundsFromPence(value));
}

function fundingTypeLabel(type?: string | null) {
  if (type === "grant") return "Grant";
  if (type === "loan") return "Loan";
  if (type === "other") return "Other funding";
  return "Sponsor";
}

async function loadFundingRecords() {
  const { data, error } = await supabaseAdmin
    .from("money_sponsors")
    .select(
      "id, sponsor_name, contact_name, email, funding_type, agreed_amount_pence, received_amount_pence, is_active"
    )
    .order("sponsor_name", { ascending: true });

  if (error) {
    console.error("Could not load funding records for export page:", error);

    return {
      records: [] as FundingExportRecord[],
      error: {
        message: error.message,
        hint: error.hint,
        code: error.code,
      },
    };
  }

  return {
    records: (data || []) as FundingExportRecord[],
    error: null,
  };
}

export default async function MoneyExportsPage() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <main className="min-h-screen w-full bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="w-full rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/20 text-red-300">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <h1 className="text-3xl font-black">Please sign in</h1>

          <p className="mt-3 text-white/70">
            You must be signed in to access the money export centre.
          </p>

          <Link
            href="/admin"
            className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
          >
            Go back
          </Link>
        </div>
      </main>
    );
  }

  const currentYear = new Date().getFullYear();

  const { records: fundingRecords, error: fundingLoadError } =
    await loadFundingRecords();

  const exportItems: ExportItem[] = [
    {
      key: "accountant-pack",
      title: "Accountant Export Pack",
      description:
        "Best option for your accountant. Downloads one ZIP file with yearly report, transactions, receipts index, audit logs, personal funds report, CSV import history, bank checks, and the refund tracker report.",
      buttonText: "Download Accountant Pack",
      url: `/api/admin/money/export/accountant-export-pack?year=${currentYear}`,
      fileName: `burton-pride-accountant-export-pack-${currentYear}.zip`,
      iconKey: "archive",
      colour:
        "border-emerald-400/30 bg-emerald-500/10 text-emerald-100 shadow-emerald-950/20",
      buttonColour: "bg-emerald-400 text-emerald-950 hover:bg-emerald-300",
      recommended: true,
    },
    {
      key: "yearly-report",
      title: "Yearly Report",
      description:
        "Shows the full yearly totals, including income, spending, balance, personal funds used, personal funds repaid, and outstanding personal funds.",
      buttonText: "Download Yearly Report",
      url: `/api/admin/money/export/yearly-report-export?year=${currentYear}`,
      fileName: `burton-pride-full-yearly-report-${currentYear}.xlsx`,
      iconKey: "report",
      colour:
        "border-blue-400/30 bg-blue-500/10 text-blue-100 shadow-blue-950/20",
      buttonColour: "bg-blue-400 text-blue-950 hover:bg-blue-300",
    },
    {
      key: "transaction-list",
      title: "Transaction List",
      description:
        "Exports every transaction for the selected year. Good for checking all money in and money out line by line.",
      buttonText: "Download Transactions",
      url: `/api/admin/money/export/transactions-export?year=${currentYear}`,
      fileName: `burton-pride-transactions-${currentYear}.xlsx`,
      iconKey: "spreadsheet",
      colour:
        "border-cyan-400/30 bg-cyan-500/10 text-cyan-100 shadow-cyan-950/20",
      buttonColour: "bg-cyan-400 text-cyan-950 hover:bg-cyan-300",
    },
    {
      key: "receipts",
      title: "Receipts Export",
      description:
        "Exports a receipt index showing which transactions have receipts attached. Useful for checking missing or uploaded receipts.",
      buttonText: "Download Receipts Index",
      url: `/api/admin/money/export/receipts-export?year=${currentYear}`,
      fileName: `burton-pride-receipts-${currentYear}.xlsx`,
      iconKey: "receipt",
      colour:
        "border-orange-400/30 bg-orange-500/10 text-orange-100 shadow-orange-950/20",
      buttonColour: "bg-orange-400 text-orange-950 hover:bg-orange-300",
    },
    {
      key: "audit-logs",
      title: "Audit Logs",
      description:
        "Shows who created, edited, deleted, restored, or changed money records. Good for transparency and internal checking.",
      buttonText: "Download Audit Logs",
      url: `/api/admin/money/export/audit-logs-export?year=${currentYear}`,
      fileName: `burton-pride-audit-logs-${currentYear}.xlsx`,
      iconKey: "history",
      colour:
        "border-purple-400/30 bg-purple-500/10 text-purple-100 shadow-purple-950/20",
      buttonColour: "bg-purple-400 text-purple-950 hover:bg-purple-300",
    },
    {
      key: "personal-funds",
      title: "Personal Funds Report",
      description:
        "Shows money paid personally by committee/admins, who paid it, whether it has been paid back, and what is still outstanding.",
      buttonText: "Download Personal Funds",
      url: `/api/admin/money/export/personal-funds-export?year=${currentYear}`,
      fileName: `burton-pride-personal-funds-${currentYear}.xlsx`,
      iconKey: "personal",
      colour:
        "border-pink-400/30 bg-pink-500/10 text-pink-100 shadow-pink-950/20",
      buttonColour: "bg-pink-400 text-pink-950 hover:bg-pink-300",
    },
    {
      key: "csv-import-history",
      title: "CSV Import History",
      description:
        "Shows CSV files that were imported, how many rows worked, how many failed, and any error notes.",
      buttonText: "Download CSV Import History",
      url: `/api/admin/money/export/csv-import-history-export?year=${currentYear}`,
      fileName: `burton-pride-csv-import-history-${currentYear}.xlsx`,
      iconKey: "upload",
      colour:
        "border-indigo-400/30 bg-indigo-500/10 text-indigo-100 shadow-indigo-950/20",
      buttonColour: "bg-indigo-400 text-indigo-950 hover:bg-indigo-300",
    },
    {
      key: "bank-balance-checks",
      title: "Bank Balance Checks",
      description:
        "Exports manual bank balance checks so you can compare the real bank statement balance against the money tracker balance.",
      buttonText: "Download Bank Checks",
      url: `/api/admin/money/export/bank-balance-checks-export?year=${currentYear}`,
      fileName: `burton-pride-bank-balance-checks-${currentYear}.xlsx`,
      iconKey: "bank",
      colour:
        "border-teal-400/30 bg-teal-500/10 text-teal-100 shadow-teal-950/20",
      buttonColour: "bg-teal-400 text-teal-950 hover:bg-teal-300",
    },
    {
      key: "refunds",
      title: "Refund Tracker Export",
      description:
        "Exports active and deleted refunds separately so refunds do not get mixed up with ordinary income and expenses. Includes completed, pending and cancelled refund records.",
      buttonText: "Download Refund Tracker",
      url: `/api/admin/money/export/refunds-export?year=${currentYear}`,
      fileName: `burton-pride-refund-tracker-${currentYear}.xlsx`,
      iconKey: "refund",
      colour:
        "border-violet-400/30 bg-violet-500/10 text-violet-100 shadow-violet-950/20",
      buttonColour:
        "bg-violet-400 text-violet-950 hover:bg-violet-300",
    },
  ];

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.20),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_35%),#020617] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="w-full max-w-none">
        <div className="mb-6 flex w-full flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/Admin/MoneyManagement/TrackingMoney"
              className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white/80 transition hover:bg-white/15"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Money Tracker
            </Link>

            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
              Money Export Centre
            </h1>

            <p className="mt-3 max-w-5xl text-base text-white/70">
              Download different reports from the money tracker. Use the
              accountant pack if you want everything together in one ZIP file,
              or use the smaller buttons for one specific report.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-4 text-sm text-white/70 shadow-2xl backdrop-blur-xl">
            <div className="font-black text-white">Current export year</div>
            <div className="mt-1 text-3xl font-black text-emerald-200">
              {currentYear}
            </div>
          </div>
        </div>

        <section className="mb-6 rounded-[2rem] border border-yellow-400/20 bg-yellow-500/10 p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-yellow-300/25 bg-yellow-300/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-yellow-100">
                <FileSpreadsheet className="h-4 w-4" />
                Individual funding reports
              </div>

              <h2 className="text-2xl font-black text-white">
                Export one grant, sponsor, loan or funding record
              </h2>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/65">
                Use these buttons when you need a separate report for one
                funding record. Each button uses the funding report API route
                and sends the funding ID plus the year.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm">
              <div className="font-black text-white">Export year</div>
              <div className="mt-1 text-2xl font-black text-yellow-100">
                {currentYear}
              </div>
            </div>
          </div>

          {fundingLoadError && (
            <div className="mt-5 whitespace-pre-wrap rounded-2xl border border-red-300/25 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
              Could not load funding records from money_sponsors.
              {"\n"}
              {fundingLoadError.message}
              {fundingLoadError.hint ? `\nHint: ${fundingLoadError.hint}` : ""}
              {fundingLoadError.code ? `\nCode: ${fundingLoadError.code}` : ""}
            </div>
          )}

          {!fundingLoadError && fundingRecords.length === 0 && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/30 p-5 text-sm text-white/65">
              No funding records found yet. Once sponsors, grants, loans or
              other funding records are added, their individual export buttons
              will show here.
            </div>
          )}

          {fundingRecords.length > 0 && (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {fundingRecords.map((funding) => {
                const name =
                  funding.sponsor_name || "Unnamed funding record";

                const amount =
                  funding.received_amount_pence ??
                  funding.agreed_amount_pence ??
                  0;

                return (
                  <article
                    key={funding.id}
                    className="flex min-h-[230px] flex-col rounded-3xl border border-white/10 bg-slate-950/30 p-5 shadow-xl"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-300/15 text-yellow-100">
                        <Building2 className="h-5 w-5" />
                      </div>

                      <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-white/70">
                        {fundingTypeLabel(funding.funding_type)}
                      </span>
                    </div>

                    <h3 className="mt-4 text-lg font-black text-white">
                      {name}
                    </h3>

                    <div className="mt-3 space-y-1 text-sm text-white/60">
                      <p>
                        Contact:{" "}
                        <span className="font-bold text-white/80">
                          {funding.contact_name || "None"}
                        </span>
                      </p>

                      <p>
                        Amount:{" "}
                        <span className="font-bold text-yellow-100">
                          {formatMoney(amount)}
                        </span>
                      </p>
                    </div>

                    <div className="flex-1" />

                    <div className="mt-5">
                      <FundingReportExportButton
                        fundingId={funding.id}
                        year={String(currentYear)}
                        label="Export this funding report"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-yellow-300 px-4 py-3 text-sm font-black text-yellow-950 shadow-lg transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <MoneyExportsClient
          defaultYear={currentYear}
          exportItems={exportItems}
        />
      </div>
    </main>
  );
}