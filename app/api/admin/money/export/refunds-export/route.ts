import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { requireAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RefundType = "money_received_back" | "money_sent_back";
type RefundStatus = "pending" | "completed" | "cancelled";

type RefundRow = {
  id: string;
  year: number;
  refund_date: string;
  refund_type: RefundType;
  amount_pence: number;
  title: string;
  notes?: string | null;
  original_transaction_id?: string | null;
  supplier_id?: string | null;
  reference_number?: string | null;
  status: RefundStatus;
  created_by_name?: string | null;
  created_by_email?: string | null;
  updated_by_name?: string | null;
  updated_by_email?: string | null;
  is_hidden?: boolean | null;
  hidden_at?: string | null;
  hidden_by_name?: string | null;
  hidden_by_email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SupplierRow = {
  id: string;
  supplier_name?: string | null;
  name?: string | null;
};

type TransactionRow = {
  id: string;
  title?: string | null;
  amount_pence?: number | null;
  type?: string | null;
  transaction_date?: string | null;
};

type HydratedRefund = RefundRow & {
  supplier_name: string;
  original_transaction_title: string;
  original_transaction_amount_pence: number | null;
  original_transaction_type: string;
  original_transaction_date: string;
};

type Summary = {
  activeRecords: number;
  hiddenRecords: number;
  completedRecords: number;
  pendingRecords: number;
  cancelledRecords: number;
  moneyReceivedBackPence: number;
  moneySentBackPence: number;
  netRefundAdjustmentPence: number;
};

type CurrentAdmin = {
  id?: string | null;
  admin_id?: string | null;
  user_id?: string | null;
  name?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
};

const REFUND_SELECT = `
  id,
  year,
  refund_date,
  refund_type,
  amount_pence,
  title,
  notes,
  original_transaction_id,
  supplier_id,
  reference_number,
  status,
  created_by_name,
  created_by_email,
  updated_by_name,
  updated_by_email,
  is_hidden,
  hidden_at,
  hidden_by_name,
  hidden_by_email,
  created_at,
  updated_at
`;

function jsonError(
  error: string,
  status = 500,
  details?: unknown,
  likelyFix?: string
) {
  return NextResponse.json(
    {
      error,
      details:
        details instanceof Error
          ? details.message
          : details || null,
      route: "/api/admin/money/export/refunds-export",
      expectedFile:
        "app/api/admin/money/export/refunds-export/route.ts",
      likelyFix:
        likelyFix ||
        "Check the money_refunds table and the refunds export route.",
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

function isValidYear(year: number) {
  return Number.isFinite(year) && year >= 2000 && year <= 2100;
}

function money(value?: number | null) {
  return Number(value || 0) / 100;
}

function moneyLabel(value?: number | null) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(money(value));
}

function dateLabel(value?: string | null) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function dateTimeLabel(value?: string | null) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function refundTypeLabel(type: RefundType) {
  return type === "money_received_back"
    ? "Refund Received Back"
    : "Refund Sent Back";
}

function refundStatusLabel(status: RefundStatus) {
  if (status === "completed") return "Completed";
  if (status === "pending") return "Pending";
  return "Cancelled";
}

function refundReference(refund: RefundRow) {
  const savedReference = String(refund.reference_number || "").trim();

  if (savedReference) {
    return savedReference;
  }

  return `REFUND-${refund.year}-${String(refund.id)
    .slice(0, 8)
    .toUpperCase()}`;
}

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function getActorName(admin: CurrentAdmin | null): string {
  if (!admin) return "Unknown user";

  return (
    cleanText(admin.full_name) ||
    cleanText(admin.name) ||
    cleanText(admin.display_name) ||
    cleanText(admin.email) ||
    "Unknown user"
  );
}

async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  try {
    return (await requireAdmin()) as CurrentAdmin | null;
  } catch (error) {
    console.error("Refund export admin auth error:", error);
    return null;
  }
}

type SheetTheme = {
  title: string;
  header: string;
  accent: string;
  pale: string;
  tab: string;
};

const THEMES = {
  summary: {
    title: "FF0F766E",
    header: "FF115E59",
    accent: "FF0F766E",
    pale: "FFE6FFFB",
    tab: "FF14B8A6",
  },
  active: {
    title: "FF047857",
    header: "FF065F46",
    accent: "FF047857",
    pale: "FFECFDF5",
    tab: "FF10B981",
  },
  deleted: {
    title: "FF9F1239",
    header: "FF881337",
    accent: "FF9F1239",
    pale: "FFFFF1F2",
    tab: "FFF43F5E",
  },
} satisfies Record<string, SheetTheme>;

function borderStyle(colour = "FFD1D5DB") {
  return {
    top: { style: "thin" as const, color: { argb: colour } },
    left: { style: "thin" as const, color: { argb: colour } },
    bottom: { style: "thin" as const, color: { argb: colour } },
    right: { style: "thin" as const, color: { argb: colour } },
  };
}

function applyWorksheetDefaults(
  worksheet: ExcelJS.Worksheet,
  tabColour: string
) {
  worksheet.properties.tabColor = { argb: tabColour };
  worksheet.properties.defaultRowHeight = 19;
  worksheet.views = [
    {
      state: "frozen",
      ySplit: 4,
      xSplit: 0,
      showGridLines: false,
    },
  ];

  worksheet.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };

  worksheet.headerFooter = {
    oddHeader: "&L&B Burton Pride C.I.C&RRefund Tracker Export",
    oddFooter: "&LGenerated from Burton Pride Admin Portal&CPage &P of &N&RConfidential",
  };
}

function styleTitle(
  worksheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  lastColumn: string,
  theme: SheetTheme
) {
  worksheet.mergeCells(`A1:${lastColumn}1`);
  worksheet.getCell("A1").value = title;
  worksheet.getCell("A1").font = {
    bold: true,
    size: 17,
    color: { argb: "FFFFFFFF" },
  };
  worksheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: theme.title },
  };
  worksheet.getCell("A1").alignment = {
    vertical: "middle",
    horizontal: "left",
  };
  worksheet.getRow(1).height = 28;

  worksheet.mergeCells(`A2:${lastColumn}2`);
  worksheet.getCell("A2").value = subtitle;
  worksheet.getCell("A2").font = {
    italic: true,
    size: 10,
    color: { argb: "FF475569" },
  };
  worksheet.getCell("A2").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF8FAFC" },
  };
  worksheet.getCell("A2").alignment = {
    wrapText: true,
    vertical: "middle",
  };
  worksheet.getRow(2).height = 32;

  worksheet.addRow([]);
}

