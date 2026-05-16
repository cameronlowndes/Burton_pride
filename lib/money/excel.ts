import ExcelJS from "exceljs";
import type {
  FundingType,
  SponsorBreakdown,
  Transaction,
  TransactionAttachment,
} from "@/lib/money/types";
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

function fundingTypeLabel(type?: FundingType | string | null) {
  if (type === "grant") return "Grant Money";
  if (type === "loan") return "Loan";
  if (type === "other") return "Other Funding";
  return "Sponsor";
}

function fundingSourceLabel(item: Transaction) {
  if (!isSponsorshipTransaction(item)) {
    return sourceLabel(item.source);
  }

  return "Funding";
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

function filesSummary(item: Transaction) {
  const files = getTransactionFiles(item);

  if (files.length === 0) {
    return "None";
  }

  return files
    .map((file, index) => {
      const name = file.file_name || `Attachment ${index + 1}`;
      return `${index + 1}. ${name}: ${file.file_url}`;
    })
    .join("\n");
}

function checkedStatus(item: Transaction) {
  return item.checked_at ? "Checked" : "Not checked";
}

function checkedBy(item: Transaction) {
  return item.checked_by || "None";
}

function checkedAt(item: Transaction) {
  return item.checked_at ? formatDate(item.checked_at) : "None";
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
    { key: "reference", width: 18 },
    { key: "year", width: 14 },
    { key: "date", width: 16 },
    { key: "title", width: 30 },
    { key: "description", width: 36 },
    { key: "type", width: 16 },
    { key: "amount", width: 16 },
    { key: "payment", width: 20 },
    { key: "source", width: 22 },
    { key: "funding", width: 28 },
    { key: "fundingNote", width: 36 },
    { key: "personalFunds", width: 16 },
    { key: "paidBy", width: 22 },
    { key: "repaymentStatus", width: 20 },
    { key: "checkedStatus", width: 18 },
    { key: "checkedBy", width: 28 },
    { key: "checkedAt", width: 20 },
    { key: "files", width: 55 },
  ];

  addMergedTitle(
    sheet,
    "Burton Pride C.I.C - Money Transactions Export",
    "A1",
    "R1"
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
    "R2"
  );

  sheet.addRow([]);

  sheet.addRow([
    "Reference",
    "Year",
    "Date",
    "Title",
    "Description",
    "Type",
    "Amount",
    "Payment Method",
    "Source",
    "Funding Record",
    "Funding Note",
    "Personal Funds",
    "Paid By",
    "Repayment Status",
    "Checked Status",
    "Checked By",
    "Checked At",
    "Files / Attachments",
  ]);

  styleHeaderRow(sheet.getRow(4), "FF047857");

  filteredTransactions.forEach((item) => {
    const isPersonal = isPersonalFundsTransaction(item);
    const hasFunding = isSponsorshipTransaction(item);

    const row = sheet.addRow({
      reference: item.transaction_reference || "Pending",
      year: selectedYear,
      date: formatDate(item.transaction_date || item.created_at),
      title: item.title,
      description: item.description || "None",
      type: item.type === "income" ? "Money In" : "Money Out",
      amount: pounds(item.amount_pence),
      payment: hasFunding ? "Funding Money" : item.payment_method || "None",
      source: fundingSourceLabel(item),
      funding: item.sponsor_name || "None",
      fundingNote: item.sponsorship_note || "None",
      personalFunds: isPersonal ? "Yes" : "No",
      paidBy: item.personal_funds_name || "None",
      repaymentStatus: isPersonal
        ? item.personal_funds_repaid
          ? "Paid back"
          : "Not paid back"
        : "None",
      checkedStatus: checkedStatus(item),
      checkedBy: checkedBy(item),
      checkedAt: checkedAt(item),
      files: filesSummary(item),
    });

    styleBodyRow(row);
    styleCurrencyCell(row.getCell("amount"), true);

    row.getCell("reference").font = {
      bold: true,
      color: { argb: "FF111827" },
    };

    row.getCell("files").alignment = {
      vertical: "top",
      wrapText: true,
    };

    if (item.checked_at) {
      row.getCell("checkedStatus").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDCFCE7" },
      };

      row.getCell("checkedStatus").font = {
        bold: true,
        color: { argb: "FF166534" },
      };

      row.getCell("checkedBy").font = {
        bold: true,
        color: { argb: "FF166534" },
      };
    } else {
      row.getCell("checkedStatus").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" },
      };

      row.getCell("checkedStatus").font = {
        bold: true,
        color: { argb: "FF6B7280" },
      };
    }

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

    if (hasFunding) {
      row.getCell("funding").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEF3C7" },
      };

      row.getCell("funding").font = {
        bold: true,
        color: { argb: "FF92400E" },
      };
    }
  });

  sheet.autoFilter = {
    from: "A4",
    to: "R4",
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
      "Funding Money Received",
      pounds(totals.sponsorshipIncome),
      "Sponsor, grant, loan or other restricted funding received or carried forward.",
    ],
    [
      "Funding Money Spent",
      pounds(totals.sponsorshipSpent),
      "Spending linked to sponsors, grants, loans or other funding records.",
    ],
    [
      "Funding Money Left",
      pounds(totals.sponsorshipRemaining),
      "Restricted funding remaining after linked spending.",
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

  const sponsorSheet = workbook.addWorksheet("Funding Breakdown", {
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
    { key: "fundingType", width: 20 },
    { key: "funding", width: 30 },
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
    "Burton Pride C.I.C - Funding Breakdown",
    "A1",
    "K1"
  );

  addMergedSubtitle(sponsorSheet, `Year: Jan to Dec ${selectedYear}`, "A2", "K2");

  sponsorSheet.addRow([]);

  const sponsorHeader = sponsorSheet.addRow([
    "Funding Type",
    "Funding Record",
    "Contact",
    "Email",
    "Phone",
    "Agreed / Awarded",
    "Received",
    "Spent",
    "Remaining",
    "Carried Forward",
    "Notes",
  ]);

  styleHeaderRow(sponsorHeader, "FF92400E");

  if (yearlySponsorBreakdown.length === 0) {
    const row = sponsorSheet.addRow([
      `No sponsors, grants, loans or other funding added for ${selectedYear}`,
    ]);
    styleBodyRow(row);
  } else {
    yearlySponsorBreakdown.forEach((sponsor) => {
      const row = sponsorSheet.addRow({
        fundingType: fundingTypeLabel(sponsor.funding_type),
        funding: sponsor.sponsor_name,
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

      row.getCell("fundingType").font = {
        bold: true,
        color: { argb: "FF92400E" },
      };

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
    to: "K4",
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
    { key: "reference", width: 18 },
    { key: "year", width: 14 },
    { key: "date", width: 16 },
    { key: "title", width: 30 },
    { key: "description", width: 36 },
    { key: "type", width: 16 },
    { key: "amount", width: 16 },
    { key: "payment", width: 20 },
    { key: "source", width: 22 },
    { key: "funding", width: 24 },
    { key: "fundingNote", width: 36 },
    { key: "personalFunds", width: 16 },
    { key: "paidBy", width: 22 },
    { key: "repaymentStatus", width: 20 },
    { key: "checkedStatus", width: 18 },
    { key: "checkedBy", width: 28 },
    { key: "checkedAt", width: 20 },
    { key: "files", width: 55 },
  ];

  addMergedTitle(
    transactionSheet,
    "Burton Pride C.I.C - All Transactions",
    "A1",
    "R1"
  );

  addMergedSubtitle(
    transactionSheet,
    `Year: Jan to Dec ${selectedYear} | Rows: ${yearTransactions.length}`,
    "A2",
    "R2"
  );

  transactionSheet.addRow([]);

  const transactionHeader = transactionSheet.addRow([
    "Reference",
    "Year",
    "Date",
    "Title",
    "Description",
    "Type",
    "Amount",
    "Payment Method",
    "Source",
    "Funding Record",
    "Funding Note",
    "Personal Funds",
    "Paid By",
    "Repayment Status",
    "Checked Status",
    "Checked By",
    "Checked At",
    "Files / Attachments",
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
      const hasFunding = isSponsorshipTransaction(item);

      const row = transactionSheet.addRow({
        reference: item.transaction_reference || "Pending",
        year: selectedYear,
        date: formatDate(item.transaction_date || item.created_at),
        title: item.title,
        description: item.description || "None",
        type: item.type === "income" ? "Money In" : "Money Out",
        amount: pounds(item.amount_pence),
        payment: hasFunding ? "Funding Money" : item.payment_method || "None",
        source: fundingSourceLabel(item),
        funding: item.sponsor_name || "None",
        fundingNote: item.sponsorship_note || "None",
        personalFunds: isPersonal ? "Yes" : "No",
        paidBy: item.personal_funds_name || "None",
        repaymentStatus: isPersonal
          ? item.personal_funds_repaid
            ? "Paid back"
            : "Not paid back"
          : "None",
        checkedStatus: checkedStatus(item),
        checkedBy: checkedBy(item),
        checkedAt: checkedAt(item),
        files: filesSummary(item),
      });

      styleBodyRow(row);
      styleCurrencyCell(row.getCell("amount"), true);

      row.getCell("reference").font = {
        bold: true,
        color: { argb: "FF111827" },
      };

      row.getCell("files").alignment = {
        vertical: "top",
        wrapText: true,
      };

      if (item.checked_at) {
        row.getCell("checkedStatus").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDCFCE7" },
        };

        row.getCell("checkedStatus").font = {
          bold: true,
          color: { argb: "FF166534" },
        };

        row.getCell("checkedBy").font = {
          bold: true,
          color: { argb: "FF166534" },
        };
      } else {
        row.getCell("checkedStatus").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF3F4F6" },
        };

        row.getCell("checkedStatus").font = {
          bold: true,
          color: { argb: "FF6B7280" },
        };
      }

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

      if (hasFunding) {
        row.getCell("funding").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFEF3C7" },
        };

        row.getCell("funding").font = {
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
    to: "R4",
  };

  await downloadWorkbook(
    workbook,
    `burton-pride-full-yearly-report-${selectedYear}-${fileDate}.xlsx`
  );
}