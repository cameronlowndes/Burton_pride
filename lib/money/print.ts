import type { Transaction, SponsorBreakdown } from "@/lib/money/types";
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

type PrintMoneyReportArgs = {
  selectedYear: string;
  selectedPrintMonth: string;
  printTransactionsList: Transaction[];
  yearlySponsorBreakdown: SponsorBreakdown[];
  totals: PrintTotals;
  filteredTotals: PrintFilteredTotals;
  onPopupBlocked: () => void;
};

export function printMoneyReport({
  selectedYear,
  selectedPrintMonth,
  printTransactionsList,
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

  const sponsorRows =
    yearlySponsorBreakdown.length === 0
      ? `<tr><td colspan="7" class="empty">No sponsors added for ${escapeHtml(
          selectedYear
        )}.</td></tr>`
      : yearlySponsorBreakdown
          .map(
            (sponsor) => `
              <tr>
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
            `
          )
          .join("");

  const transactionRows =
    printTransactionsList.length === 0
      ? `<tr><td colspan="11" class="empty">No transactions to print for ${escapeHtml(
          printScopeLabel
        )}.</td></tr>`
      : printTransactionsList
          .map((item) => {
            const isIncome = item.type === "income";
            const isPersonal = isPersonalFundsTransaction(item);
            const hasSponsor = isSponsorshipTransaction(item);

            return `
              <tr>
                <td>${escapeHtml(formatDate(item.transaction_date))}</td>
                <td>
                  <strong>${escapeHtml(item.title)}</strong>
                  ${
                    item.description
                      ? `<div class="muted">${escapeHtml(
                          item.description
                        )}</div>`
                      : ""
                  }
                </td>
                <td>
                  <span class="badge ${isIncome ? "income" : "expense"}">
                    ${escapeHtml(isIncome ? "Money In" : "Money Out")}
                  </span>
                </td>
                <td>
                  ${
                    hasSponsor
                      ? `<span class="badge sponsor">${escapeHtml(
                          item.sponsor_name || "Sponsor"
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
                <td>${escapeHtml(item.payment_method || "None")}</td>
                <td>${escapeHtml(item.invoice_image_url ? "Yes" : "None")}</td>
                <td class="amount">${escapeHtml(money(item.amount_pence))}</td>
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
            grid-template-columns: repeat(7, 1fr);
            gap: 10px;
            margin: 18px 0;
          }

          .card {
            border: 1px solid #d1d5db;
            border-radius: 12px;
            padding: 12px;
          }

          .card span {
            display: block;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 6px;
          }

          .card strong {
            font-size: 16px;
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

          .sponsor-card {
            background: #fef3c7;
            color: #92400e;
          }

          .balance-card {
            background: #dbeafe;
            color: #1e40af;
          }

          h2 {
            margin: 22px 0 10px;
            font-size: 17px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 18px;
            font-size: 10.5px;
          }

          th {
            background: #07111f;
            color: #ffffff;
            text-align: left;
            padding: 8px;
            border: 1px solid #07111f;
            font-size: 9.5px;
          }

          td {
            padding: 8px;
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

          .badge {
            display: inline-block;
            border-radius: 999px;
            padding: 4px 8px;
            font-size: 9.5px;
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

          .muted {
            margin-top: 4px;
            color: #6b7280;
            font-size: 9.5px;
            white-space: pre-wrap;
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
              margin: 10mm;
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
  )} • Rows: ${printTransactionsList.length}
        </div>

        <div class="summary">
          <div class="card opening-card">
            <span>Opening Balance</span>
            <strong>${escapeHtml(money(totals.openingBalance || 0))}</strong>
          </div>

          <div class="card income-card">
            <span>Money In</span>
            <strong>${escapeHtml(money(filteredTotals.income))}</strong>
          </div>

          <div class="card expense-card">
            <span>Money Out</span>
            <strong>${escapeHtml(money(filteredTotals.expense))}</strong>
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

          <div class="card sponsor-card">
            <span>Sponsorship Left</span>
            <strong>${escapeHtml(money(totals.sponsorshipRemaining))}</strong>
          </div>

          <div class="card balance-card">
            <span>Balance</span>
            <strong>${escapeHtml(money(filteredTotals.balance))}</strong>
          </div>
        </div>

        <h2>Sponsorship Breakdown — ${escapeHtml(selectedYear)}</h2>

        <table>
          <thead>
            <tr>
              <th>Sponsor</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Agreed</th>
              <th>Received</th>
              <th>Spent</th>
              <th>Remaining</th>
            </tr>
          </thead>
          <tbody>${sponsorRows}</tbody>
        </table>

        <h2>Transactions — ${escapeHtml(printScopeLabel)}</h2>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Title / Notes</th>
              <th>Type</th>
              <th>Sponsor</th>
              <th>Sponsorship Note</th>
              <th>Personal</th>
              <th>Paid By</th>
              <th>Repayment</th>
              <th>Payment</th>
              <th>Invoice</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>${transactionRows}</tbody>
        </table>

        <div class="footer">Burton Pride Money Management App</div>

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

  const printWindow = window.open("", "_blank", "width=1200,height=800");

  if (!printWindow) {
    onPopupBlocked();
    return;
  }

  printWindow.document.open();
  printWindow.document.write(printHtml);
  printWindow.document.close();
}