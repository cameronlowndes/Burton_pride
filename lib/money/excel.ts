import ExcelJS from "exceljs";
import type { Transaction, SponsorBreakdown } from "@/lib/money/types";
import {
  formatDate,
  isPersonalFundsTransaction,
  isSponsorshipTransaction,
  money,
  monthNameFromKey,
  pounds,
  sourceLabel,
} from "@/lib/money/utils";

async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();

  const blob = new Blob([buffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function styleHeaderRow(row: ExcelJS.Row, argb = "FF111827") {
  row.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb },
    };

    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };

    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });

  row.height = 24;
}

function styleBodyRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.alignment = {
      vertical: "top",
      wrapText: true,
    };

    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  });
}

function styleCurrencyCell(cell: ExcelJS.Cell, bold = false) {
  cell.numFmt = "£#,##0.00;[Red]-£#,##0.00";
  cell.font = { bold };
  cell.alignment = {
    horizontal: "right",
    vertical: "top",
  };
}

function addMergedTitle(
  worksheet: ExcelJS.Worksheet,
  text: string,
  fromCell: string,
  toCell: string
) {
  worksheet.mergeCells(`${fromCell}:${toCell}`);

  const cell = worksheet.getCell(fromCell);

  cell.value = text;
  cell.font = {
    bold: true,
    size: 18,
    color: { argb: "FFFFFFFF" },
  };

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF111827" },
  };

  cell.alignment = {
    horizontal: "center",
    vertical: "middle",
  };
}

function addMergedSubtitle(
  worksheet: ExcelJS.Worksheet,
  text: string,
  fromCell: string,
  toCell: string
) {
  worksheet.mergeCells(`${fromCell}:${toCell}`);

  const cell = worksheet.getCell(fromCell);

  cell.value = text;
  cell.font = {
    bold: true,
    size: 11,
    color: { argb: "FF374151" },
  };

  cell.alignment = {
    horizontal: "center",
    vertical: "middle",
  };
}

function addMergedSection(
  worksheet: ExcelJS.Worksheet,
  text: string,
  fromCell: string,
  toCell: string,
  colour = "FF7C3AED"
) {
  worksheet.mergeCells(`${fromCell}:${toCell}`);

  const cell = worksheet.getCell(fromCell);

  cell.value = text;
  cell.font = {
    bold: true,
    size: 13,
    color: { argb: "FFFFFFFF" },
  };

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: colour },
  };

  cell.alignment = {
    horizontal: "left",
    vertical: "middle",
  };
}

type ExportTransactionsArgs = {
  selectedYear: string;
  selectedViewMonth: string;
  filteredTransactions: Transaction[];
};