function styleHeader(row: ExcelJS.Row, theme: SheetTheme) {
  row.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 10,
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: theme.header },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
    cell.border = borderStyle("FFCBD5E1");
  });

  row.height = 25;
}

function styleBody(
  row: ExcelJS.Row,
  rowIndex: number,
  theme: SheetTheme
) {
  const useStripe = rowIndex % 2 === 0;

  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = borderStyle("FFE2E8F0");
    cell.alignment = {
      vertical: "top",
      wrapText: true,
    };

    if (useStripe) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8FAFC" },
      };
    }
  });
}

function styleCurrency(cell: ExcelJS.Cell) {
  cell.numFmt = '£#,##0.00;[Red]-£#,##0.00';
}

function styleCount(cell: ExcelJS.Cell) {
  cell.numFmt = "0";
}

function styleMetricValue(
  cell: ExcelJS.Cell,
  fill: string,
  fontColour: string
) {
  cell.font = {
    bold: true,
    color: { argb: fontColour },
  };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: fill },
  };
}

function balanceEffectLabel(refund: RefundRow) {
  if (refund.is_hidden) {
    return "No effect while deleted";
  }

  if (refund.status !== "completed") {
    return `No effect while ${refund.status}`;
  }

  if (refund.refund_type === "money_received_back") {
    return `Adds ${moneyLabel(refund.amount_pence)} into Money In`;
  }

  return `Adds ${moneyLabel(refund.amount_pence)} into Money Out`;
}

