import type {
  FundingType,
  SponsorBreakdown,
  Transaction,
  TransactionAttachment,
} from "@/lib/money/types";
import {
  escapeHtml,
  formatDate,
  isPersonalFundsTransaction,
  isSponsorshipTransaction,
  money,
  monthNameFromKey,
} from "@/lib/money/utils";

type PrintTotals = {
  openingBalance: number;
  sponsorshipRemaining: number;
};

type PrintFilteredTotals = {
  income: number;
  expense: number;
  personalFunds: number;
  personalFundsOutstanding: number;
  balance: number;
};

type RefundType = "money_received_back" | "money_sent_back";
type RefundStatus = "pending" | "completed" | "cancelled";

export type PrintTrackingRefund = {
  id: string;
  year: number;
  refund_date: string;
  refund_type: RefundType;
  amount_pence: number;
  title: string;
  notes?: string | null;
  reference_number?: string | null;
  supplier_id?: string | null;
  original_transaction_id?: string | null;
  status: RefundStatus;
  is_hidden?: boolean | null;
  created_at?: string | null;

  supplier?: {
    id: string;
    supplier_name: string;
  } | null;

  original_transaction?: {
    id: string;
    title: string;
    amount_pence: number;
    transaction_type: string;
    transaction_date: string;
  } | null;
};

type PrintMoneyReportArgs = {
  selectedYear: string;
  selectedPrintMonth: string;
  printTransactionsList: Transaction[];

  /**
   * Pass the active refunds loaded for the selected year.
   * The print helper filters them again by the selected print month.
   */
  printRefundsList?: PrintTrackingRefund[];

  yearlySponsorBreakdown: SponsorBreakdown[];
  totals: PrintTotals;
  filteredTotals: PrintFilteredTotals;
  onPopupBlocked: () => void;
};

function fundingTypeLabel(type?: FundingType | string | null) {
  if (type === "grant") return "Grant Money";
  if (type === "loan") return "Loan";
  if (type === "other") return "Other Funding";
  return "Sponsor";
}

function fundingBadgeClass(type?: FundingType | string | null) {
  if (type === "grant") return "grant";
  if (type === "loan") return "loan";
  if (type === "other") return "other";
  return "sponsor";
}

function bankStatusLabel(status?: string | null) {
  if (status === "matched") return "Matched";
  if (status === "needs_review") return "Needs review";
  if (status === "ignored") return "Ignored";
  return "Unmatched";
}

function bankStatusClass(status?: string | null) {
  if (status === "matched") return "matched";
  if (status === "needs_review") return "needs-review";
  if (status === "ignored") return "ignored";
  return "unmatched";
}

function financeStatusLabel(status?: string | null) {
  if (status === "waiting_for_receipt") return "Waiting for receipt";
  if (status === "ask_sponsor") return "Ask sponsor";
  if (status === "bank_query") return "Bank query";
  if (status === "resolved") return "Resolved";
  return "No query";
}

function financeStatusClass(status?: string | null) {
  if (status === "waiting_for_receipt") return "waiting";
  if (status === "ask_sponsor") return "ask-sponsor";
  if (status === "bank_query") return "bank-query";
  if (status === "resolved") return "resolved";
  return "no-query";
}

function getTransactionFiles(item: Transaction): TransactionAttachment[] {
  const attachments = item.attachments || [];

  if (attachments.length > 0) {
    return attachments;
  }

  if (item.invoice_image_url) {
    return [
      {
        id: `${item.id}-old-invoice`,
        transaction_id: item.id,
        file_name: "Old invoice / receipt",
        file_url: item.invoice_image_url,
        file_type: null,
        file_size: null,
        created_at: item.created_at,
      },
    ];
  }

  return [];
}

function receiptPrintHtml(item: Transaction) {
  const files = getTransactionFiles(item);

  if (files.length > 0) {
    return `
      <div class="receipt-box attached">
        <strong>Receipt / proof attached</strong>
        <div class="muted">${escapeHtml(String(files.length))} file${
          files.length === 1 ? "" : "s"
        } attached</div>
      </div>
    `;
  }

  if (item.type === "expense") {
    return `
      <div class="receipt-box missing">
        <strong>Missing receipt / proof</strong>
        <div class="muted">No receipt, invoice, or proof file attached.</div>
      </div>
    `;
  }

  return `<span class="muted">No file attached</span>`;
}