export async function exportTransactionsToExcelFile({
  selectedYear,
  selectedViewMonth,
  filteredTransactions,
}: ExportTransactionsArgs) {
  const fileDate = new Date().toISOString().slice(0, 10);
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Burton Pride C.I.C";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Filtered Transactions", {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  sheet.columns = [
    { key: "year", width: 14 },
    { key: "date", width: 16 },
    { key: "title", width: 30 },
    { key: "description", width: 36 },
    { key: "type", width: 16 },
    { key: "payment", width: 20 },
    { key: "source", width: 22 },
    { key: "sponsor", width: 24 },
    { key: "sponsorshipNote", width: 36 },
    { key: "personalFunds", width: 16 },
    { key: "paidBy", width: 22 },
    { key: "repaymentStatus", width: 20 },
    { key: "invoice", width: 30 },
    { key: "amount", width: 16 },
  ];

  addMergedTitle(
    sheet,
    "Burton Pride C.I.C - Money Transactions Export",
    "A1",
    "N1"
  );

  addMergedSubtitle(
    sheet,
    `View: ${
      selectedViewMonth === "all"
        ? `Jan to Dec ${selectedYear}`
        : monthNameFromKey(selectedViewMonth)
    } | Exported: ${new Date().toLocaleString("en-GB")} | Rows: ${
      filteredTransactions.length
    }`,
    "A2",
    "N2"
  );

  sheet.addRow([]);

  sheet.addRow([
    "Year",
    "Date",
    "Title",
    "Description",
    "Type",
    "Payment Method",
    "Source",
    "Sponsor",
    "Sponsorship Note",
    "Personal Funds",
    "Paid By",
    "Repayment Status",
    "Invoice / Receipt",
    "Amount",
  ]);

  styleHeaderRow(sheet.getRow(4), "FF047857");

  filteredTransactions.forEach((item) => {
    const isPersonal = isPersonalFundsTransaction(item);
    const hasSponsor = isSponsorshipTransaction(item);

    const row = sheet.addRow({
      year: selectedYear,
      date: formatDate(item.transaction_date || item.created_at),
      title: item.title,
      description: item.description || "None",
      type: item.type === "income" ? "Money In" : "Money Out",
      payment: item.payment_method || "None",
      source: sourceLabel(item.source),
      sponsor: item.sponsor_name || "None",
      sponsorshipNote: item.sponsorship_note || "None",
      personalFunds: isPersonal ? "Yes" : "No",
      paidBy: item.personal_funds_name || "None",
      repaymentStatus: isPersonal
        ? item.personal_funds_repaid
          ? "Paid back"
          : "Not paid back"
        : "None",
      invoice: item.invoice_image_url || "None",
      amount: pounds(item.amount_pence),
    });

    styleBodyRow(row);
    styleCurrencyCell(row.getCell("amount"), true);

    if (item.type === "income") {
      row.getCell("type").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDCFCE7" },
      };

      row.getCell("type").font = {
        bold: true,
        color: { argb: "FF166534" },
      };
    }

    if (item.type === "expense") {
      row.getCell("type").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEE2E2" },
      };

      row.getCell("type").font = {
        bold: true,
        color: { argb: "FF991B1B" },
      };
    }

    if (isPersonal) {
      row.getCell("personalFunds").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0F2FE" },
      };

      row.getCell("personalFunds").font = {
        bold: true,
        color: { argb: "FF075985" },
      };
    }

    if (hasSponsor) {
      row.getCell("sponsor").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEF3C7" },
      };

      row.getCell("sponsor").font = {
        bold: true,
        color: { argb: "FF92400E" },
      };
    }
  });

  sheet.autoFilter = {
    from: "A4",
    to: "N4",
  };

  await downloadWorkbook(
    workbook,
    `burton-pride-money-transactions-${selectedYear}-${fileDate}.xlsx`
  );
}

type FullYearlyReportTotals = {
  openingBalance: number;
  income: number;
  expense: number;
  personalFunds: number;
  personalFundsRepaid: number;
  personalFundsOutstanding: number;
  sponsorshipIncome: number;
  sponsorshipSpent: number;
  sponsorshipRemaining: number;
  balance: number;
};

type ExportFullYearlyReportArgs = {
  selectedYear: string;
  totals: FullYearlyReportTotals;
  yearlySponsorBreakdown: SponsorBreakdown[];
  yearTransactions: Transaction[];
};