function setEmptyState(
  worksheet: ExcelJS.Worksheet,
  message: string,
  lastColumn: string,
  theme: SheetTheme
) {
  const row = worksheet.addRow([message]);

  worksheet.mergeCells(`A${row.number}:${lastColumn}${row.number}`);

  row.getCell(1).font = {
    italic: true,
    color: { argb: "FF64748B" },
  };
  row.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: theme.pale },
  };
  row.getCell(1).alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  row.getCell(1).border = borderStyle("FFE2E8F0");
  row.height = 28;
}

function buildSummary(refunds: HydratedRefund[]): Summary {
  const visible = refunds.filter((refund) => !refund.is_hidden);
  const hidden = refunds.filter((refund) => refund.is_hidden);
  const completed = visible.filter((refund) => refund.status === "completed");

  const moneyReceivedBackPence = completed
    .filter((refund) => refund.refund_type === "money_received_back")
    .reduce((total, refund) => total + Number(refund.amount_pence || 0), 0);

  const moneySentBackPence = completed
    .filter((refund) => refund.refund_type === "money_sent_back")
    .reduce((total, refund) => total + Number(refund.amount_pence || 0), 0);

  return {
    activeRecords: visible.length,
    hiddenRecords: hidden.length,
    completedRecords: completed.length,
    pendingRecords: visible.filter((refund) => refund.status === "pending").length,
    cancelledRecords: visible.filter((refund) => refund.status === "cancelled").length,
    moneyReceivedBackPence,
    moneySentBackPence,
    netRefundAdjustmentPence:
      moneyReceivedBackPence - moneySentBackPence,
  };
}

