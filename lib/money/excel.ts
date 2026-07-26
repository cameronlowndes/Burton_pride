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
  monthNameFromKey,
  pounds,
  sourceLabel,
} from "@/lib/money/utils";


type RefundType = "money_received_back" | "money_sent_back";
type RefundStatus = "pending" | "completed" | "cancelled";

export type MoneyRefundExportRecord = {
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

type CompletedRefundTotals = {
  receivedBack: number;
  sentBack: number;
};


type LinkedStockOrder = {
  id: string;
  orderNumber: string;
  title: string;
  status: string;
  supplierName: string | null;
  estimatedTotal: number;
  actualTotal: number | null;
  expectedDeliveryDate: string | null;
  moneyTransactionId: string;
};

type LinkedStockOrdersResponse = {
  ok?: boolean;
  links?: Record<string, LinkedStockOrder[]>;
  orders?: LinkedStockOrder[];
  error?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

type StockOrderExportDetails = {
  connectionState: "Connected" | "Not connected";
  orderNumbers: string;
  orderTitles: string;
  orderStatuses: string;
  orderSuppliers: string;
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


async function loadStockOrderLinksForExcelExport(
  transactionIds: string[]
) {
  const uniqueIds = Array.from(
    new Set(
      transactionIds
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    )
  );

  if (uniqueIds.length === 0) {
    return {} as Record<string, LinkedStockOrder[]>;
  }

  const response = await fetch(
    "/api/admin/stockmanagement/orders/transaction-links",
    {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transactionIds: uniqueIds,
      }),
    }
  );

  const payload =
    (await readJsonResponse(
      response
    )) as LinkedStockOrdersResponse;

  if (!response.ok || !payload.ok) {
    throw new Error(
      [
        payload.error ||
          "Stock Control order links could not be loaded for the Excel export.",
        payload.code
          ? `Code: ${payload.code}`
          : "",
        payload.details
          ? `Details: ${payload.details}`
          : "",
        payload.hint
          ? `Hint: ${payload.hint}`
          : "",
        `HTTP: ${response.status}`,
        "Endpoint: /api/admin/stockmanagement/orders/transaction-links",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  return payload.links || {};
}

function stockOrderStatusLabel(
  status?: string | null
) {
  const cleanStatus = String(
    status || ""
  ).trim();

  if (!cleanStatus) {
    return "Unknown";
  }

  return cleanStatus
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function stockOrderExportDetails(
  transactionId: string,
  linkedStockOrders: Record<
    string,
    LinkedStockOrder[]
  >
): StockOrderExportDetails {
  const orders =
    linkedStockOrders[transactionId] || [];

  if (orders.length === 0) {
    return {
      connectionState: "Not connected",
      orderNumbers: "",
      orderTitles: "",
      orderStatuses: "",
      orderSuppliers: "",
    };
  }

  return {
    connectionState: "Connected",
    orderNumbers: orders
      .map((order) => order.orderNumber)
      .filter(Boolean)
      .join(", "),
    orderTitles: orders
      .map((order) => order.title)
      .filter(Boolean)
      .join(" | "),
    orderStatuses: orders
      .map((order) =>
        stockOrderStatusLabel(order.status)
      )
      .filter(Boolean)
      .join(", "),
    orderSuppliers: orders
      .map(
        (order) =>
          order.supplierName ||
          "Not recorded"
      )
      .join(", "),
  };
}

async function loadRefundsForExcelExport(selectedYear: string) {
  const response = await fetch(
    `/api/admin/money/refunds?year=${encodeURIComponent(
      selectedYear
    )}&limit=500`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const payload = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      payload.message ||
        payload.error ||
        "Refunds could not be loaded for the Excel export."
    );
  }

  return (
    Array.isArray(payload.refunds)
      ? payload.refunds.filter(
          (refund: MoneyRefundExportRecord) => !refund.is_hidden
        )
      : []
  ) as MoneyRefundExportRecord[];
}

function refundMonthKey(refund: MoneyRefundExportRecord) {
  return String(refund.refund_date || refund.created_at || "").slice(0, 7);
}

function refundMatchesView({
  refund,
  selectedYear,
  selectedMonth,
}: {
  refund: MoneyRefundExportRecord;
  selectedYear: string;
  selectedMonth: string;
}) {
  if (refund.is_hidden) {
    return false;
  }

  if (String(refund.year) !== String(selectedYear)) {
    return false;
  }

  if (selectedMonth === "all") {
    return true;
  }

  return refundMonthKey(refund) === selectedMonth;
}

function calculateCompletedRefundTotals(
  refunds: MoneyRefundExportRecord[]
): CompletedRefundTotals {
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

function refundReference(refund: MoneyRefundExportRecord) {
  const savedReference = String(refund.reference_number || "").trim();

  if (savedReference) {
    return savedReference;
  }

  return `REFUND-${refund.year}-${String(refund.id || "")
    .slice(0, 8)
    .toUpperCase()}`;
}

function refundTypeLabel(refund: MoneyRefundExportRecord) {
  return refund.refund_type === "money_received_back"
    ? "Refund Received Back"
    : "Refund Sent Back";
}

function refundStatusLabel(status: RefundStatus) {
  if (status === "completed") return "Completed";
  if (status === "pending") return "Pending";
  return "Cancelled";
}

function refundBalanceEffect(refund: MoneyRefundExportRecord) {
  if (refund.status !== "completed") {
    return "No balance change until completed";
  }

  return refund.refund_type === "money_received_back"
    ? "Added into Money In"
    : "Added into Money Out";
}

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

function bankReconciliationLabel(status?: string | null) {
  if (status === "matched") return "Matched";
  if (status === "needs_review") return "Needs review";
  if (status === "ignored") return "Ignored";
  return "Unmatched";
}

function financeNoteStatusLabel(status?: string | null) {
  if (status === "waiting_for_receipt") return "Waiting for receipt";
  if (status === "ask_sponsor") return "Ask sponsor";
  if (status === "bank_query") return "Bank query";
  if (status === "resolved") return "Resolved";
  return "No query";
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

function receiptStatus(item: Transaction) {
  const files = getTransactionFiles(item);

  if (files.length > 0) {
    return "Receipt / proof attached";
  }

  if (item.type === "expense") {
    return "Missing receipt / proof";
  }

  return "No file attached";
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

function financeNote(item: Transaction) {
  return item.finance_note || "None";
}

function financeNoteUpdatedBy(item: Transaction) {
  return item.finance_note_updated_by || "None";
}

function financeNoteUpdatedAt(item: Transaction) {
  return item.finance_note_updated_at
    ? formatDate(item.finance_note_updated_at)
    : "None";
}

function bankReconciledBy(item: Transaction) {
  return item.bank_reconciled_by || "None";
}

function bankReconciledAt(item: Transaction) {
  return item.bank_reconciled_at ? formatDate(item.bank_reconciled_at) : "None";
}

function bankReconciliationNote(item: Transaction) {
  return item.bank_reconciliation_note || "None";
}

function styleTransactionRow(row: ExcelJS.Row, item: Transaction) {
  const isPersonal = isPersonalFundsTransaction(item);
  const hasFunding = isSponsorshipTransaction(item);
  const hasFiles = getTransactionFiles(item).length > 0;
  const financeStatus = item.finance_note_status || "none";
  const bankStatus = item.bank_reconciliation_status || "unmatched";

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

  row.getCell("financeNote").alignment = {
    vertical: "top",
    wrapText: true,
  };

  row.getCell("bankNote").alignment = {
    vertical: "top",
    wrapText: true,
  };

  const connectionState =
    String(
      row.getCell(
        "stockControlConnection"
      ).value || ""
    );

  if (connectionState === "Connected") {
    row.getCell(
      "stockControlConnection"
    ).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FFDCFCE7",
      },
    };

    row.getCell(
      "stockControlConnection"
    ).font = {
      bold: true,
      color: {
        argb: "FF166534",
      },
    };

    row.getCell(
      "stockOrderNumber"
    ).font = {
      bold: true,
      color: {
        argb: "FF155E75",
      },
    };

    row.getCell(
      "stockOrderStatus"
    ).font = {
      bold: true,
      color: {
        argb: "FF155E75",
      },
    };
  } else {
    row.getCell(
      "stockControlConnection"
    ).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FFF3F4F6",
      },
    };

    row.getCell(
      "stockControlConnection"
    ).font = {
      bold: true,
      color: {
        argb: "FF6B7280",
      },
    };
  }

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

  if (hasFiles) {
    row.getCell("receiptStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };

    row.getCell("receiptStatus").font = {
      bold: true,
      color: { argb: "FF166534" },
    };
  } else if (item.type === "expense") {
    row.getCell("receiptStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEE2E2" },
    };

    row.getCell("receiptStatus").font = {
      bold: true,
      color: { argb: "FF991B1B" },
    };
  }

  if (bankStatus === "matched") {
    row.getCell("bankStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };

    row.getCell("bankStatus").font = {
      bold: true,
      color: { argb: "FF166534" },
    };
  } else if (bankStatus === "needs_review") {
    row.getCell("bankStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEF3C7" },
    };

    row.getCell("bankStatus").font = {
      bold: true,
      color: { argb: "FF92400E" },
    };
  } else {
    row.getCell("bankStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };

    row.getCell("bankStatus").font = {
      bold: true,
      color: { argb: "FF6B7280" },
    };
  }

  if (financeStatus === "resolved") {
    row.getCell("financeStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };

    row.getCell("financeStatus").font = {
      bold: true,
      color: { argb: "FF166534" },
    };
  } else if (financeStatus !== "none") {
    row.getCell("financeStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEF3C7" },
    };

    row.getCell("financeStatus").font = {
      bold: true,
      color: { argb: "FF92400E" },
    };
  } else {
    row.getCell("financeStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };

    row.getCell("financeStatus").font = {
      bold: true,
      color: { argb: "FF6B7280" },
    };
  }
}

function transactionColumns() {
  return [
    { key: "reference", width: 18 },
    { key: "year", width: 14 },
    { key: "date", width: 16 },
    { key: "title", width: 30 },
    { key: "description", width: 36 },
    { key: "type", width: 16 },
    { key: "amount", width: 16 },
    { key: "payment", width: 20 },
    { key: "source", width: 22 },

    { key: "stockControlConnection", width: 24 },
    { key: "stockOrderNumber", width: 24 },
    { key: "stockOrderTitle", width: 34 },
    { key: "stockOrderStatus", width: 22 },
    { key: "stockOrderSupplier", width: 28 },

    { key: "bankStatus", width: 18 },
    { key: "bankNote", width: 34 },
    { key: "bankBy", width: 28 },
    { key: "bankAt", width: 20 },

    { key: "financeStatus", width: 24 },
    { key: "financeNote", width: 40 },
    { key: "financeBy", width: 28 },
    { key: "financeAt", width: 20 },

    { key: "receiptStatus", width: 24 },
    { key: "files", width: 55 },

    { key: "funding", width: 28 },
    { key: "fundingNote", width: 36 },
    { key: "personalFunds", width: 16 },
    { key: "paidBy", width: 22 },
    { key: "repaymentStatus", width: 20 },
    { key: "checkedStatus", width: 18 },
    { key: "checkedBy", width: 28 },
    { key: "checkedAt", width: 20 },
  ];
}

function transactionHeaderLabels() {
  return [
    "Reference",
    "Year",
    "Date",
    "Title",
    "Description",
    "Type",
    "Amount",
    "Payment Method",
    "Source",

    "Stock Control Connection",
    "Stock Order Number",
    "Stock Order Title",
    "Stock Order Status",
    "Stock Order Supplier",

    "Bank Match",
    "Bank Note",
    "Bank Matched By",
    "Bank Matched At",

    "Finance Query Status",
    "Finance Note",
    "Finance Updated By",
    "Finance Updated At",

    "Receipt Status",
    "Files / Attachments",

    "Funding Record",
    "Funding Note",
    "Personal Funds",
    "Paid By",
    "Repayment Status",
    "Checked Status",
    "Checked By",
    "Checked At",
  ];
}

function addTransactionRow(
  sheet: ExcelJS.Worksheet,
  item: Transaction,
  selectedYear: string,
  linkedStockOrders: Record<
    string,
    LinkedStockOrder[]
  >
) {
  const isPersonal = isPersonalFundsTransaction(item);
  const hasFunding = isSponsorshipTransaction(item);
  const stockOrderDetails =
    stockOrderExportDetails(
      item.id,
      linkedStockOrders
    );

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

    stockControlConnection:
      stockOrderDetails.connectionState,
    stockOrderNumber:
      stockOrderDetails.orderNumbers,
    stockOrderTitle:
      stockOrderDetails.orderTitles,
    stockOrderStatus:
      stockOrderDetails.orderStatuses,
    stockOrderSupplier:
      stockOrderDetails.orderSuppliers,

    bankStatus: bankReconciliationLabel(item.bank_reconciliation_status),
    bankNote: bankReconciliationNote(item),
    bankBy: bankReconciledBy(item),
    bankAt: bankReconciledAt(item),

    financeStatus: financeNoteStatusLabel(item.finance_note_status),
    financeNote: financeNote(item),
    financeBy: financeNoteUpdatedBy(item),
    financeAt: financeNoteUpdatedAt(item),

    receiptStatus: receiptStatus(item),
    files: filesSummary(item),

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
  });

  styleTransactionRow(row, item);
}


function refundColumns() {
  return [
    { key: "reference", width: 24 },
    { key: "year", width: 12 },
    { key: "date", width: 16 },
    { key: "title", width: 34 },
    { key: "notes", width: 46 },
    { key: "refundType", width: 24 },
    { key: "amount", width: 16 },
    { key: "status", width: 16 },
    { key: "supplier", width: 28 },
    { key: "originalTransaction", width: 36 },
    { key: "enteredReference", width: 28 },
    { key: "balanceEffect", width: 34 },
  ];
}

function refundHeaderLabels() {
  return [
    "Reference",
    "Year",
    "Date",
    "Title",
    "Notes",
    "Refund Type",
    "Amount",
    "Status",
    "Supplier",
    "Original Transaction",
    "Entered Reference",
    "Balance Effect",
  ];
}

function styleRefundRow(
  row: ExcelJS.Row,
  refund: MoneyRefundExportRecord
) {
  styleBodyRow(row);
  styleCurrencyCell(row.getCell("amount"), true);

  row.getCell("reference").font = {
    bold: true,
    color: { argb: "FF155E75" },
  };

  row.getCell("refundType").font = {
    bold: true,
    color: {
      argb:
        refund.refund_type === "money_received_back"
          ? "FF155E75"
          : "FF6B21A8",
    },
  };

  row.getCell("refundType").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb:
        refund.refund_type === "money_received_back"
          ? "FFCFFAFE"
          : "FFF3E8FF",
    },
  };

  row.getCell("status").font = {
    bold: true,
    color: {
      argb:
        refund.status === "completed"
          ? "FF166534"
          : refund.status === "pending"
            ? "FF92400E"
            : "FF6B7280",
    },
  };

  row.getCell("status").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb:
        refund.status === "completed"
          ? "FFDCFCE7"
          : refund.status === "pending"
            ? "FFFEF3C7"
            : "FFF3F4F6",
    },
  };

  row.getCell("balanceEffect").font = {
    bold: true,
    color: {
      argb:
        refund.status !== "completed"
          ? "FF6B7280"
          : refund.refund_type === "money_received_back"
            ? "FF166534"
            : "FF991B1B",
    },
  };
}