export async function exportFullYearlyReportFile({
  selectedYear,
  totals,
  yearlySponsorBreakdown,
  yearTransactions,
}: ExportFullYearlyReportArgs) {
  const fileDate = new Date().toISOString().slice(0, 10);
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Burton Pride C.I.C";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("Year Summary", {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  summarySheet.columns = [
    { key: "label", width: 36 },
    { key: "amount", width: 20 },
    { key: "notes", width: 60 },
  ];

  addMergedTitle(
    summarySheet,
    "Burton Pride C.I.C - Full Yearly Money Report",
    "A1",
    "C1"
  );

  addMergedSubtitle(
    summarySheet,
    `Year: Jan to Dec ${selectedYear} | Generated: ${new Date().toLocaleString(
      "en-GB"
    )}`,
    "A2",
    "C2"
  );

  summarySheet.addRow([]);
  addMergedSection(summarySheet, "Year Summary", "A4", "C4", "FF7C3AED");

  const summaryHeader = summarySheet.addRow(["Item", "Amount", "Notes"]);
  styleHeaderRow(summaryHeader, "FF111827");

  const summaryRows: Array<[string, number, string]> = [
    [
      "Opening Balance",
      pounds(totals.openingBalance || 0),
      "Money carried forward from previous years.",
    ],
    ["Money In", pounds(totals.income), "All income in the selected year."],
    [
      "Money Out",
      pounds(totals.expense),
      "Burton Pride money out, including personal funds only once marked paid back.",
    ],
    [
      "Personal Funds Paid",
      pounds(totals.personalFunds),
      "Money paid personally by people on behalf of Burton Pride.",
    ],
    [
      "Personal Funds Paid Back",
      pounds(totals.personalFundsRepaid),
      "Personal funds marked as paid back.",
    ],
    [
      "Personal Funds Still Owed",
      pounds(totals.personalFundsOutstanding),
      "Personal funds not yet paid back.",
    ],
    [
      "Sponsorship Money Received",
      pounds(totals.sponsorshipIncome),
      "Sponsor money received or carried forward.",
    ],
    [
      "Sponsorship Money Spent",
      pounds(totals.sponsorshipSpent),
      "Spending linked to sponsors.",
    ],
    [
      "Sponsorship Money Left",
      pounds(totals.sponsorshipRemaining),
      "Sponsor money remaining after sponsor spending.",
    ],
    [
      "Closing Balance",
      pounds(totals.balance),
      "Opening balance plus income minus eligible expenses.",
    ],
  ];

  summaryRows.forEach(([label, amount, notes]) => {
    const row = summarySheet.addRow([label, amount, notes]);
    styleBodyRow(row);
    row.getCell(1).font = { bold: true };
    styleCurrencyCell(row.getCell(2), true);
  });

  const sponsorSheet = workbook.addWorksheet("Sponsorship Breakdown", {
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  sponsorSheet.columns = [
    { key: "sponsor", width: 30 },
    { key: "contact", width: 24 },
    { key: "email", width: 30 },
    { key: "phone", width: 18 },
    { key: "agreed", width: 16 },
    { key: "received", width: 16 },
    { key: "spent", width: 16 },
    { key: "remaining", width: 16 },
    { key: "carriedForward", width: 18 },
    { key: "notes", width: 45 },
  ];

  addMergedTitle(
    sponsorSheet,
    "Burton Pride C.I.C - Sponsorship Breakdown",
    "A1",
    "J1"
  );

  addMergedSubtitle(sponsorSheet, `Year: Jan to Dec ${selectedYear}`, "A2", "J2");

  sponsorSheet.addRow([]);

  const sponsorHeader = sponsorSheet.addRow([
    "Sponsor",
    "Contact",
    "Email",
    "Phone",
    "Agreed",
    "Received",
    "Spent",
    "Remaining",
    "Carried Forward",
    "Notes",
  ]);

  styleHeaderRow(sponsorHeader, "FF92400E");

  if (yearlySponsorBreakdown.length === 0) {
    const row = sponsorSheet.addRow([`No sponsors added for ${selectedYear}`]);
    styleBodyRow(row);
  } else {
    yearlySponsorBreakdown.forEach((sponsor) => {
      const row = sponsorSheet.addRow({
        sponsor: sponsor.sponsor_name,
        contact: sponsor.contact_name || "None",
        email: sponsor.email || "None",
        phone: sponsor.phone || "None",
        agreed: pounds(sponsor.agreed_amount_pence),
        received: pounds(sponsor.received_pence),
        spent: pounds(sponsor.spent_pence),
        remaining: pounds(sponsor.remaining_pence),
        carriedForward: pounds(sponsor.carried_forward_pence || 0),
        notes: sponsor.notes || "None",
      });

      styleBodyRow(row);

      styleCurrencyCell(row.getCell("agreed"), true);
      styleCurrencyCell(row.getCell("received"), true);
      styleCurrencyCell(row.getCell("spent"), true);
      styleCurrencyCell(row.getCell("remaining"), true);
      styleCurrencyCell(row.getCell("carriedForward"), true);

      row.getCell("received").font = {
        bold: true,
        color: { argb: "FF166534" },
      };

      row.getCell("spent").font = {
        bold: true,
        color: { argb: "FF991B1B" },
      };

      row.getCell("remaining").font = {
        bold: true,
        color: { argb: "FF92400E" },
      };
    });
  }

  sponsorSheet.autoFilter = {
    from: "A4",
    to: "J4",
  };

  const transactionSheet = workbook.addWorksheet("All Transactions", {
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  transactionSheet.columns = [
    { key: "year", width: 14 },
    { key: "date", width: 16 },
    { key: "title", width: 30 },
    { key: "description", width: 36 },
    { key: "type", width: 16 },
    { key: "payment", width: 20 },
    { key: "source", width: 22 },
    { key: "sponsor", width: 24 },
    { key: "sponsorshipNote", width: 36 },
    { key: "personalFunds", width: 16 },
    { key: "paidBy", width: 22 },
    { key: "repaymentStatus", width: 20 },
    { key: "invoice", width: 30 },
    { key: "amount", width: 16 },
  ];

  addMergedTitle(
    transactionSheet,
    "Burton Pride C.I.C - All Transactions",
    "A1",
    "N1"
  );

  addMergedSubtitle(
    transactionSheet,
    `Year: Jan to Dec ${selectedYear} | Rows: ${yearTransactions.length}`,
    "A2",
    "N2"
  );

  transactionSheet.addRow([]);

  const transactionHeader = transactionSheet.addRow([
    "Year",
    "Date",
    "Title",
    "Description",
    "Type",
    "Payment Method",
    "Source",
    "Sponsor",
    "Sponsorship Note",
    "Personal Funds",
    "Paid By",
    "Repayment Status",
    "Invoice / Receipt",
    "Amount",
  ]);

  styleHeaderRow(transactionHeader, "FF047857");

  if (yearTransactions.length === 0) {
    const row = transactionSheet.addRow([
      `No transactions saved for ${selectedYear}`,
    ]);
    styleBodyRow(row);
  } else {
    yearTransactions.forEach((item) => {
      const isPersonal = isPersonalFundsTransaction(item);
      const hasSponsor = isSponsorshipTransaction(item);

      const row = transactionSheet.addRow({
        year: selectedYear,
        date: formatDate(item.transaction_date || item.created_at),
        title: item.title,
        description: item.description || "None",
        type: item.type === "income" ? "Money In" : "Money Out",
        payment: item.payment_method || "None",
        source: sourceLabel(item.source),
        sponsor: item.sponsor_name || "None",
        sponsorshipNote: item.sponsorship_note || "None",
        personalFunds: isPersonal ? "Yes" : "No",
        paidBy: item.personal_funds_name || "None",
        repaymentStatus: isPersonal
          ? item.personal_funds_repaid
            ? "Paid back"
            : "Not paid back"
          : "None",
        invoice: item.invoice_image_url || "None",
        amount: pounds(item.amount_pence),
      });

      styleBodyRow(row);
      styleCurrencyCell(row.getCell("amount"), true);

      if (item.type === "income") {
        row.getCell("type").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDCFCE7" },
        };

        row.getCell("type").font = {
          bold: true,
          color: { argb: "FF166534" },
        };
      }

      if (item.type === "expense") {
        row.getCell("type").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFEE2E2" },
        };

        row.getCell("type").font = {
          bold: true,
          color: { argb: "FF991B1B" },
        };
      }

      if (hasSponsor) {
        row.getCell("sponsor").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFEF3C7" },
        };

        row.getCell("sponsor").font = {
          bold: true,
          color: { argb: "FF92400E" },
        };
      }

      if (isPersonal) {
        row.getCell("personalFunds").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0F2FE" },
        };

        row.getCell("personalFunds").font = {
          bold: true,
          color: { argb: "FF075985" },
        };
      }
    });
  }

  transactionSheet.autoFilter = {
    from: "A4",
    to: "N4",
  };

  await downloadWorkbook(
    workbook,
    `burton-pride-full-yearly-report-${selectedYear}-${fileDate}.xlsx`
  );
}