function addSummarySheet({
  workbook,
  year,
  actorName,
  summary,
}: {
  workbook: ExcelJS.Workbook;
  year: number;
  actorName: string;
  summary: Summary;
}) {
  const theme = THEMES.summary;

  const worksheet = workbook.addWorksheet("Refund Summary");

  applyWorksheetDefaults(worksheet, theme.tab);

  worksheet.columns = [
    { key: "item", width: 36 },
    { key: "value", width: 22 },
    { key: "notes", width: 88 },
  ];

  styleTitle(
    worksheet,
    "Burton Pride C.I.C - Refund Tracker Export",
    `Year: ${year} | Generated: ${new Date().toLocaleString(
      "en-GB"
    )} | Generated by: ${actorName}`,
    "C",
    theme
  );

  const header = worksheet.addRow(["Summary item", "Value", "Explanation"]);
  styleHeader(header, theme);

  const rows: Array<{
    label: string;
    value: number;
    notes: string;
    currency?: boolean;
    fill?: string;
    font?: string;
  }> = [
    {
      label: "Active refund records",
      value: summary.activeRecords,
      notes: "Refunds currently visible in the Refund Tracker.",
    },
    {
      label: "Deleted refund records",
      value: summary.hiddenRecords,
      notes: "Soft-deleted refunds retained separately for accountability.",
    },
    {
      label: "Completed active refunds",
      value: summary.completedRecords,
      notes: "Only completed active refunds affect the Money In or Money Out totals.",
    },
    {
      label: "Pending active refunds",
      value: summary.pendingRecords,
      notes: "Pending refunds remain visible but do not affect the accounts totals.",
    },
    {
      label: "Cancelled active refunds",
      value: summary.cancelledRecords,
      notes: "Cancelled refunds remain visible but do not affect the accounts totals.",
    },
    {
      label: "Money received back",
      value: money(summary.moneyReceivedBackPence),
      notes: "Completed refunds returned to Burton Pride. Added into Money In.",
      currency: true,
      fill: "FFDCFCE7",
      font: "FF166534",
    },
    {
      label: "Money sent back",
      value: money(summary.moneySentBackPence),
      notes: "Completed refunds paid back to another person or organisation. Added into Money Out.",
      currency: true,
      fill: "FFFCE7F3",
      font: "FF9D174D",
    },
    {
      label: "Net refund adjustment",
      value: money(summary.netRefundAdjustmentPence),
      notes: "Money received back minus money sent back.",
      currency: true,
      fill: "FFE0F2FE",
      font: "FF075985",
    },
  ];

  rows.forEach((summaryRow, index) => {
    const row = worksheet.addRow([
      summaryRow.label,
      summaryRow.value,
      summaryRow.notes,
    ]);

    styleBody(row, index, theme);

    row.getCell(1).font = {
      bold: true,
      color: { argb: "FF0F172A" },
    };

    if (summaryRow.currency) {
      styleCurrency(row.getCell(2));
    } else {
      styleCount(row.getCell(2));
    }

    if (summaryRow.fill && summaryRow.font) {
      styleMetricValue(row.getCell(2), summaryRow.fill, summaryRow.font);
    }
  });

  worksheet.addRow([]);

  const rulesHeader = worksheet.addRow([
    "How refunds affect the main money tracker",
    "",
    "",
  ]);

  worksheet.mergeCells(`A${rulesHeader.number}:C${rulesHeader.number}`);
  rulesHeader.getCell(1).font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  rulesHeader.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: theme.header },
  };
  rulesHeader.getCell(1).alignment = {
    vertical: "middle",
  };
  rulesHeader.height = 23;

  [
    [
      "Completed refund received back",
      "Added into Money In",
      "Example: a supplier returns money to Burton Pride.",
    ],
    [
      "Completed refund sent back",
      "Added into Money Out",
      "Example: Burton Pride returns money to a stallholder, donor or sponsor.",
    ],
    [
      "Pending, cancelled or deleted refund",
      "No balance effect",
      "The record is kept for tracking but does not change the visible totals.",
    ],
  ].forEach((values, index) => {
    const row = worksheet.addRow(values);
    styleBody(row, index, theme);
  });

  worksheet.autoFilter = {
    from: "A4",
    to: "C4",
  };

  worksheet.pageSetup.printArea = `A1:C${worksheet.rowCount}`;

  return worksheet;
}