function addRefundRow(
  sheet: ExcelJS.Worksheet,
  refund: MoneyRefundExportRecord
) {
  const row = sheet.addRow({
    reference: refundReference(refund),
    year: String(refund.year),
    date: formatDate(refund.refund_date || refund.created_at),
    title: refund.title,
    notes: refund.notes || "None",
    refundType: refundTypeLabel(refund),
    amount: pounds(refund.amount_pence),
    status: refundStatusLabel(refund.status),
    supplier: refund.supplier?.supplier_name || "None",
    originalTransaction:
      refund.original_transaction?.title || "Not linked",
    enteredReference: refund.reference_number || "None",
    balanceEffect: refundBalanceEffect(refund),
  });

  styleRefundRow(row, refund);
}

function addRefundWorksheet({
  workbook,
  sheetName,
  title,
  subtitle,
  refunds,
}: {
  workbook: ExcelJS.Workbook;
  sheetName: string;
  title: string;
  subtitle: string;
  refunds: MoneyRefundExportRecord[];
}) {
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  sheet.columns = refundColumns();

  addMergedTitle(sheet, title, "A1", "L1");
  addMergedSubtitle(sheet, subtitle, "A2", "L2");

  sheet.addRow([]);

  const refundHeader = sheet.addRow(refundHeaderLabels());
  styleHeaderRow(refundHeader, "FF0E7490");

  if (refunds.length === 0) {
    const row = sheet.addRow(["No refunds saved for this export view."]);
    styleBodyRow(row);
  } else {
    refunds.forEach((refund) => {
      addRefundRow(sheet, refund);
    });
  }

  sheet.autoFilter = {
    from: "A4",
    to: "L4",
  };

  return sheet;
}

