import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MoneyTransaction = {
  id: string;
  created_at?: string | null;
  title?: string | null;
  description?: string | null;
  type?: "income" | "expense" | string | null;
  category?: string | null;
  amount_pence?: number | null;
  payment_method?: string | null;
  transaction_date?: string | null;
  invoice_image_url?: string | null;
  sponsor_id?: string | null;
  sponsor_name?: string | null;
  sponsorship_note?: string | null;
  is_personal_funds?: boolean | null;
  personal_funds_name?: string | null;
  personal_funds_repaid?: boolean | null;
  personal_funds_repaid_at?: string | null;
  source?: string | null;
  deleted_at?: string | null;
};

type MoneySponsor = {
  id: string;
  sponsor_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  agreed_amount_pence?: number | null;
  received_amount_pence?: number | null;
  notes?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

type AuditLog = {
  id: string;
  created_at?: string | null;
  action?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  transaction_title?: string | null;
  metadata?: any;
  before_data?: any;
  after_data?: any;
};

type CsvImportRow = {
  id?: string;
  created_at?: string | null;
  file_name?: string | null;
  imported_rows?: number | null;
  failed_rows?: number | null;
  status?: string | null;
  error_message?: string | null;
  notes?: string | null;
};

type BankBalanceCheck = {
  id?: string;
  created_at?: string | null;
  check_date?: string | null;
  statement_balance_pence?: number | null;
  tracker_balance_pence?: number | null;
  difference_pence?: number | null;
  notes?: string | null;
  created_by_name?: string | null;
};

function escapeHtml(value: any) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(amountPence: number | null | undefined) {
  const value = Number(amountPence || 0) / 100;

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function yearRange(year: number) {
  return {
    start: `${year}-01-01`,
    end: `${year + 1}-01-01`,
  };
}

function normaliseExportKey(value: string) {
  const key = decodeURIComponent(String(value || ""))
    .trim()
    .toLowerCase();

  const aliases: Record<string, string> = {
    all: "all",

    "accountant-pack": "accountant-pack",
    "accountant-export-pack": "accountant-pack",
    "accountant": "accountant-pack",

    "yearly-report": "yearly-report",
    "year-report": "yearly-report",
    "yearly": "yearly-report",

    "transaction-list": "transaction-list",
    "transactions": "transaction-list",
    "transaction": "transaction-list",

    receipts: "receipts",
    "receipts-export": "receipts",
    "receipt-export": "receipts",
    "receipts-index": "receipts",

    "audit-logs": "audit-logs",
    "audit-logs-export": "audit-logs",
    "audit": "audit-logs",

    "funding-breakdown": "funding-breakdown",
    "funding": "funding-breakdown",
    "sponsors": "funding-breakdown",
    "sponsor-breakdown": "funding-breakdown",

    "personal-funds": "personal-funds",
    "personal-funds-export": "personal-funds",

    "csv-import-history": "csv-import-history",
    "csv-import-history-export": "csv-import-history",
    "csv-history": "csv-import-history",

    "bank-balance-checks": "bank-balance-checks",
    "bank-balance-checks-export": "bank-balance-checks",
    "bank-checks": "bank-balance-checks",
  };

  return aliases[key] || key;
}

function getReportTitle(report: string) {
  if (report === "all") return "All Money Export Print Reports";
  if (report === "accountant-pack") return "Accountant Export Pack";
  if (report === "yearly-report") return "Yearly Report";
  if (report === "transaction-list") return "Transaction List";
  if (report === "receipts") return "Receipts Export";
  if (report === "audit-logs") return "Audit Logs";
  if (report === "funding-breakdown") return "Funding / Sponsor Breakdown";
  if (report === "personal-funds") return "Personal Funds Report";
  if (report === "csv-import-history") return "CSV Import History";
  if (report === "bank-balance-checks") return "Bank Balance Checks";

  return "Money Export Print Report";
}

function htmlPage({
  title,
  year,
  body,
}: {
  title: string;
  year: number;
  body: string;
}) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)} - ${year}</title>

    <style>
      @page {
        size: A4 landscape;
        margin: 10mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: #ffffff;
        color: #111827;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
        line-height: 1.4;
      }

      .print-bar {
        position: sticky;
        top: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        background: #111827;
        color: #ffffff;
      }

      .print-bar strong {
        font-size: 14px;
      }

      .print-bar button {
        border: 0;
        border-radius: 999px;
        background: #ffffff;
        color: #111827;
        padding: 9px 14px;
        font-weight: 900;
        cursor: pointer;
      }

      .page {
        padding: 18px;
      }

      .header {
        border-bottom: 3px solid #111827;
        padding-bottom: 12px;
        margin-bottom: 16px;
      }

      .brand {
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #374151;
      }

      h1 {
        margin: 5px 0 0;
        font-size: 26px;
        line-height: 1.1;
      }

      h2 {
        margin: 24px 0 10px;
        font-size: 18px;
        border-bottom: 1px solid #d1d5db;
        padding-bottom: 6px;
      }

      .muted {
        color: #6b7280;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 10px;
        margin: 16px 0;
      }

      .summary-card {
        border: 1px solid #d1d5db;
        border-radius: 10px;
        padding: 10px;
        break-inside: avoid;
      }

      .summary-label {
        color: #6b7280;
        font-size: 10px;
        font-weight: 900;
        text-transform: uppercase;
      }

      .summary-value {
        margin-top: 4px;
        font-size: 16px;
        font-weight: 900;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
      }

      th,
      td {
        border: 1px solid #d1d5db;
        padding: 7px;
        text-align: left;
        vertical-align: top;
        word-break: break-word;
      }

      th {
        background: #f3f4f6;
        font-size: 10px;
        text-transform: uppercase;
      }

      tr {
        break-inside: avoid;
      }

      .amount {
        text-align: right;
        white-space: nowrap;
      }

      .note {
        border: 1px solid #f59e0b;
        background: #fffbeb;
        color: #78350f;
        border-radius: 10px;
        padding: 10px;
        margin: 14px 0;
      }

      .error {
        border: 1px solid #ef4444;
        background: #fef2f2;
        color: #7f1d1d;
        border-radius: 10px;
        padding: 10px;
        margin: 14px 0;
      }

      pre {
        white-space: pre-wrap;
        word-break: break-word;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 8px;
        font-size: 10px;
      }

      .footer {
        margin-top: 24px;
        color: #6b7280;
        font-size: 10px;
      }

      @media print {
        .print-bar {
          display: none;
        }

        .page {
          padding: 0;
        }

        body {
          font-size: 10px;
        }

        h1 {
          font-size: 22px;
        }

        h2 {
          font-size: 15px;
          page-break-after: avoid;
        }

        th,
        td {
          padding: 5px;
        }

        .summary-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
    </style>
  </head>

  <body>
    <div class="print-bar">
      <strong>${escapeHtml(title)} - ${year}</strong>
      <button onclick="window.print()">Print / Save PDF</button>
    </div>

    <main class="page">
      <header class="header">
        <div class="brand">Burton Pride Money Management</div>
        <h1>${escapeHtml(title)}</h1>
        <p class="muted">Year: ${year}</p>
      </header>

      ${body}

      <div class="footer">
        Printed from Burton Pride Money Management. Generated ${escapeHtml(
          new Date().toLocaleString("en-GB")
        )}.
      </div>
    </main>
  </body>
</html>`;
}

async function getTransactions(year: number) {
  const { start, end } = yearRange(year);

  const { data, error } = await supabaseAdmin
    .from("money_transactions")
    .select("*")
    .gte("transaction_date", start)
    .lt("transaction_date", end)
    .is("deleted_at", null)
    .order("transaction_date", { ascending: true });

  if (error) throw error;

  return (data || []) as MoneyTransaction[];
}

async function getSponsors() {
  const { data, error } = await supabaseAdmin
    .from("money_sponsors")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []) as MoneySponsor[];
}

async function getAuditLogs(year: number) {
  const { start, end } = yearRange(year);

  const { data, error } = await supabaseAdmin
    .from("admin_money_audit_logs")
    .select("*")
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) throw error;

  return (data || []) as AuditLog[];
}

async function tryGetCsvImportHistory(year: number) {
  const { start, end } = yearRange(year);

  const tableNames = [
    "money_csv_import_history",
    "csv_import_history",
    "money_csv_imports",
  ];

  for (const tableName of tableNames) {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select("*")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (!error) {
      return {
        tableName,
        rows: (data || []) as CsvImportRow[],
      };
    }
  }

  return {
    tableName: "",
    rows: [] as CsvImportRow[],
  };
}

async function tryGetBankBalanceChecks(year: number) {
  const { start, end } = yearRange(year);

  const tableNames = [
    "money_bank_balance_checks",
    "bank_balance_checks",
    "money_bank_checks",
  ];

  for (const tableName of tableNames) {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select("*")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (!error) {
      return {
        tableName,
        rows: (data || []) as BankBalanceCheck[],
      };
    }
  }

  return {
    tableName: "",
    rows: [] as BankBalanceCheck[],
  };
}

function summaryCards(transactions: MoneyTransaction[]) {
  const income = transactions
    .filter((item) => item.type === "income")
    .reduce((total, item) => total + Number(item.amount_pence || 0), 0);

  const expense = transactions
    .filter((item) => item.type === "expense")
    .reduce((total, item) => total + Number(item.amount_pence || 0), 0);

  const personalFunds = transactions
    .filter((item) => item.is_personal_funds)
    .reduce((total, item) => total + Number(item.amount_pence || 0), 0);

  const unpaidPersonalFunds = transactions
    .filter((item) => item.is_personal_funds && !item.personal_funds_repaid)
    .reduce((total, item) => total + Number(item.amount_pence || 0), 0);

  const missingReceipts = transactions.filter(
    (item) => item.type === "expense" && !item.invoice_image_url
  ).length;

  const balance = income - expense;

  return `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Income</div>
        <div class="summary-value">${escapeHtml(money(income))}</div>
      </div>

      <div class="summary-card">
        <div class="summary-label">Expenses</div>
        <div class="summary-value">${escapeHtml(money(expense))}</div>
      </div>

      <div class="summary-card">
        <div class="summary-label">Balance</div>
        <div class="summary-value">${escapeHtml(money(balance))}</div>
      </div>

      <div class="summary-card">
        <div class="summary-label">Transactions</div>
        <div class="summary-value">${transactions.length}</div>
      </div>

      <div class="summary-card">
        <div class="summary-label">Personal Funds</div>
        <div class="summary-value">${escapeHtml(money(personalFunds))}</div>
      </div>

      <div class="summary-card">
        <div class="summary-label">Unpaid Personal Funds</div>
        <div class="summary-value">${escapeHtml(
          money(unpaidPersonalFunds)
        )}</div>
      </div>

      <div class="summary-card">
        <div class="summary-label">Missing Receipts</div>
        <div class="summary-value">${missingReceipts}</div>
      </div>
    </div>
  `;
}

function transactionTable(transactions: MoneyTransaction[]) {
  if (!transactions.length) {
    return `<p class="muted">No transactions found for this year.</p>`;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Title</th>
          <th>Description / Notes</th>
          <th>Type</th>
          <th>Category</th>
          <th>Payment</th>
          <th>Sponsor / Fund</th>
          <th>Personal Funds</th>
          <th>Receipt</th>
          <th class="amount">Amount</th>
        </tr>
      </thead>

      <tbody>
        ${transactions
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(
                  formatDate(item.transaction_date || item.created_at)
                )}</td>
                <td><strong>${escapeHtml(item.title || "-")}</strong></td>
                <td>${escapeHtml(
                  item.description || item.sponsorship_note || "-"
                )}</td>
                <td>${escapeHtml(item.type || "-")}</td>
                <td>${escapeHtml(item.category || "-")}</td>
                <td>${escapeHtml(item.payment_method || "-")}</td>
                <td>${escapeHtml(item.sponsor_name || "-")}</td>
                <td>${escapeHtml(
                  item.is_personal_funds
                    ? `${item.personal_funds_name || "Personal funds"} - ${
                        item.personal_funds_repaid ? "Repaid" : "Not repaid"
                      }`
                    : "-"
                )}</td>
                <td>${item.invoice_image_url ? "Yes" : "No"}</td>
                <td class="amount">${escapeHtml(money(item.amount_pence))}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function receiptsTable(transactions: MoneyTransaction[]) {
  const rows = transactions.filter(
    (item) => item.type === "expense" || item.invoice_image_url
  );

  if (!rows.length) {
    return `<p class="muted">No receipt records found for this year.</p>`;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Transaction</th>
          <th>Category</th>
          <th>Payment</th>
          <th>Receipt status</th>
          <th>Receipt link</th>
          <th class="amount">Amount</th>
        </tr>
      </thead>

      <tbody>
        ${rows
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(
                  formatDate(item.transaction_date || item.created_at)
                )}</td>
                <td><strong>${escapeHtml(item.title || "-")}</strong></td>
                <td>${escapeHtml(item.category || "-")}</td>
                <td>${escapeHtml(item.payment_method || "-")}</td>
                <td>${item.invoice_image_url ? "Receipt uploaded" : "Missing receipt"}</td>
                <td>${escapeHtml(item.invoice_image_url || "-")}</td>
                <td class="amount">${escapeHtml(money(item.amount_pence))}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function personalFundsTable(transactions: MoneyTransaction[]) {
  const rows = transactions.filter((item) => item.is_personal_funds);

  if (!rows.length) {
    return `<p class="muted">No personal funds found for this year.</p>`;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Title</th>
          <th>Person</th>
          <th>Paid back?</th>
          <th>Paid back date</th>
          <th class="amount">Amount</th>
        </tr>
      </thead>

      <tbody>
        ${rows
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(
                  formatDate(item.transaction_date || item.created_at)
                )}</td>
                <td><strong>${escapeHtml(item.title || "-")}</strong></td>
                <td>${escapeHtml(item.personal_funds_name || "-")}</td>
                <td>${item.personal_funds_repaid ? "Yes" : "No"}</td>
                <td>${escapeHtml(formatDate(item.personal_funds_repaid_at))}</td>
                <td class="amount">${escapeHtml(money(item.amount_pence))}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function sponsorTable(
  sponsors: MoneySponsor[],
  transactions: MoneyTransaction[]
) {
  const names = new Set<string>();

  sponsors.forEach((sponsor) => {
    if (sponsor.sponsor_name) names.add(sponsor.sponsor_name);
  });

  transactions.forEach((item) => {
    if (item.sponsor_name) names.add(item.sponsor_name);
  });

  const rows = Array.from(names).map((name) => {
    const sponsor = sponsors.find(
      (item) =>
        String(item.sponsor_name || "").toLowerCase() === name.toLowerCase()
    );

    const sponsorTransactions = transactions.filter(
      (item) =>
        String(item.sponsor_name || "").toLowerCase() === name.toLowerCase()
    );

    const income = sponsorTransactions
      .filter((item) => item.type === "income")
      .reduce((total, item) => total + Number(item.amount_pence || 0), 0);

    const spent = sponsorTransactions
      .filter((item) => item.type === "expense")
      .reduce((total, item) => total + Number(item.amount_pence || 0), 0);

    const received = Number(sponsor?.received_amount_pence || 0) || income;
    const agreed = Number(sponsor?.agreed_amount_pence || 0);
    const remaining = received - spent;

    return {
      name,
      contact: sponsor?.contact_name || "",
      email: sponsor?.email || "",
      phone: sponsor?.phone || "",
      agreed,
      received,
      spent,
      remaining,
      notes: sponsor?.notes || "",
    };
  });

  if (!rows.length) {
    return `<p class="muted">No sponsor or funding records found.</p>`;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Sponsor / Funding</th>
          <th>Contact</th>
          <th>Email</th>
          <th>Phone</th>
          <th class="amount">Agreed</th>
          <th class="amount">Received</th>
          <th class="amount">Spent</th>
          <th class="amount">Remaining</th>
          <th>Notes</th>
        </tr>
      </thead>

      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td><strong>${escapeHtml(row.name)}</strong></td>
                <td>${escapeHtml(row.contact || "-")}</td>
                <td>${escapeHtml(row.email || "-")}</td>
                <td>${escapeHtml(row.phone || "-")}</td>
                <td class="amount">${escapeHtml(money(row.agreed))}</td>
                <td class="amount">${escapeHtml(money(row.received))}</td>
                <td class="amount">${escapeHtml(money(row.spent))}</td>
                <td class="amount">${escapeHtml(money(row.remaining))}</td>
                <td>${escapeHtml(row.notes || "-")}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function auditLogsTable(logs: AuditLog[]) {
  if (!logs.length) {
    return `<p class="muted">No audit logs found for this year.</p>`;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Date / Time</th>
          <th>Action</th>
          <th>Who</th>
          <th>Email</th>
          <th>Record</th>
          <th>Details</th>
        </tr>
      </thead>

      <tbody>
        ${logs
          .map(
            (log) => `
              <tr>
                <td>${escapeHtml(formatDateTime(log.created_at))}</td>
                <td><strong>${escapeHtml(log.action || "-")}</strong></td>
                <td>${escapeHtml(log.actor_name || "-")}</td>
                <td>${escapeHtml(log.actor_email || "-")}</td>
                <td>${escapeHtml(log.transaction_title || "-")}</td>
                <td>
                  <pre>${escapeHtml(
                    JSON.stringify(
                      {
                        metadata: log.metadata || null,
                        before: log.before_data || null,
                        after: log.after_data || null,
                      },
                      null,
                      2
                    )
                  )}</pre>
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function csvImportTable(result: {
  tableName: string;
  rows: CsvImportRow[];
}) {
  if (!result.tableName) {
    return `
      <div class="note">
        No CSV import history table was found. This print route checked:
        money_csv_import_history, csv_import_history, money_csv_imports.
      </div>
    `;
  }

  if (!result.rows.length) {
    return `<p class="muted">No CSV import history found for this year.</p>`;
  }

  return `
    <p class="muted">Source table: ${escapeHtml(result.tableName)}</p>

    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>File name</th>
          <th>Status</th>
          <th>Imported rows</th>
          <th>Failed rows</th>
          <th>Error / Notes</th>
        </tr>
      </thead>

      <tbody>
        ${result.rows
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(formatDateTime(row.created_at))}</td>
                <td><strong>${escapeHtml(row.file_name || "-")}</strong></td>
                <td>${escapeHtml(row.status || "-")}</td>
                <td>${escapeHtml(row.imported_rows ?? "-")}</td>
                <td>${escapeHtml(row.failed_rows ?? "-")}</td>
                <td>${escapeHtml(row.error_message || row.notes || "-")}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function bankBalanceTable(result: {
  tableName: string;
  rows: BankBalanceCheck[];
}) {
  if (!result.tableName) {
    return `
      <div class="note">
        No bank balance checks table was found. This print route checked:
        money_bank_balance_checks, bank_balance_checks, money_bank_checks.
      </div>
    `;
  }

  if (!result.rows.length) {
    return `<p class="muted">No bank balance checks found for this year.</p>`;
  }

  return `
    <p class="muted">Source table: ${escapeHtml(result.tableName)}</p>

    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Created by</th>
          <th class="amount">Statement balance</th>
          <th class="amount">Tracker balance</th>
          <th class="amount">Difference</th>
          <th>Notes</th>
        </tr>
      </thead>

      <tbody>
        ${result.rows
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(
                  formatDate(row.check_date || row.created_at)
                )}</td>
                <td>${escapeHtml(row.created_by_name || "-")}</td>
                <td class="amount">${escapeHtml(
                  money(row.statement_balance_pence)
                )}</td>
                <td class="amount">${escapeHtml(
                  money(row.tracker_balance_pence)
                )}</td>
                <td class="amount">${escapeHtml(
                  money(row.difference_pence)
                )}</td>
                <td>${escapeHtml(row.notes || "-")}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

async function safeSection(
  title: string,
  callback: () => Promise<string> | string
) {
  try {
    const html = await callback();

    return `<h2>${escapeHtml(title)}</h2>${html}`;
  } catch (error: any) {
    return `
      <h2>${escapeHtml(title)}</h2>
      <div class="error">
        <strong>Could not load this section.</strong><br />
        ${escapeHtml(error?.message || String(error))}
      </div>
    `;
  }
}

async function buildReportBody(report: string, year: number) {
  const transactions = await getTransactions(year);

  if (report === "all" || report === "accountant-pack") {
    let body = summaryCards(transactions);

    body += await safeSection("Transaction List", () =>
      transactionTable(transactions)
    );

    body += await safeSection("Receipts", () => receiptsTable(transactions));

    body += await safeSection("Funding / Sponsor Breakdown", async () => {
      const sponsors = await getSponsors();
      return sponsorTable(sponsors, transactions);
    });

    body += await safeSection("Personal Funds", () =>
      personalFundsTable(transactions)
    );

    body += await safeSection("Audit Logs", async () => {
      const logs = await getAuditLogs(year);
      return auditLogsTable(logs);
    });

    body += await safeSection("CSV Import History", async () => {
      const result = await tryGetCsvImportHistory(year);
      return csvImportTable(result);
    });

    body += await safeSection("Bank Balance Checks", async () => {
      const result = await tryGetBankBalanceChecks(year);
      return bankBalanceTable(result);
    });

    return body;
  }

  if (report === "yearly-report") {
    return `
      ${summaryCards(transactions)}
      ${await safeSection("Transactions Included In Yearly Report", () =>
        transactionTable(transactions)
      )}
    `;
  }

  if (report === "transaction-list") {
    return `
      ${summaryCards(transactions)}
      ${await safeSection("Transaction List", () =>
        transactionTable(transactions)
      )}
    `;
  }

  if (report === "receipts") {
    return `
      ${summaryCards(transactions)}
      ${await safeSection("Receipts", () => receiptsTable(transactions))}
    `;
  }

  if (report === "funding-breakdown") {
    return await safeSection("Funding / Sponsor Breakdown", async () => {
      const sponsors = await getSponsors();
      return sponsorTable(sponsors, transactions);
    });
  }

  if (report === "personal-funds") {
    return await safeSection("Personal Funds", () =>
      personalFundsTable(transactions)
    );
  }

  if (report === "audit-logs") {
    return await safeSection("Audit Logs", async () => {
      const logs = await getAuditLogs(year);
      return auditLogsTable(logs);
    });
  }

  if (report === "csv-import-history") {
    return await safeSection("CSV Import History", async () => {
      const result = await tryGetCsvImportHistory(year);
      return csvImportTable(result);
    });
  }

  if (report === "bank-balance-checks") {
    return await safeSection("Bank Balance Checks", async () => {
      const result = await tryGetBankBalanceChecks(year);
      return bankBalanceTable(result);
    });
  }

  return "";
}

export async function GET(
  req: Request,
  context: {
    params: Promise<{
      export: string;
    }>;
  }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      {
        error: "You must be signed in to print this report.",
      },
      { status: 401 }
    );
  }

  const params = await context.params;
  const exportKey = normaliseExportKey(params.export);

  const allowedReports = [
    "all",
    "accountant-pack",
    "yearly-report",
    "transaction-list",
    "receipts",
    "audit-logs",
    "funding-breakdown",
    "personal-funds",
    "csv-import-history",
    "bank-balance-checks",
  ];

  if (!allowedReports.includes(exportKey)) {
    return NextResponse.json(
      {
        error: "Unknown print report.",
        received: params.export,
        normalised: exportKey,
        allowedReports,
      },
      { status: 404 }
    );
  }

  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") || new Date().getFullYear());

  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json(
      {
        error: "Invalid year.",
      },
      { status: 400 }
    );
  }

  const title = getReportTitle(exportKey);

  try {
    const body = await buildReportBody(exportKey, year);

    return new NextResponse(
      htmlPage({
        title,
        year,
        body,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: any) {
    return new NextResponse(
      htmlPage({
        title,
        year,
        body: `
          <div class="error">
            <strong>Could not create print report.</strong><br />
            ${escapeHtml(error?.message || String(error))}
          </div>

          <div class="note">
            Check your Supabase table names and column names in:
            <strong>app/api/admin/money/export/print/[export]/route.ts</strong>
          </div>
        `,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }
}