function addRefundWorksheet({
  workbook,
  sheetName,
  title,
  subtitle,
  refunds,
  theme,
}: {
  workbook: ExcelJS.Workbook;
  sheetName: string;
  title: string;
  subtitle: string;
  refunds: HydratedRefund[];
  theme: SheetTheme;
}) {
  const worksheet = workbook.addWorksheet(sheetName);

  applyWorksheetDefaults(worksheet, theme.tab);

  worksheet.columns = [
    { key: "reference", width: 25 },
    { key: "date", width: 16 },
    { key: "title", width: 34 },
    { key: "type", width: 23 },
    { key: "amount", width: 15 },
    { key: "status", width: 14 },
    { key: "balanceEffect", width: 30 },
    { key: "supplier", width: 28 },
    { key: "originalTitle", width: 34 },
    { key: "originalDate", width: 18 },
    { key: "originalType", width: 18 },
    { key: "originalAmount", width: 18 },
    { key: "notes", width: 42 },
    { key: "createdBy", width: 28 },
    { key: "updatedBy", width: 28 },
    { key: "deletedBy", width: 28 },
    { key: "deletedAt", width: 20 },
    { key: "createdAt", width: 20 },
    { key: "updatedAt", width: 20 },
    { key: "id", width: 38 },
  ];

  styleTitle(worksheet, title, subtitle, "T", theme);

  const header = worksheet.addRow([
    "Reference",
    "Refund Date",
    "Title",
    "Refund Type",
    "Amount",
    "Status",
    "Balance Effect",
    "Supplier",
    "Original Transaction",
    "Original Date",
    "Original Type",
    "Original Amount",
    "Notes",
    "Created By",
    "Updated By",
    "Deleted By",
    "Deleted At",
    "Created At",
    "Updated At",
    "Refund ID",
  ]);

  styleHeader(header, theme);

  if (refunds.length === 0) {
    setEmptyState(
      worksheet,
      "No refunds found for this section.",
      "T",
      theme
    );
  } else {
    refunds.forEach((refund, index) => {
      const row = worksheet.addRow({
        reference: refundReference(refund),
        date: dateLabel(refund.refund_date),
        title: refund.title,
        type: refundTypeLabel(refund.refund_type),
        amount: money(refund.amount_pence),
        status: refundStatusLabel(refund.status),
        balanceEffect: balanceEffectLabel(refund),
        supplier: refund.supplier_name,
        originalTitle: refund.original_transaction_title,
        originalDate: dateLabel(refund.original_transaction_date),
        originalType: refund.original_transaction_type || "Not recorded",
        originalAmount:
          refund.original_transaction_amount_pence === null
            ? null
            : money(refund.original_transaction_amount_pence),
        notes: refund.notes || "None",
        createdBy:
          refund.created_by_name ||
          refund.created_by_email ||
          "Unknown user",
        updatedBy:
          refund.updated_by_name ||
          refund.updated_by_email ||
          "Not updated",
        deletedBy:
          refund.hidden_by_name ||
          refund.hidden_by_email ||
          "Not deleted",
        deletedAt: dateTimeLabel(refund.hidden_at),
        createdAt: dateTimeLabel(refund.created_at),
        updatedAt: dateTimeLabel(refund.updated_at),
        id: refund.id,
      });

      styleBody(row, index, theme);
      styleCurrency(row.getCell("amount"));

      if (refund.original_transaction_amount_pence !== null) {
        styleCurrency(row.getCell("originalAmount"));
      }

      row.getCell("reference").font = {
        bold: true,
        color: { argb: theme.accent },
      };

      row.getCell("type").font = {
        bold: true,
        color: {
          argb:
            refund.refund_type === "money_received_back"
              ? "FF047857"
              : "FF7C3AED",
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
                : "FF64748B",
        },
      };

      row.getCell("balanceEffect").font = {
        bold: true,
        color: {
          argb:
            refund.is_hidden || refund.status !== "completed"
              ? "FF64748B"
              : refund.refund_type === "money_received_back"
                ? "FF166534"
                : "FF9D174D",
        },
      };
    });
  }

  worksheet.autoFilter = {
    from: "A4",
    to: "T4",
  };

  worksheet.pageSetup.printArea = `A1:T${worksheet.rowCount}`;

  return worksheet;
}