function filesPrintHtml(item: Transaction) {
  const files = getTransactionFiles(item);

  if (files.length === 0) {
    return "None";
  }

  return `
    <div class="files-list">
      ${files
        .map((file, index) => {
          const fileName = file.file_name || `Attachment ${index + 1}`;

          return `
            <div class="file-item">
              <strong>${escapeHtml(String(index + 1))}. ${escapeHtml(
                fileName
              )}</strong>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function checkedPrintHtml(item: Transaction) {
  if (!item.checked_at) {
    return `<span class="checked-status not-checked">Not checked</span>`;
  }

  return `
    <div class="checked-box">
      <span class="checked-status checked">Checked</span>
      <div class="muted">By: ${escapeHtml(item.checked_by || "Unknown admin")}</div>
      <div class="muted">At: ${escapeHtml(formatDate(item.checked_at))}</div>
    </div>
  `;
}

function bankPrintHtml(item: Transaction) {
  const status = item.bank_reconciliation_status || "unmatched";

  return `
    <div class="status-box">
      <span class="bank-status ${bankStatusClass(status)}">${escapeHtml(
        bankStatusLabel(status)
      )}</span>

      ${
        item.bank_reconciliation_note
          ? `<div class="muted">${escapeHtml(item.bank_reconciliation_note)}</div>`
          : ""
      }

      ${
        item.bank_reconciled_by
          ? `<div class="muted">By: ${escapeHtml(item.bank_reconciled_by)}</div>`
          : ""
      }

      ${
        item.bank_reconciled_at
          ? `<div class="muted">At: ${escapeHtml(
              formatDate(item.bank_reconciled_at)
            )}</div>`
          : ""
      }
    </div>
  `;
}

function financePrintHtml(item: Transaction) {
  const status = item.finance_note_status || "none";

  return `
    <div class="status-box">
      <span class="finance-status ${financeStatusClass(status)}">${escapeHtml(
        financeStatusLabel(status)
      )}</span>

      ${
        item.finance_note
          ? `<div class="muted">${escapeHtml(item.finance_note)}</div>`
          : ""
      }

      ${
        item.finance_note_updated_by
          ? `<div class="muted">By: ${escapeHtml(
              item.finance_note_updated_by
            )}</div>`
          : ""
      }

      ${
        item.finance_note_updated_at
          ? `<div class="muted">At: ${escapeHtml(
              formatDate(item.finance_note_updated_at)
            )}</div>`
          : ""
      }
    </div>
  `;
}

function refundReference(refund: PrintTrackingRefund) {
  const suppliedReference = String(refund.reference_number || "").trim();

  if (suppliedReference) {
    return suppliedReference;
  }

  return `REFUND-${refund.year}-${String(refund.id || "")
    .slice(0, 8)
    .toUpperCase()}`;
}

function refundTypeLabel(refund: PrintTrackingRefund) {
  return refund.refund_type === "money_received_back"
    ? "Refund Received Back"
    : "Refund Sent Back";
}

function refundTypeBadgeClass(refund: PrintTrackingRefund) {
  return refund.refund_type === "money_received_back"
    ? "refund-received"
    : "refund-sent";
}

function refundStatusLabel(status: RefundStatus) {
  if (status === "completed") return "Completed";
  if (status === "pending") return "Pending";
  return "Cancelled";
}

function refundStatusBadgeClass(status: RefundStatus) {
  if (status === "completed") return "refund-completed";
  if (status === "pending") return "refund-pending";
  return "refund-cancelled";
}

function refundMonthKey(refund: PrintTrackingRefund) {
  return String(refund.refund_date || refund.created_at || "").slice(0, 7);
}

function refundMatchesPrintScope({
  refund,
  selectedYear,
  selectedPrintMonth,
}: {
  refund: PrintTrackingRefund;
  selectedYear: string;
  selectedPrintMonth: string;
}) {
  if (refund.is_hidden) {
    return false;
  }

  if (String(refund.year) !== String(selectedYear)) {
    return false;
  }

  if (selectedPrintMonth === "all") {
    return true;
  }

  return refundMonthKey(refund) === selectedPrintMonth;
}

function completedRefundTotals(refunds: PrintTrackingRefund[]) {
  return refunds.reduce(
    (acc, refund) => {
      if (refund.status !== "completed" || refund.is_hidden) {
        return acc;
      }

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
}

function refundBalanceEffectLabel(refund: PrintTrackingRefund) {
  if (refund.status !== "completed") {
    return "No balance change until completed";
  }

  return refund.refund_type === "money_received_back"
    ? "Added into Money In"
    : "Added into Money Out";
}

export function printMoneyReport({
  selectedYear,
  selectedPrintMonth,
  printTransactionsList,
  printRefundsList = [],
  yearlySponsorBreakdown,
  totals,
  filteredTotals,
  onPopupBlocked,
}: PrintMoneyReportArgs) {
  const printedAt = new Date().toLocaleString("en-GB");

  const printScopeLabel =
    selectedPrintMonth === "all"
      ? `Jan to Dec ${selectedYear}`
      : monthNameFromKey(selectedPrintMonth);

  const scopedRefunds = printRefundsList.filter((refund) =>
    refundMatchesPrintScope({
      refund,
      selectedYear,
      selectedPrintMonth,
    })
  );

  const refundTotals = completedRefundTotals(scopedRefunds);

  const moneyInIncludingRefunds =
    Number(filteredTotals.income || 0) + refundTotals.receivedBack;

  const moneyOutIncludingRefunds =
    Number(filteredTotals.expense || 0) + refundTotals.sentBack;

  const balanceIncludingRefunds =
    Number(filteredTotals.balance || 0) +
    refundTotals.receivedBack -
    refundTotals.sentBack;

  const sponsorRows =
    yearlySponsorBreakdown.length === 0
      ? `<tr><td colspan="8" class="empty">No sponsors, grants, loans or other funding added for ${escapeHtml(
          selectedYear
        )}.</td></tr>`
      : yearlySponsorBreakdown
          .map((sponsor) => {
            const fundingType = sponsor.funding_type || "sponsor";

            return `
              <tr>
                <td>
                  <span class="badge ${fundingBadgeClass(fundingType)}">
                    ${escapeHtml(fundingTypeLabel(fundingType))}
                  </span>
                </td>

                <td>
                  <strong>${escapeHtml(sponsor.sponsor_name)}</strong>
                  ${
                    sponsor.notes
                      ? `<div class="muted">${escapeHtml(sponsor.notes)}</div>`
                      : ""
                  }
                  ${
                    (sponsor.carried_forward_pence || 0) > 0
                      ? `<div class="muted">Carried forward: ${escapeHtml(
                          money(sponsor.carried_forward_pence || 0)
                        )}</div>`
                      : ""
                  }
                </td>

                <td>${escapeHtml(sponsor.contact_name || "None")}</td>

                <td>${escapeHtml(sponsor.email || "None")}</td>

                <td class="amount">${escapeHtml(
                  money(sponsor.agreed_amount_pence)
                )}</td>

                <td class="amount green">${escapeHtml(
                  money(sponsor.received_pence)
                )}</td>

                <td class="amount red">${escapeHtml(
                  money(sponsor.spent_pence)
                )}</td>

                <td class="amount amber">${escapeHtml(
                  money(sponsor.remaining_pence)
                )}</td>
              </tr>
            `;
          })
          .join("");

  const transactionRows =
    printTransactionsList.length === 0
      ? `<tr><td colspan="16" class="empty">No ordinary transactions to print for ${escapeHtml(
          printScopeLabel
        )}.</td></tr>`
      : printTransactionsList
          .map((item) => {
            const isIncome = item.type === "income";
            const isPersonal = isPersonalFundsTransaction(item);
            const hasFunding = isSponsorshipTransaction(item);

            return `
              <tr>
                <td>
                  <span class="reference">
                    ${escapeHtml(item.transaction_reference || "Pending")}
                  </span>
                </td>

                <td>${escapeHtml(formatDate(item.transaction_date))}</td>

                <td>
                  <strong>${escapeHtml(item.title)}</strong>
                </td>

                <td>
                  <span class="badge ${isIncome ? "income" : "expense"}">
                    ${escapeHtml(isIncome ? "Money In" : "Money Out")}
                  </span>
                </td>

                <td>
                  <strong class="amount">${escapeHtml(
                    money(item.amount_pence)
                  )}</strong>
                </td>

                <td>
                  ${
                    hasFunding
                      ? `<span class="badge sponsor">${escapeHtml(
                          item.sponsor_name || "Funding record"
                        )}</span>`
                      : "None"
                  }
                </td>

                <td>${escapeHtml(item.sponsorship_note || "None")}</td>

                <td>${isPersonal ? "Personal funds" : "None"}</td>

                <td>${escapeHtml(item.personal_funds_name || "None")}</td>

                <td>${
                  isPersonal
                    ? item.personal_funds_repaid
                      ? "Paid back"
                      : "Not paid back"
                    : "None"
                }</td>

                <td>${escapeHtml(
                  hasFunding ? "Funding Money" : item.payment_method || "None"
                )}</td>

                <td>${bankPrintHtml(item)}</td>

                <td>${receiptPrintHtml(item)}</td>

                <td>${financePrintHtml(item)}</td>

                <td>${checkedPrintHtml(item)}</td>

                <td>${filesPrintHtml(item)}</td>
              </tr>
            `;
          })
          .join("");

  const refundRows =
    scopedRefunds.length === 0
      ? `<tr><td colspan="10" class="empty">No refunds to print for ${escapeHtml(
          printScopeLabel
        )}.</td></tr>`
      : scopedRefunds
          .map((refund) => {
            return `
              <tr>
                <td>
                  <span class="reference refund-reference">
                    ${escapeHtml(refundReference(refund))}
                  </span>
                </td>

                <td>${escapeHtml(formatDate(refund.refund_date))}</td>

                <td>
                  <strong>${escapeHtml(refund.title)}</strong>
                  ${
                    refund.notes
                      ? `<div class="muted">${escapeHtml(refund.notes)}</div>`
                      : ""
                  }
                </td>

                <td>
                  <span class="badge ${refundTypeBadgeClass(refund)}">
                    ${escapeHtml(refundTypeLabel(refund))}
                  </span>
                </td>

                <td class="amount">
                  <strong>${escapeHtml(money(refund.amount_pence))}</strong>
                </td>

                <td>
                  <span class="badge ${refundStatusBadgeClass(refund.status)}">
                    ${escapeHtml(refundStatusLabel(refund.status))}
                  </span>
                </td>

                <td>${escapeHtml(
                  refund.supplier?.supplier_name || "None"
                )}</td>

                <td>${escapeHtml(
                  refund.original_transaction?.title || "Not linked"
                )}</td>

                <td>${escapeHtml(
                  refund.reference_number || "None"
                )}</td>

                <td>
                  <strong>${escapeHtml(refundBalanceEffectLabel(refund))}</strong>
                </td>
              </tr>
            `;
          })
          .join("");

  const printHtml = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Burton Pride Money Tracker Report ${escapeHtml(
          printScopeLabel
        )}</title>

        <style>
          body {
            margin: 0;
            padding: 24px;
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            background: #ffffff;
          }

          .header {
            background: #07111f;
            color: #ffffff;
            padding: 18px 20px;
            border-radius: 14px 14px 0 0;
            text-align: center;
          }

          .header h1 {
            margin: 0;
            font-size: 26px;
          }

          .header p {
            margin: 6px 0 0;
            font-size: 13px;
            color: #e5e7eb;
          }

          .meta {
            background: #374151;
            color: #e5e7eb;
            padding: 10px 16px;
            text-align: center;
            font-size: 12px;
            border-radius: 0 0 14px 14px;
          }

          .summary {
            display: grid;
            grid-template-columns: repeat(9, minmax(0, 1fr));
            gap: 8px;
            margin: 18px 0;
          }

          .card {
            border: 1px solid #d1d5db;
            border-radius: 12px;
            padding: 10px;
          }

          .card span {
            display: block;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 6px;
          }

          .card strong {
            font-size: 15px;
          }

          .card small {
            display: block;
            margin-top: 5px;
            font-size: 8px;
            line-height: 1.35;
          }

          .opening-card {
            background: #f3e8ff;
            color: #6b21a8;
          }

          .income-card {
            background: #dcfce7;
            color: #166534;
          }

          .expense-card {
            background: #fee2e2;
            color: #991b1b;
          }

          .personal-card {
            background: #e0f2fe;
            color: #075985;
          }

          .owed-card {
            background: #ffedd5;
            color: #9a3412;
          }

          .funding-card {
            background: #fef3c7;
            color: #92400e;
          }

          .balance-card {
            background: #dbeafe;
            color: #1e40af;
          }

          .refund-received-card {
            background: #cffafe;
            color: #155e75;
          }

          .refund-sent-card {
            background: #f3e8ff;
            color: #6b21a8;
          }

          h2 {
            margin: 22px 0 10px;
            font-size: 17px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 18px;
            font-size: 9.2px;
          }

          th {
            background: #07111f;
            color: #ffffff;
            text-align: left;
            padding: 7px;
            border: 1px solid #07111f;
            font-size: 8.8px;
          }

          td {
            padding: 7px;
            border: 1px solid #d1d5db;
            vertical-align: top;
          }

          tr:nth-child(even) td {
            background: #f9fafb;
          }

          .amount {
            text-align: right;
            white-space: nowrap;
            font-weight: 800;
          }

          .green {
            color: #166534;
          }

          .red {
            color: #991b1b;
          }

          .amber {
            color: #92400e;
          }

          .reference {
            display: inline-block;
            border-radius: 8px;
            background: #eef2ff;
            color: #3730a3;
            padding: 4px 7px;
            font-size: 9px;
            font-weight: 900;
            white-space: nowrap;
          }

          .refund-reference {
            background: #cffafe;
            color: #155e75;
          }

          .badge {
            display: inline-block;
            border-radius: 999px;
            padding: 4px 8px;
            font-size: 9px;
            font-weight: 800;
            white-space: nowrap;
          }

          .badge.income {
            background: #dcfce7;
            color: #166534;
          }

          .badge.expense {
            background: #fee2e2;
            color: #991b1b;
          }

          .badge.sponsor {
            background: #fef3c7;
            color: #92400e;
          }

          .badge.grant {
            background: #dcfce7;
            color: #166534;
          }

          .badge.loan {
            background: #dbeafe;
            color: #1e40af;
          }

          .badge.other {
            background: #f3e8ff;
            color: #6b21a8;
          }

          .badge.refund-received {
            background: #cffafe;
            color: #155e75;
          }

          .badge.refund-sent {
            background: #f3e8ff;
            color: #6b21a8;
          }

          .badge.refund-completed {
            background: #dcfce7;
            color: #166534;
          }

          .badge.refund-pending {
            background: #fef3c7;
            color: #92400e;
          }

          .badge.refund-cancelled {
            background: #f3f4f6;
            color: #6b7280;
          }

          .status-box,
          .checked-box {
            display: grid;
            gap: 3px;
          }

          .checked-status,
          .bank-status,
          .finance-status {
            display: inline-block;
            border-radius: 999px;
            padding: 4px 8px;
            font-size: 9px;
            font-weight: 900;
            white-space: nowrap;
          }

          .checked-status.checked,
          .bank-status.matched,
          .finance-status.resolved {
            background: #dcfce7;
            color: #166534;
          }

          .checked-status.not-checked,
          .bank-status.unmatched,
          .finance-status.no-query {
            background: #f3f4f6;
            color: #6b7280;
          }

          .bank-status.needs-review,
          .finance-status.waiting,
          .finance-status.ask-sponsor {
            background: #fef3c7;
            color: #92400e;
          }

          .bank-status.ignored {
            background: #dbeafe;
            color: #1e40af;
          }

          .finance-status.bank-query {
            background: #fee2e2;
            color: #991b1b;
          }

          .receipt-box {
            border-radius: 9px;
            padding: 6px;
            border: 1px solid #d1d5db;
          }

          .receipt-box.attached {
            background: #dcfce7;
            color: #166534;
            border-color: #bbf7d0;
          }

          .receipt-box.missing {
            background: #fee2e2;
            color: #991b1b;
            border-color: #fecaca;
          }

          .muted {
            margin-top: 4px;
            color: #6b7280;
            font-size: 8.8px;
            white-space: pre-wrap;
          }

          .files-list {
            display: grid;
            gap: 6px;
          }

          .file-item {
            border-radius: 8px;
            background: #eff6ff;
            color: #1e3a8a;
            padding: 6px;
            border: 1px solid #bfdbfe;
            word-break: break-word;
          }

          .empty {
            text-align: center;
            color: #6b7280;
            padding: 18px;
          }

          .footer {
            margin-top: 18px;
            padding-top: 12px;
            border-top: 1px solid #d1d5db;
            text-align: center;
            font-size: 10px;
            color: #6b7280;
          }

          @media print {
            body {
              padding: 10mm;
            }

            @page {
              size: A4 landscape;
              margin: 7mm;
            }

            thead {
              display: table-header-group;
            }

            tr {
              page-break-inside: avoid;
            }

            h2 {
              page-break-after: avoid;
            }
          }
        </style>
      </head>

      <body>
        <div class="header">
          <h1>Burton Pride Money Tracker</h1>
          <p>Money report for Burton Pride C.I.C</p>
        </div>

        <div class="meta">
          Report period: ${escapeHtml(printScopeLabel)} • Printed on ${escapeHtml(
            printedAt
          )} • Ordinary transactions: ${printTransactionsList.length} • Refunds: ${
            scopedRefunds.length
          }
        </div>

        <div class="summary">
          <div class="card opening-card">
            <span>Opening Balance</span>
            <strong>${escapeHtml(money(totals.openingBalance || 0))}</strong>
          </div>

          <div class="card income-card">
            <span>Money In</span>
            <strong>${escapeHtml(money(moneyInIncludingRefunds))}</strong>
            <small>Includes completed refunds received back</small>
          </div>

          <div class="card expense-card">
            <span>Money Out</span>
            <strong>${escapeHtml(money(moneyOutIncludingRefunds))}</strong>
            <small>Includes completed refunds sent back</small>
          </div>

          <div class="card refund-received-card">
            <span>Refunds Received Back</span>
            <strong>${escapeHtml(money(refundTotals.receivedBack))}</strong>
            <small>Added into Money In when completed</small>
          </div>

          <div class="card refund-sent-card">
            <span>Refunds Sent Back</span>
            <strong>${escapeHtml(money(refundTotals.sentBack))}</strong>
            <small>Added into Money Out when completed</small>
          </div>

          <div class="card personal-card">
            <span>Personal Funds</span>
            <strong>${escapeHtml(money(filteredTotals.personalFunds))}</strong>
          </div>

          <div class="card owed-card">
            <span>Still Owed</span>
            <strong>${escapeHtml(
              money(filteredTotals.personalFundsOutstanding)
            )}</strong>
          </div>

          <div class="card funding-card">
            <span>Funding Left</span>
            <strong>${escapeHtml(money(totals.sponsorshipRemaining))}</strong>
          </div>

          <div class="card balance-card">
            <span>Available Balance</span>
            <strong>${escapeHtml(money(balanceIncludingRefunds))}</strong>
            <small>Includes completed refund adjustments</small>
          </div>
        </div>

        <h2>Funding Breakdown — ${escapeHtml(selectedYear)}</h2>

        <table>
          <thead>
            <tr>
              <th>Funding Type</th>
              <th>Funding Record</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Agreed / Awarded</th>
              <th>Received</th>
              <th>Spent</th>
              <th>Remaining</th>
            </tr>
          </thead>

          <tbody>${sponsorRows}</tbody>
        </table>

        <h2>Ordinary Transactions — ${escapeHtml(printScopeLabel)}</h2>

        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Date</th>
              <th>Title</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Funding</th>
              <th>Funding Note</th>
              <th>Personal</th>
              <th>Paid By</th>
              <th>Repayment</th>
              <th>Payment</th>
              <th>Bank Match</th>
              <th>Receipt</th>
              <th>Finance Query</th>
              <th>Checked</th>
              <th>Files</th>
            </tr>
          </thead>

          <tbody>${transactionRows}</tbody>
        </table>

        <h2>Refunds — ${escapeHtml(printScopeLabel)}</h2>

        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Date</th>
              <th>Title</th>
              <th>Refund Type</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Supplier</th>
              <th>Original Transaction</th>
              <th>Entered Reference</th>
              <th>Balance Effect</th>
            </tr>
          </thead>

          <tbody>${refundRows}</tbody>
        </table>

        <div class="footer">
          Burton Pride Money Management App • Completed refunds received back are added into Money In • Completed refunds sent back are added into Money Out
        </div>

        <script>
          window.onload = function () {
            window.focus();
            setTimeout(function () {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "width=1400,height=900");

  if (!printWindow) {
    onPopupBlocked();
    return;
  }

  printWindow.document.open();
  printWindow.document.write(printHtml);
  printWindow.document.close();
}