function addFilteredExportSummaryWorksheet({
  workbook,
  selectedYear,
  selectedViewMonth,
  filteredTransactions,
  refunds,
  linkedStockOrders,
}: {
  workbook: ExcelJS.Workbook;
  selectedYear: string;
  selectedViewMonth: string;
  filteredTransactions: Transaction[];
  refunds: MoneyRefundExportRecord[];
  linkedStockOrders: Record<
    string,
    LinkedStockOrder[]
  >;
}) {
  const sheet = workbook.addWorksheet("Export Summary", {
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
    { key: "label", width: 40 },
    { key: "amount", width: 20 },
    { key: "notes", width: 72 },
  ];

  const scopeLabel =
    selectedViewMonth === "all"
      ? `Jan to Dec ${selectedYear}`
      : monthNameFromKey(selectedViewMonth);

  const ordinaryMoneyIn = filteredTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount_pence || 0), 0);

  const ordinaryMoneyOut = filteredTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount_pence || 0), 0);

  const refundTotals = calculateCompletedRefundTotals(refunds);

  const moneyInIncludingRefunds =
    ordinaryMoneyIn + refundTotals.receivedBack;

  const moneyOutIncludingRefunds =
    ordinaryMoneyOut + refundTotals.sentBack;

  const availableBalance =
    moneyInIncludingRefunds - moneyOutIncludingRefunds;


  const connectedTransactionCount =
    filteredTransactions.filter(
      (item) =>
        (linkedStockOrders[item.id] || [])
          .length > 0
    ).length;

  const notConnectedTransactionCount =
    Math.max(
      filteredTransactions.length -
        connectedTransactionCount,
      0
    );

  addMergedTitle(
    sheet,
    "Burton Pride C.I.C - Filtered Money Export Summary",
    "A1",
    "C1"
  );

  addMergedSubtitle(
    sheet,
    `View: ${scopeLabel} | Ordinary transactions: ${
      filteredTransactions.length
    } | Refunds: ${refunds.length} | Exported: ${new Date().toLocaleString(
      "en-GB"
    )}`,
    "A2",
    "C2"
  );

  sheet.addRow([]);
  addMergedSection(sheet, "Export Summary", "A4", "C4", "FF0E7490");

  const header = sheet.addRow(["Item", "Amount", "Notes"]);
  styleHeaderRow(header, "FF111827");

  const rows: Array<[string, number, string]> = [
    [
      "Ordinary Money In",
      pounds(ordinaryMoneyIn),
      "Normal transaction income before refund adjustments.",
    ],
    [
      "Refunds Received Back",
      pounds(refundTotals.receivedBack),
      "Completed refunds returned to Burton Pride. Added into Money In.",
    ],
    [
      "Money In Including Completed Refunds",
      pounds(moneyInIncludingRefunds),
      "Ordinary Money In plus completed refunds received back.",
    ],
    [
      "Ordinary Money Out",
      pounds(ordinaryMoneyOut),
      "Normal transaction spending before refund adjustments.",
    ],
    [
      "Refunds Sent Back",
      pounds(refundTotals.sentBack),
      "Completed refunds returned to other people or organisations. Added into Money Out.",
    ],
    [
      "Money Out Including Completed Refunds",
      pounds(moneyOutIncludingRefunds),
      "Ordinary Money Out plus completed refunds sent back.",
    ],
    [
      "Balance In Export View",
      pounds(availableBalance),
      "Money In including completed refunds minus Money Out including completed refunds.",
    ],
    [
      "Transactions Connected to Stock Control",
      connectedTransactionCount,
      "Money Management transactions linked to one or more Stock Management orders.",
    ],
    [
      "Transactions Not Connected to Stock Control",
      notConnectedTransactionCount,
      "Money Management transactions with no linked Stock Management order.",
    ],
  ];

  rows.forEach(([label, amount, notes]) => {
    const row = sheet.addRow([label, amount, notes]);
    styleBodyRow(row);
    row.getCell(1).font = { bold: true };

    if (
      label.includes("Connected to Stock Control") ||
      label.includes("Not Connected to Stock Control")
    ) {
      row.getCell(2).numFmt = "0";
      row.getCell(2).font = { bold: true };
      row.getCell(2).alignment = {
        horizontal: "right",
        vertical: "top",
      };
    } else {
      styleCurrencyCell(row.getCell(2), true);
    }
  });

  return sheet;
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

  const allYearRefunds = await loadRefundsForExcelExport(selectedYear);

  const filteredRefunds = allYearRefunds.filter((refund) =>
    refundMatchesView({
      refund,
      selectedYear,
      selectedMonth: selectedViewMonth,
    })
  );


  const linkedStockOrders =
    await loadStockOrderLinksForExcelExport(
      filteredTransactions.map(
        (item) => item.id
      )
    );

  addFilteredExportSummaryWorksheet({
    workbook,
    selectedYear,
    selectedViewMonth,
    filteredTransactions,
    refunds: filteredRefunds,
    linkedStockOrders,
  });

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

  sheet.columns = transactionColumns();

  addMergedTitle(
    sheet,
    "Burton Pride C.I.C - Money Transactions Export",
    "A1",
    "AF1"
  );

  addMergedSubtitle(
    sheet,
    `View: ${
      selectedViewMonth === "all"
        ? `Jan to Dec ${selectedYear}`
        : monthNameFromKey(selectedViewMonth)
    } | Exported: ${new Date().toLocaleString("en-GB")} | Ordinary transaction rows: ${
      filteredTransactions.length
    } | Refund rows: ${filteredRefunds.length}`,
    "A2",
    "AF2"
  );

  sheet.addRow([]);

  sheet.addRow(transactionHeaderLabels());

  styleHeaderRow(sheet.getRow(4), "FF047857");

  filteredTransactions.forEach((item) => {
    addTransactionRow(
      sheet,
      item,
      selectedYear,
      linkedStockOrders
    );
  });

  sheet.autoFilter = {
    from: "A4",
    to: "AF4",
  };

  addRefundWorksheet({
    workbook,
    sheetName: "Refunds",
    title: "Burton Pride C.I.C - Refunds",
    subtitle: `View: ${
      selectedViewMonth === "all"
        ? `Jan to Dec ${selectedYear}`
        : monthNameFromKey(selectedViewMonth)
    } | Rows: ${filteredRefunds.length}`,
    refunds: filteredRefunds,
  });

  await downloadWorkbook(
    workbook,
    `burton-pride-money-transactions-with-stock-control-${selectedYear}-${fileDate}.xlsx`
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

  /**
   * These values are optional so the export stays compatible with the
   * existing hook. Refund records are loaded directly from the Refund Tracker
   * API below, so the Excel report always uses the latest completed refunds.
   */
  refundsReceivedBack?: number;
  refundsSentBack?: number;
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

  const yearRefunds = (
    await loadRefundsForExcelExport(selectedYear)
  ).filter((refund) =>
    refundMatchesView({
      refund,
      selectedYear,
      selectedMonth: "all",
    })
  );

  const refundTotals = calculateCompletedRefundTotals(yearRefunds);


  const linkedStockOrders =
    await loadStockOrderLinksForExcelExport(
      yearTransactions.map(
        (item) => item.id
      )
    );

  const connectedTransactionCount =
    yearTransactions.filter(
      (item) =>
        (linkedStockOrders[item.id] || [])
          .length > 0
    ).length;

  const notConnectedTransactionCount =
    Math.max(
      yearTransactions.length -
        connectedTransactionCount,
      0
    );

  const moneyInIncludingRefunds =
    Number(totals.income || 0) + refundTotals.receivedBack;

  const moneyOutIncludingRefunds =
    Number(totals.expense || 0) + refundTotals.sentBack;

  const closingBalanceIncludingRefunds =
    Number(totals.balance || 0) +
    refundTotals.receivedBack -
    refundTotals.sentBack;

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
    { key: "label", width: 42 },
    { key: "amount", width: 20 },
    { key: "notes", width: 76 },
  ];

  addMergedTitle(
    summarySheet,
    "Burton Pride C.I.C - Full Yearly Money Report",
    "A1",
    "C1"
  );

  addMergedSubtitle(
    summarySheet,
    `Year: Jan to Dec ${selectedYear} | Ordinary transactions: ${
      yearTransactions.length
    } | Refunds: ${yearRefunds.length} | Generated: ${new Date().toLocaleString(
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
    [
      "Ordinary Money In",
      pounds(totals.income),
      "Normal income transactions before completed refund adjustments.",
    ],
    [
      "Refunds Received Back",
      pounds(refundTotals.receivedBack),
      "Completed refunds returned to Burton Pride. Added into Money In.",
    ],
    [
      "Money In Including Completed Refunds",
      pounds(moneyInIncludingRefunds),
      "Ordinary Money In plus completed refunds received back.",
    ],
    [
      "Ordinary Money Out",
      pounds(totals.expense),
      "Burton Pride money out before completed refund adjustments. Personal funds are included only once marked paid back.",
    ],
    [
      "Refunds Sent Back",
      pounds(refundTotals.sentBack),
      "Completed refunds returned to other people or organisations. Added into Money Out.",
    ],
    [
      "Money Out Including Completed Refunds",
      pounds(moneyOutIncludingRefunds),
      "Ordinary Money Out plus completed refunds sent back.",
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
      "Closing Available Balance",
      pounds(closingBalanceIncludingRefunds),
      "Opening balance plus ordinary income plus completed refunds received back, minus eligible expenses and completed refunds sent back.",
    ],
    [
      "Transactions Connected to Stock Control",
      connectedTransactionCount,
      "Money Management transactions linked to one or more Stock Management orders.",
    ],
    [
      "Transactions Not Connected to Stock Control",
      notConnectedTransactionCount,
      "Money Management transactions with no linked Stock Management order.",
    ],
  ];

  summaryRows.forEach(([label, amount, notes]) => {
    const row = summarySheet.addRow([label, amount, notes]);
    styleBodyRow(row);
    row.getCell(1).font = { bold: true };

    if (
      label.includes("Connected to Stock Control") ||
      label.includes("Not Connected to Stock Control")
    ) {
      row.getCell(2).numFmt = "0";
      row.getCell(2).font = { bold: true };
      row.getCell(2).alignment = {
        horizontal: "right",
        vertical: "top",
      };
    } else {
      styleCurrencyCell(row.getCell(2), true);
    }
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

  addMergedSubtitle(
    sponsorSheet,
    `Year: Jan to Dec ${selectedYear}`,
    "A2",
    "K2"
  );

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

  transactionSheet.columns = transactionColumns();

  addMergedTitle(
    transactionSheet,
    "Burton Pride C.I.C - All Ordinary Transactions",
    "A1",
    "AF1"
  );

  addMergedSubtitle(
    transactionSheet,
    `Year: Jan to Dec ${selectedYear} | Ordinary transaction rows: ${
      yearTransactions.length
    }`,
    "A2",
    "AF2"
  );

  transactionSheet.addRow([]);

  const transactionHeader = transactionSheet.addRow(transactionHeaderLabels());

  styleHeaderRow(transactionHeader, "FF047857");

  if (yearTransactions.length === 0) {
    const row = transactionSheet.addRow([
      `No ordinary transactions saved for ${selectedYear}`,
    ]);
    styleBodyRow(row);
  } else {
    yearTransactions.forEach((item) => {
      addTransactionRow(
        transactionSheet,
        item,
        selectedYear,
        linkedStockOrders
      );
    });
  }

  transactionSheet.autoFilter = {
    from: "A4",
    to: "AF4",
  };

  addRefundWorksheet({
    workbook,
    sheetName: "Refunds",
    title: "Burton Pride C.I.C - All Refunds",
    subtitle: `Year: Jan to Dec ${selectedYear} | Refund rows: ${
      yearRefunds.length
    }`,
    refunds: yearRefunds,
  });

  await downloadWorkbook(
    workbook,
    `burton-pride-full-yearly-report-with-stock-control-${selectedYear}-${fileDate}.xlsx`
  );
}