async function loadHydratedRefunds(year: number) {
  const { data, error } = await supabaseAdmin
    .from("money_refunds")
    .select(REFUND_SELECT)
    .eq("year", year)
    .order("refund_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      `Could not load public.money_refunds: ${error.message}`
    );
  }

  const refunds = (data || []) as RefundRow[];
  const supplierIds = Array.from(
    new Set(
      refunds
        .map((refund) => refund.supplier_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  const transactionIds = Array.from(
    new Set(
      refunds
        .map((refund) => refund.original_transaction_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  const supplierMap = new Map<string, SupplierRow>();
  const transactionMap = new Map<string, TransactionRow>();

  if (supplierIds.length > 0) {
    const { data: suppliers, error: supplierError } = await supabaseAdmin
      .from("money_suppliers")
      .select("id, supplier_name, name")
      .in("id", supplierIds);

    if (supplierError) {
      console.warn(
        "Refund export could not load linked suppliers:",
        supplierError
      );
    } else {
      (suppliers || []).forEach((supplier) => {
        supplierMap.set(supplier.id, supplier as SupplierRow);
      });
    }
  }

  if (transactionIds.length > 0) {
    const { data: transactions, error: transactionError } =
      await supabaseAdmin
        .from("money_transactions")
        .select("id, title, amount_pence, type, transaction_date")
        .in("id", transactionIds);

    if (transactionError) {
      console.warn(
        "Refund export could not load linked transactions:",
        transactionError
      );
    } else {
      (transactions || []).forEach((transaction) => {
        transactionMap.set(transaction.id, transaction as TransactionRow);
      });
    }
  }

  return refunds.map<HydratedRefund>((refund) => {
    const supplier = refund.supplier_id
      ? supplierMap.get(refund.supplier_id)
      : null;

    const original = refund.original_transaction_id
      ? transactionMap.get(refund.original_transaction_id)
      : null;

    return {
      ...refund,
      supplier_name:
        supplier?.supplier_name ||
        supplier?.name ||
        (refund.supplier_id ? "Linked supplier could not be loaded" : "Not linked"),
      original_transaction_title:
        original?.title ||
        (refund.original_transaction_id
          ? "Linked transaction could not be loaded"
          : "Not linked"),
      original_transaction_amount_pence:
        original?.amount_pence ?? null,
      original_transaction_type: original?.type || "",
      original_transaction_date: original?.transaction_date || "",
    };
  });
}

export async function GET(request: Request) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return jsonError(
      "You must be signed in as an admin to export refunds.",
      401,
      null,
      "Sign in again using the admin login page, then try downloading the Refund Tracker export."
    );
  }

  const actorName = getActorName(admin);

  const url = new URL(request.url);
  const year = Number(
    url.searchParams.get("year") || new Date().getFullYear()
  );

  if (!isValidYear(year)) {
    return jsonError(
      "The refund export year is invalid.",
      400,
      {
        receivedYear: url.searchParams.get("year"),
      },
      "Use a four-digit year between 2000 and 2100."
    );
  }

  try {
    const refunds = await loadHydratedRefunds(year);
    const summary = buildSummary(refunds);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Burton Pride C.I.C";
    workbook.lastModifiedBy = actorName;
    workbook.company = "Burton Pride C.I.C";
    workbook.subject = `Refund Tracker Export - ${year}`;
    workbook.title = `Burton Pride Refund Tracker Export - ${year}`;
    workbook.description =
      "Separate refund tracker export containing a summary, active refunds and deleted refunds.";
    workbook.keywords =
      "Burton Pride, refunds, money tracker, accounts, export";
    workbook.created = new Date();
    workbook.modified = new Date();

    addSummarySheet({
      workbook,
      year,
      actorName,
      summary,
    });

    addRefundWorksheet({
      workbook,
      sheetName: "Active Refunds",
      title: "Burton Pride C.I.C - Active Refunds",
      subtitle:
        "Active refunds remain visible in the Refund Tracker. Completed refunds affect money totals; pending and cancelled refunds do not.",
      refunds: refunds.filter((refund) => !refund.is_hidden),
      theme: THEMES.active,
    });

    addRefundWorksheet({
      workbook,
      sheetName: "Deleted Refunds",
      title: "Burton Pride C.I.C - Deleted Refunds",
      subtitle:
        "Deleted refunds are retained separately for accountability. They do not affect money totals unless restored.",
      refunds: refunds.filter((refund) => refund.is_hidden),
      theme: THEMES.deleted,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `burton-pride-refund-tracker-${year}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
        "X-Refund-Export-Active-Records": String(summary.activeRecords),
        "X-Refund-Export-Deleted-Records": String(summary.hiddenRecords),
        "X-Refund-Export-Net-Adjustment-Pence": String(
          summary.netRefundAdjustmentPence
        ),
      },
    });
  } catch (error) {
    console.error("Refund tracker export failed:", error);

    return jsonError(
      "The Refund Tracker export could not be created.",
      500,
      error,
      "Check that public.money_refunds exists and that its columns match the refund tracker SQL. Also check that ExcelJS is installed."
    );
  }
}
