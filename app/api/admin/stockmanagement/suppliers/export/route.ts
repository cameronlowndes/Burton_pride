import ExcelJS, {
  Cell,
  Worksheet,
} from "exceljs";
import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  TABLES,
  apiError,
  cleanText,
  readJsonBody,
  requireAdmin,
  writeAuditLog,
} from "../_lib/supplierApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportFilters = {
  search?: unknown;
  connection?: unknown;
  status?: unknown;
  supplier_use?: unknown;
};

type ExportRow = Record<string, unknown>;

type SupplierTableStyle =
  | "TableStyleMedium2"
  | "TableStyleMedium3"
  | "TableStyleMedium4"
  | "TableStyleMedium9";


type SupabaseResult<T> = {
  data: T[] | null;
  error: {
    code?: string;
    message?: string;
    details?: string | null;
    hint?: string | null;
  } | null;
};

type IntegrationWarning = {
  source: string;
  table: string;
  code: string;
  message: string;
};

function isMissingTableError(error: SupabaseResult<ExportRow>["error"]) {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    String(error?.message || "")
      .toLowerCase()
      .includes("could not find the table") ||
    String(error?.message || "")
      .toLowerCase()
      .includes("relation") &&
      String(error?.message || "")
        .toLowerCase()
        .includes("does not exist")
  );
}

async function loadOptionalTable(
  table: string,
  source: string,
  warnings: IntegrationWarning[],
  options: {
    orderBy?: string;
    ascending?: boolean;
  } = {},
): Promise<ExportRow[]> {
  let query = supabaseAdmin
    .from(table)
    .select("*");

  if (options.orderBy) {
    query = query.order(options.orderBy, {
      ascending: options.ascending ?? false,
    });
  }

  const result =
    (await query) as unknown as SupabaseResult<ExportRow>;

  if (!result.error) {
    return result.data || [];
  }

  if (isMissingTableError(result.error)) {
    warnings.push({
      source,
      table,
      code: result.error.code || "PGRST205",
      message:
        result.error.message ||
        `${source} table is not available.`,
    });

    console.warn("Optional supplier export integration unavailable", {
      source,
      table,
      error: result.error,
    });

    return [];
  }

  throw result.error;
}

const BRAND = {
  navy: "FF0F172A",
  slate: "FF1E293B",
  purple: "FF7E22CE",
  pink: "FFDB2777",
  cyan: "FF0891B2",
  emerald: "FF059669",
  amber: "FFD97706",
  orange: "FFEA580C",
  red: "FFDC2626",
  white: "FFFFFFFF",
  grey: "FF64748B",
  border: "FFCBD5E1",
  paleSlate: "FFF1F5F9",
  palePurple: "FFF3E8FF",
  palePink: "FFFCE7F3",
  paleCyan: "FFCFFAFE",
  paleEmerald: "FFD1FAE5",
  paleAmber: "FFFEF3C7",
  paleRed: "FFFEE2E2",
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: BRAND.border } },
  left: { style: "thin", color: { argb: BRAND.border } },
  bottom: { style: "thin", color: { argb: BRAND.border } },
  right: { style: "thin", color: { argb: BRAND.border } },
};

function nullableString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function safeText(value: unknown) {
  if (value === null || value === undefined) return "";

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function validDate(value: unknown) {
  if (!value) return null;

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatFileDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function applyWorkbookMetadata(workbook: ExcelJS.Workbook) {
  const properties = workbook.properties as ExcelJS.WorkbookProperties & {
    creator?: string;
    lastModifiedBy?: string;
    title?: string;
    subject?: string;
    description?: string;
    category?: string;
    keywords?: string;
    created?: Date;
    modified?: Date;
  };

  workbook.properties = properties;
  properties.creator = "Burton Pride Stock Management";
  properties.lastModifiedBy = "Burton Pride Admin Portal";
  properties.title = "Burton Pride Stock Suppliers Workbook";
  properties.subject =
    "Combined Stock Management, Event Hub and Money Management supplier report";
  properties.description =
    "Styled supplier workbook containing connection, stock, order, spending, warning and operational information.";
  properties.category = "Stock Management";
  properties.keywords =
    "Burton Pride, suppliers, stock, Event Hub, Money Management, orders";
  properties.created = new Date();
  properties.modified = new Date();
}

function applySheetDefaults(
  sheet: Worksheet,
  options: {
    orientation?: "portrait" | "landscape";
    freezeRow?: number;
  } = {},
) {
  sheet.properties.defaultRowHeight = 20;
  sheet.views = [
    {
      state: options.freezeRow ? "frozen" : "normal",
      ySplit: options.freezeRow || 0,
      showGridLines: false,
    },
  ];

  sheet.pageSetup = {
    orientation: options.orientation || "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.55,
      bottom: 0.55,
      header: 0.2,
      footer: 0.2,
    },
  };

  sheet.headerFooter.oddHeader =
    '&L&"Arial,Bold"Burton Pride Stock Management&C&"Arial,Bold"&B Supplier Export&R&D';
  sheet.headerFooter.oddFooter =
    "&LAdmin report&CPage &P of &N&RGenerated &D &T";
}

function applyTitleBand(
  sheet: Worksheet,
  title: string,
  subtitle: string,
  columnCount: number,
  colour: string,
) {
  const finalColumn = Math.max(2, columnCount);

  sheet.mergeCells(1, 1, 1, finalColumn);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = {
    name: "Arial",
    bold: true,
    size: 20,
    color: { argb: BRAND.white },
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: colour },
  };
  titleCell.alignment = {
    vertical: "middle",
    horizontal: "left",
  };
  sheet.getRow(1).height = 35;

  sheet.mergeCells(2, 1, 2, finalColumn);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = {
    name: "Arial",
    italic: true,
    size: 10,
    color: { argb: BRAND.white },
  };
  subtitleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND.navy },
  };
  subtitleCell.alignment = {
    vertical: "middle",
    horizontal: "left",
    wrapText: true,
  };
  sheet.getRow(2).height = 30;

  sheet.getRow(3).height = 8;
}

function styleHeaderRow(
  sheet: Worksheet,
  rowNumber: number,
  colour: string,
) {
  const row = sheet.getRow(rowNumber);
  row.height = 30;

  row.eachCell((cell) => {
    cell.font = {
      name: "Arial",
      bold: true,
      size: 10,
      color: { argb: BRAND.white },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: colour },
    };
    cell.border = THIN_BORDER;
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
  });
}

function styleBodyRows(
  sheet: Worksheet,
  startRow: number,
  endRow: number,
  columnCount: number,
) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);

    for (
      let columnNumber = 1;
      columnNumber <= columnCount;
      columnNumber += 1
    ) {
      const cell = row.getCell(columnNumber);

      cell.font = {
        name: "Arial",
        size: 10,
        color: { argb: BRAND.navy },
      };
      cell.border = THIN_BORDER;
      cell.alignment = {
        vertical: "top",
        horizontal: "left",
        wrapText: true,
      };

      if ((rowNumber - startRow) % 2 === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: BRAND.paleSlate },
        };
      }
    }
  }
}

function colourStatusCell(cell: Cell, value: unknown) {
  const text = safeText(value).trim().toLowerCase();

  if (!text) return;

  if (
    text.includes("blocked") ||
    text.includes("do not use") ||
    text.includes("do not invite") ||
    text.includes("failed") ||
    text.includes("critical") ||
    text.includes("damaged") ||
    text === "no"
  ) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND.paleRed },
    };
    cell.font = {
      name: "Arial",
      bold: true,
      color: { argb: BRAND.red },
    };
    return;
  }

  if (
    text.includes("review") ||
    text.includes("missing") ||
    text.includes("warning") ||
    text.includes("overdue") ||
    text.includes("pending") ||
    text.includes("partial")
  ) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND.paleAmber },
    };
    cell.font = {
      name: "Arial",
      bold: true,
      color: { argb: BRAND.amber },
    };
    return;
  }

  if (
    text.includes("active") ||
    text.includes("connected") ||
    text.includes("success") ||
    text.includes("received") ||
    text.includes("good") ||
    text.includes("complete") ||
    text === "yes"
  ) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND.paleEmerald },
    };
    cell.font = {
      name: "Arial",
      bold: true,
      color: { argb: BRAND.emerald },
    };
  }
}

function addTableSheet({
  workbook,
  sheetName,
  title,
  subtitle,
  rows,
  columns,
  colour,
  tableStyle = "TableStyleMedium2",
}: {
  workbook: ExcelJS.Workbook;
  sheetName: string;
  title: string;
  subtitle: string;
  rows: ExportRow[];
  columns: Array<{
    key: string;
    label: string;
    width?: number;
    type?: "text" | "date" | "currency" | "number" | "status";
  }>;
  colour: string;
  tableStyle?: SupplierTableStyle;
}) {
  const sheet = workbook.addWorksheet(sheetName, {
    properties: {
      tabColor: { argb: colour },
    },
  });

  applySheetDefaults(sheet, {
    orientation: "landscape",
    freezeRow: 4,
  });
  applyTitleBand(
    sheet,
    title,
    subtitle,
    columns.length,
    colour,
  );

  const headerRowNumber = 4;
  const firstDataRow = 5;

  columns.forEach((column, index) => {
    const cell = sheet
      .getRow(headerRowNumber)
      .getCell(index + 1);
    cell.value = column.label;
    sheet.getColumn(index + 1).width =
      column.width || 18;
  });

  styleHeaderRow(
    sheet,
    headerRowNumber,
    colour,
  );

  if (rows.length === 0) {
    sheet.mergeCells(
      firstDataRow,
      1,
      firstDataRow + 2,
      columns.length,
    );

    const emptyCell = sheet.getCell(
      firstDataRow,
      1,
    );
    emptyCell.value =
      "No records matched this section.";
    emptyCell.font = {
      name: "Arial",
      italic: true,
      size: 12,
      color: { argb: BRAND.grey },
    };
    emptyCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND.paleSlate },
    };
    emptyCell.border = THIN_BORDER;
    emptyCell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    sheet.pageSetup.printArea =
      `A1:${sheet.getColumn(columns.length).letter}${firstDataRow + 2}`;

    return sheet;
  }

  const tableRows = rows.map((record) =>
    columns.map((column) => {
      const value = record[column.key];

      if (column.type === "date") {
        return validDate(value) || "";
      }

      if (column.type === "currency") {
        const numeric = Number(value || 0);
        return Number.isFinite(numeric)
          ? numeric / 100
          : 0;
      }

      if (column.type === "number") {
        const numeric = Number(value || 0);
        return Number.isFinite(numeric)
          ? numeric
          : 0;
      }

      if (typeof value === "boolean") {
        return value ? "Yes" : "No";
      }

      return value ?? "";
    }),
  );

  sheet.addTable({
    name: `${sheetName.replace(/[^a-z0-9]/gi, "")}Table`,
    ref: `A${headerRowNumber}`,
    headerRow: true,
    totalsRow: false,
    style: {
      theme: tableStyle,
      showFirstColumn: false,
      showLastColumn: false,
      showRowStripes: true,
      showColumnStripes: false,
    },
    columns: columns.map((column) => ({
      name: column.label,
      filterButton: true,
    })),
    rows: tableRows,
  });

  const lastDataRow =
    firstDataRow + rows.length - 1;

  styleBodyRows(
    sheet,
    firstDataRow,
    lastDataRow,
    columns.length,
  );

  columns.forEach((column, index) => {
    const excelColumn = sheet.getColumn(index + 1);

    if (column.type === "currency") {
      excelColumn.numFmt =
        '£#,##0.00;[Red]-£#,##0.00';
      excelColumn.alignment = {
        vertical: "top",
        horizontal: "right",
      };
    }

    if (column.type === "date") {
      excelColumn.numFmt =
        "dd mmm yyyy hh:mm";
      excelColumn.alignment = {
        vertical: "top",
        horizontal: "center",
      };
    }

    if (column.type === "number") {
      excelColumn.numFmt = "#,##0";
      excelColumn.alignment = {
        vertical: "top",
        horizontal: "center",
      };
    }

    if (column.type === "status") {
      for (
        let rowNumber = firstDataRow;
        rowNumber <= lastDataRow;
        rowNumber += 1
      ) {
        colourStatusCell(
          sheet.getRow(rowNumber).getCell(index + 1),
          sheet.getRow(rowNumber).getCell(index + 1)
            .value,
        );
      }
    }
  });

  sheet.autoFilter = {
    from: {
      row: headerRowNumber,
      column: 1,
    },
    to: {
      row: lastDataRow,
      column: columns.length,
    },
  };

  sheet.pageSetup.printTitlesRow =
    `${headerRowNumber}:${headerRowNumber}`;
  sheet.pageSetup.printArea =
    `A1:${sheet.getColumn(columns.length).letter}${lastDataRow}`;

  return sheet;
}

function addDashboard({
  workbook,
  generatedAt,
  filters,
  summary,
}: {
  workbook: ExcelJS.Workbook;
  generatedAt: Date;
  filters: {
    search: string;
    connection: string;
    status: string;
    supplierUse: string;
  };
  summary: {
    totalSuppliers: number;
    activeSuppliers: number;
    eventConnected: number;
    moneyConnected: number;
    fullyConnected: number;
    openOrders: number;
    overdueDeliveries: number;
    blockedOrWarned: number;
    missingConnections: number;
    totalActualSpendPence: number;
  };
}) {
  const sheet = workbook.addWorksheet(
    "Dashboard",
    {
      properties: {
        tabColor: { argb: BRAND.pink },
      },
    },
  );

  applySheetDefaults(sheet, {
    orientation: "portrait",
  });
  sheet.views = [{ showGridLines: false }];

  sheet.mergeCells("A1:H2");
  const titleCell = sheet.getCell("A1");
  titleCell.value =
    "Burton Pride Stock Suppliers";
  titleCell.font = {
    name: "Arial",
    bold: true,
    size: 25,
    color: { argb: BRAND.white },
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND.pink },
  };
  titleCell.alignment = {
    vertical: "middle",
    horizontal: "center",
  };

  sheet.mergeCells("A3:H3");
  const subtitleCell = sheet.getCell("A3");
  subtitleCell.value =
    "Combined Stock Management, Event Hub and Money Management export";
  subtitleCell.font = {
    name: "Arial",
    bold: true,
    size: 11,
    color: { argb: BRAND.white },
  };
  subtitleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND.navy },
  };
  subtitleCell.alignment = {
    vertical: "middle",
    horizontal: "center",
  };

  const cards = [
    {
      range: "A5:B7",
      label: "Total Suppliers",
      value: summary.totalSuppliers,
      colour: BRAND.purple,
      pale: BRAND.palePurple,
    },
    {
      range: "C5:D7",
      label: "Active Suppliers",
      value: summary.activeSuppliers,
      colour: BRAND.emerald,
      pale: BRAND.paleEmerald,
    },
    {
      range: "E5:F7",
      label: "Fully Connected",
      value: summary.fullyConnected,
      colour: BRAND.cyan,
      pale: BRAND.paleCyan,
    },
    {
      range: "G5:H7",
      label: "Missing Connections",
      value: summary.missingConnections,
      colour: BRAND.amber,
      pale: BRAND.paleAmber,
    },
    {
      range: "A9:B11",
      label: "Open Orders",
      value: summary.openOrders,
      colour: BRAND.purple,
      pale: BRAND.palePurple,
    },
    {
      range: "C9:D11",
      label: "Overdue Deliveries",
      value: summary.overdueDeliveries,
      colour: BRAND.orange,
      pale: BRAND.paleAmber,
    },
    {
      range: "E9:F11",
      label: "Blocked or Warned",
      value: summary.blockedOrWarned,
      colour: BRAND.red,
      pale: BRAND.paleRed,
    },
    {
      range: "G9:H11",
      label: "Actual Spend",
      value:
        summary.totalActualSpendPence / 100,
      colour: BRAND.emerald,
      pale: BRAND.paleEmerald,
      currency: true,
    },
  ];

  cards.forEach((card) => {
    sheet.mergeCells(card.range);
    const cell = sheet.getCell(
      card.range.split(":")[0],
    );

    cell.value = card.currency
      ? {
          richText: [
            {
              text: `${new Intl.NumberFormat(
                "en-GB",
                {
                  style: "currency",
                  currency: "GBP",
                },
              ).format(card.value)}\n`,
              font: {
                name: "Arial",
                bold: true,
                size: 18,
                color: {
                  argb: card.colour,
                },
              },
            },
            {
              text: card.label,
              font: {
                name: "Arial",
                bold: true,
                size: 10,
                color: {
                  argb: card.colour,
                },
              },
            },
          ],
        }
      : {
          richText: [
            {
              text: `${card.value.toLocaleString(
                "en-GB",
              )}\n`,
              font: {
                name: "Arial",
                bold: true,
                size: 19,
                color: {
                  argb: card.colour,
                },
              },
            },
            {
              text: card.label,
              font: {
                name: "Arial",
                bold: true,
                size: 10,
                color: {
                  argb: card.colour,
                },
              },
            },
          ],
        };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: card.pale },
    };
    cell.border = {
      top: {
        style: "medium",
        color: { argb: card.colour },
      },
      left: {
        style: "medium",
        color: { argb: card.colour },
      },
      bottom: {
        style: "medium",
        color: { argb: card.colour },
      },
      right: {
        style: "medium",
        color: { argb: card.colour },
      },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
  });

  sheet.mergeCells("A13:H13");
  const filterHeading = sheet.getCell("A13");
  filterHeading.value =
    "Export Filters and Details";
  filterHeading.font = {
    name: "Arial",
    bold: true,
    size: 13,
    color: { argb: BRAND.white },
  };
  filterHeading.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND.slate },
  };
  filterHeading.alignment = {
    vertical: "middle",
    horizontal: "left",
  };

  const filterRows = [
    ["Generated", generatedAt],
    [
      "Search",
      filters.search || "No search filter",
    ],
    [
      "Connection filter",
      titleCase(filters.connection || "all"),
    ],
    [
      "Status filter",
      titleCase(filters.status || "all"),
    ],
    [
      "Supplier-use filter",
      titleCase(filters.supplierUse || "all"),
    ],
    [
      "Event Hub connected",
      summary.eventConnected,
    ],
    [
      "Money connected",
      summary.moneyConnected,
    ],
  ];

  filterRows.forEach((entry, index) => {
    const rowNumber = 14 + index;

    sheet.mergeCells(
      rowNumber,
      1,
      rowNumber,
      2,
    );
    sheet.mergeCells(
      rowNumber,
      3,
      rowNumber,
      8,
    );

    const labelCell =
      sheet.getCell(rowNumber, 1);
    const valueCell =
      sheet.getCell(rowNumber, 3);

    labelCell.value = entry[0];
    valueCell.value = entry[1];

    labelCell.font = {
      name: "Arial",
      bold: true,
      color: { argb: BRAND.white },
    };
    labelCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND.slate },
    };
    valueCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb:
          index % 2 === 0
            ? BRAND.paleSlate
            : BRAND.white,
      },
    };

    labelCell.border = THIN_BORDER;
    valueCell.border = THIN_BORDER;

    labelCell.alignment = {
      vertical: "middle",
      horizontal: "left",
    };
    valueCell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };

    if (entry[1] instanceof Date) {
      valueCell.numFmt =
        "dd mmm yyyy hh:mm";
    }
  });

  for (let column = 1; column <= 8; column += 1) {
    sheet.getColumn(column).width = 16;
  }

  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 1;
  sheet.pageSetup.printArea = "A1:H20";

  return sheet;
}

function normaliseSupplierRows(input: {
  suppliers: ExportRow[];
  eventContacts: ExportRow[];
  moneySuppliers: ExportRow[];
  itemLinks: ExportRow[];
  orders: ExportRow[];
  transactions: ExportRow[];
}) {
  const eventById = new Map(
    input.eventContacts.map((row) => [
      String(row.id),
      row,
    ]),
  );
  const moneyById = new Map(
    input.moneySuppliers.map((row) => [
      String(row.id),
      row,
    ]),
  );

  return input.suppliers.map((supplier) => {
    const supplierId = String(supplier.id);
    const event = supplier.event_record_id
      ? eventById.get(
          String(supplier.event_record_id),
        )
      : undefined;
    const money = supplier.money_supplier_id
      ? moneyById.get(
          String(supplier.money_supplier_id),
        )
      : undefined;

    const linkedItems = input.itemLinks.filter(
      (row) =>
        String(
          row.stock_supplier_profile_id,
        ) === supplierId,
    );
    const linkedOrders = input.orders.filter(
      (row) =>
        String(
          row.stock_supplier_profile_id,
        ) === supplierId,
    );
    const linkedTransactions =
      input.transactions.filter(
        (row) =>
          supplier.money_supplier_id &&
          String(row.supplier_id) ===
            String(
              supplier.money_supplier_id,
            ),
      );

    const openOrders = linkedOrders.filter(
      (row) =>
        ![
          "received",
          "cancelled",
          "refunded",
        ].includes(
          cleanText(row.status).toLowerCase(),
        ),
    );

    const now = Date.now();
    const overdueOrders = openOrders.filter(
      (row) => {
        const expected = validDate(
          row.expected_delivery_date,
        );
        return expected
          ? expected.getTime() < now
          : false;
      },
    );

    const totalPaidPence =
      linkedTransactions.reduce(
        (sum, row) =>
          sum +
          Number(
            row.amount_pence ||
              row.amount ||
              0,
          ),
        0,
      );

    const totalEstimatedPence =
      linkedOrders.reduce(
        (sum, row) =>
          sum +
          Number(
            row.estimated_total_pence || 0,
          ),
        0,
      );

    const totalActualPence =
      linkedOrders.reduce(
        (sum, row) =>
          sum +
          Number(
            row.actual_total_pence || 0,
          ),
        0,
      );

    const eventConnected = Boolean(event);
    const moneyConnected = Boolean(money);
    const doNotUse =
      Boolean(supplier.do_not_use) ||
      Boolean(money?.do_not_use);
    const doNotInvite =
      Boolean(event?.do_not_invite);
    const needsReview =
      Boolean(supplier.needs_review) ||
      Boolean(event?.needs_review);

    const status = doNotUse
      ? "Blocked"
      : needsReview
        ? "Needs Review"
        : supplier.is_active === false
          ? "Inactive"
          : "Active";

    return {
      supplier_id: supplier.id,
      supplier_name:
        supplier.display_name ||
        "Unnamed supplier",
      supplier_use:
        supplier.supplier_use ||
        "stock",
      status,
      is_active:
        supplier.is_active !== false,
      needs_review: needsReview,
      do_not_use: doNotUse,
      event_hub_connected:
        eventConnected,
      event_hub_record_type:
        supplier.event_record_type ||
        "",
      event_hub_record_id:
        supplier.event_record_id ||
        "",
      event_organisation:
        event?.organisation_name ||
        event?.business_name ||
        "",
      event_contact:
        event?.contact_name ||
        "",
      event_email: event?.email || "",
      event_phone: event?.phone || "",
      event_rating:
        event?.rating || "",
      do_not_invite: doNotInvite,
      money_connected:
        moneyConnected,
      money_supplier_id:
        supplier.money_supplier_id ||
        "",
      money_supplier_name:
        money?.supplier_name || "",
      account_reference:
        money?.account_reference || "",
      stock_item_count:
        linkedItems.filter(
          (row) => row.is_active !== false,
        ).length,
      open_order_count:
        openOrders.length,
      overdue_order_count:
        overdueOrders.length,
      total_estimated_spend_pence:
        totalEstimatedPence,
      total_actual_spend_pence:
        totalActualPence,
      total_paid_pence:
        totalPaidPence,
      missing_receipt_count:
        linkedTransactions.filter(
          (row) =>
            !row.receipt_url &&
            row.receipt_required !== false,
        ).length,
      unreconciled_count:
        linkedTransactions.filter(
          (row) =>
            row.reconciled !== true,
        ).length,
      usual_delivery_days:
        supplier.usual_delivery_days ??
        "",
      minimum_order_value_pence:
        supplier.minimum_order_value_pence ??
        0,
      usual_delivery_cost_pence:
        supplier.usual_delivery_cost_pence ??
        0,
      stock_notes:
        supplier.stock_notes || "",
      created_at:
        supplier.created_at || "",
      updated_at:
        supplier.updated_at || "",
    };
  });
}

function matchesFilters(
  row: ExportRow,
  filters: {
    search: string;
    connection: string;
    status: string;
    supplierUse: string;
  },
) {
  const searchable = [
    row.supplier_name,
    row.event_organisation,
    row.event_contact,
    row.event_email,
    row.event_phone,
    row.money_supplier_name,
    row.account_reference,
    row.stock_notes,
  ]
    .map((value) =>
      safeText(value).toLowerCase(),
    )
    .join(" ");

  if (
    filters.search &&
    !searchable.includes(
      filters.search.toLowerCase(),
    )
  ) {
    return false;
  }

  const eventConnected =
    row.event_hub_connected === true;
  const moneyConnected =
    row.money_connected === true;

  if (
    filters.connection ===
      "event_connected" &&
    !eventConnected
  ) {
    return false;
  }

  if (
    filters.connection ===
      "money_connected" &&
    !moneyConnected
  ) {
    return false;
  }

  if (
    filters.connection ===
      "fully_connected" &&
    !(eventConnected && moneyConnected)
  ) {
    return false;
  }

  if (
    filters.connection ===
      "missing_event" &&
    eventConnected
  ) {
    return false;
  }

  if (
    filters.connection ===
      "missing_money" &&
    moneyConnected
  ) {
    return false;
  }

  if (
    filters.connection === "stock_only" &&
    (eventConnected || moneyConnected)
  ) {
    return false;
  }

  if (
    filters.connection ===
      "do_not_invite" &&
    row.do_not_invite !== true
  ) {
    return false;
  }

  if (
    filters.connection ===
      "do_not_use" &&
    row.do_not_use !== true
  ) {
    return false;
  }

  if (
    filters.connection ===
      "needs_review" &&
    row.needs_review !== true
  ) {
    return false;
  }

  if (
    filters.status !== "all" &&
    safeText(row.status)
      .toLowerCase()
      .replaceAll(" ", "_") !==
      filters.status.toLowerCase()
  ) {
    return false;
  }

  if (
    filters.supplierUse !== "all" &&
    safeText(row.supplier_use) !==
      filters.supplierUse
  ) {
    return false;
  }

  return true;
}

export async function POST(
  request: NextRequest,
) {
  const endpoint =
    "POST /api/admin/stockmanagement/suppliers/export";

  try {
    const admin = await requireAdmin();

    const rawFilters =
      await readJsonBody<ExportFilters>(
        request,
        {
          allowEmpty: true,
        },
      );

    const filters = {
      search:
        nullableString(rawFilters.search) ||
        "",
      connection:
        nullableString(
          rawFilters.connection,
        ) || "all",
      status:
        nullableString(rawFilters.status) ||
        "all",
      supplierUse:
        nullableString(
          rawFilters.supplier_use,
        ) || "all",
    };

    const integrationWarnings: IntegrationWarning[] = [];

    const suppliersResult = await supabaseAdmin
      .from(TABLES.suppliers)
      .select("*")
      .order("display_name");

    if (suppliersResult.error) {
      throw suppliersResult.error;
    }

    const [
      itemLinksData,
      ordersData,
      eventContactsData,
      moneySuppliersData,
      transactionsData,
    ] = await Promise.all([
      loadOptionalTable(
        TABLES.itemLinks,
        "Stock Management item links",
        integrationWarnings,
        {
          orderBy: "created_at",
          ascending: false,
        },
      ),
      loadOptionalTable(
        TABLES.orders,
        "Stock Management orders",
        integrationWarnings,
        {
          orderBy: "created_at",
          ascending: false,
        },
      ),
      loadOptionalTable(
        TABLES.eventContacts,
        "Event Hub",
        integrationWarnings,
      ),
      loadOptionalTable(
        TABLES.moneySuppliers,
        "Money Management suppliers",
        integrationWarnings,
      ),
      loadOptionalTable(
        TABLES.moneyTransactions,
        "Money Management transactions",
        integrationWarnings,
        {
          orderBy: "created_at",
          ascending: false,
        },
      ),
    ]);

    const supplierData =
      (suppliersResult.data || []) as ExportRow[];

    const allRows =
      normaliseSupplierRows({
        suppliers: supplierData,
        itemLinks: itemLinksData,
        orders: ordersData,
        eventContacts: eventContactsData,
        moneySuppliers: moneySuppliersData,
        transactions: transactionsData,
      });

    const supplierRows = allRows.filter(
      (row) =>
        matchesFilters(row, filters),
    );

    const selectedSupplierIds =
      new Set(
        supplierRows.map((row) =>
          String(row.supplier_id),
        ),
      );

    const selectedMoneySupplierIds =
      new Set(
        supplierRows
          .map((row) =>
            safeText(
              row.money_supplier_id,
            ),
          )
          .filter(Boolean),
      );

    const selectedItemLinks = (
      itemLinksData
    ).filter((row) =>
      selectedSupplierIds.has(
        String(
          row.stock_supplier_profile_id,
        ),
      ),
    );

    const selectedOrders = (
      ordersData
    ).filter((row) =>
      selectedSupplierIds.has(
        String(
          row.stock_supplier_profile_id,
        ),
      ),
    );

    const selectedTransactions = (
      transactionsData
    ).filter((row) =>
      selectedMoneySupplierIds.has(
        String(row.supplier_id),
      ),
    );

    const summary = {
      totalSuppliers: supplierRows.length,
      activeSuppliers:
        supplierRows.filter(
          (row) =>
            row.is_active === true,
        ).length,
      eventConnected:
        supplierRows.filter(
          (row) =>
            row.event_hub_connected ===
            true,
        ).length,
      moneyConnected:
        supplierRows.filter(
          (row) =>
            row.money_connected === true,
        ).length,
      fullyConnected:
        supplierRows.filter(
          (row) =>
            row.event_hub_connected ===
              true &&
            row.money_connected === true,
        ).length,
      openOrders:
        supplierRows.reduce(
          (sum, row) =>
            sum +
            Number(
              row.open_order_count || 0,
            ),
          0,
        ),
      overdueDeliveries:
        supplierRows.reduce(
          (sum, row) =>
            sum +
            Number(
              row.overdue_order_count ||
                0,
            ),
          0,
        ),
      blockedOrWarned:
        supplierRows.filter(
          (row) =>
            row.do_not_use === true ||
            row.do_not_invite === true ||
            row.needs_review === true,
        ).length,
      missingConnections:
        supplierRows.filter(
          (row) =>
            row.event_hub_connected !==
              true ||
            row.money_connected !== true,
        ).length,
      totalActualSpendPence:
        supplierRows.reduce(
          (sum, row) =>
            sum +
            Number(
              row.total_actual_spend_pence ||
                0,
            ),
          0,
        ),
    };

    const workbook =
      new ExcelJS.Workbook();
    applyWorkbookMetadata(workbook);

    addDashboard({
      workbook,
      generatedAt: new Date(),
      filters,
      summary,
    });

    addTableSheet({
      workbook,
      sheetName: "Supplier Summary",
      title:
        "Supplier Summary",
      subtitle:
        "Combined operational view of Stock Management suppliers and their current status.",
      colour: BRAND.purple,
      tableStyle:
        "TableStyleMedium4",
      rows: supplierRows,
      columns: [
        {
          key: "supplier_name",
          label: "Supplier",
          width: 32,
        },
        {
          key: "supplier_use",
          label: "Supplier Use",
          width: 18,
        },
        {
          key: "status",
          label: "Status",
          width: 18,
          type: "status",
        },
        {
          key: "is_active",
          label: "Active",
          width: 12,
          type: "status",
        },
        {
          key: "needs_review",
          label: "Needs Review",
          width: 15,
          type: "status",
        },
        {
          key: "do_not_use",
          label: "Do Not Use",
          width: 14,
          type: "status",
        },
        {
          key: "stock_item_count",
          label: "Stock Items",
          width: 13,
          type: "number",
        },
        {
          key: "open_order_count",
          label: "Open Orders",
          width: 13,
          type: "number",
        },
        {
          key: "overdue_order_count",
          label: "Overdue",
          width: 12,
          type: "number",
        },
        {
          key: "total_actual_spend_pence",
          label: "Actual Spend",
          width: 16,
          type: "currency",
        },
        {
          key: "total_paid_pence",
          label: "Money Paid",
          width: 16,
          type: "currency",
        },
        {
          key: "updated_at",
          label: "Last Updated",
          width: 20,
          type: "date",
        },
      ],
    });

    addTableSheet({
      workbook,
      sheetName: "Supplier Connections",
      title:
        "Three-App Supplier Connections",
      subtitle:
        "Event Hub, Money Management and Stock Management link status for each supplier.",
      colour: BRAND.cyan,
      tableStyle:
        "TableStyleMedium2",
      rows: supplierRows,
      columns: [
        {
          key: "supplier_name",
          label: "Supplier",
          width: 30,
        },
        {
          key: "event_hub_connected",
          label: "Event Hub Connected",
          width: 19,
          type: "status",
        },
        {
          key: "event_hub_record_type",
          label: "Event Record Type",
          width: 22,
        },
        {
          key: "event_organisation",
          label: "Event Organisation",
          width: 28,
        },
        {
          key: "event_contact",
          label: "Event Contact",
          width: 24,
        },
        {
          key: "event_email",
          label: "Event Email",
          width: 30,
        },
        {
          key: "do_not_invite",
          label: "Do Not Invite",
          width: 15,
          type: "status",
        },
        {
          key: "money_connected",
          label: "Money Connected",
          width: 18,
          type: "status",
        },
        {
          key: "money_supplier_name",
          label: "Money Supplier",
          width: 28,
        },
        {
          key: "account_reference",
          label: "Account Reference",
          width: 20,
        },
        {
          key: "missing_receipt_count",
          label: "Missing Receipts",
          width: 16,
          type: "number",
        },
        {
          key: "unreconciled_count",
          label: "Unreconciled",
          width: 15,
          type: "number",
        },
      ],
    });

    const itemRows =
      selectedItemLinks.map((row) => {
        const supplier =
          supplierRows.find(
            (supplierRow) =>
              String(
                supplierRow.supplier_id,
              ) ===
              String(
                row.stock_supplier_profile_id,
              ),
          );

        return {
          supplier_name:
            supplier?.supplier_name ||
            "",
          stock_item_id:
            row.stock_item_id || "",
          stock_item_name:
            row.stock_item_name || "",
          stock_item_sku:
            row.stock_item_sku || "",
          supplier_role:
            row.is_preferred
              ? "Preferred"
              : "Alternative",
          supplier_product_code:
            row.supplier_product_code ||
            "",
          usual_unit_cost_pence:
            row.usual_unit_cost_pence ||
            0,
          minimum_order_quantity:
            row.minimum_order_quantity ||
            0,
          usual_delivery_days:
            row.usual_delivery_days ||
            0,
          is_active:
            row.is_active !== false,
          created_at:
            row.created_at || "",
          updated_at:
            row.updated_at || "",
        };
      });

    addTableSheet({
      workbook,
      sheetName: "Stock Items",
      title:
        "Stock Items Supplied",
      subtitle:
        "Preferred and alternative supplier links, product references, costs, quantities and lead times.",
      colour: BRAND.emerald,
      tableStyle:
        "TableStyleMedium9",
      rows: itemRows,
      columns: [
        {
          key: "supplier_name",
          label: "Supplier",
          width: 28,
        },
        {
          key: "stock_item_name",
          label: "Stock Item",
          width: 28,
        },
        {
          key: "stock_item_sku",
          label: "SKU",
          width: 18,
        },
        {
          key: "supplier_role",
          label: "Supplier Role",
          width: 16,
          type: "status",
        },
        {
          key: "supplier_product_code",
          label: "Supplier Product Code",
          width: 23,
        },
        {
          key: "usual_unit_cost_pence",
          label: "Usual Unit Cost",
          width: 17,
          type: "currency",
        },
        {
          key: "minimum_order_quantity",
          label: "Minimum Quantity",
          width: 17,
          type: "number",
        },
        {
          key: "usual_delivery_days",
          label: "Lead Time Days",
          width: 15,
          type: "number",
        },
        {
          key: "is_active",
          label: "Active",
          width: 12,
          type: "status",
        },
        {
          key: "updated_at",
          label: "Updated",
          width: 20,
          type: "date",
        },
      ],
    });

    const orderRows =
      selectedOrders.map((row) => {
        const supplier =
          supplierRows.find(
            (supplierRow) =>
              String(
                supplierRow.supplier_id,
              ) ===
              String(
                row.stock_supplier_profile_id,
              ),
          );

        return {
          supplier_name:
            supplier?.supplier_name ||
            "",
          order_number:
            row.order_number || "",
          status: row.status || "",
          order_date:
            row.order_date || "",
          expected_delivery_date:
            row.expected_delivery_date ||
            "",
          delivered_at:
            row.delivered_at || "",
          estimated_total_pence:
            row.estimated_total_pence ||
            0,
          actual_total_pence:
            row.actual_total_pence || 0,
          received_quantity:
            row.received_quantity || 0,
          missing_quantity:
            row.missing_quantity || 0,
          damaged_quantity:
            row.damaged_quantity || 0,
          refund_required:
            Boolean(
              row.refund_required,
            ),
          replacement_required:
            Boolean(
              row.replacement_required,
            ),
          notes: row.notes || "",
          updated_at:
            row.updated_at || "",
        };
      });

    addTableSheet({
      workbook,
      sheetName: "Purchase Orders",
      title:
        "Purchase Orders and Deliveries",
      subtitle:
        "Order status, dates, totals, received quantities, missing items, damaged items, refunds and replacements.",
      colour: BRAND.purple,
      tableStyle:
        "TableStyleMedium4",
      rows: orderRows,
      columns: [
        {
          key: "supplier_name",
          label: "Supplier",
          width: 28,
        },
        {
          key: "order_number",
          label: "Order Number",
          width: 18,
        },
        {
          key: "status",
          label: "Status",
          width: 17,
          type: "status",
        },
        {
          key: "order_date",
          label: "Order Date",
          width: 18,
          type: "date",
        },
        {
          key: "expected_delivery_date",
          label: "Expected Delivery",
          width: 20,
          type: "date",
        },
        {
          key: "delivered_at",
          label: "Delivered",
          width: 18,
          type: "date",
        },
        {
          key: "estimated_total_pence",
          label: "Estimated Total",
          width: 17,
          type: "currency",
        },
        {
          key: "actual_total_pence",
          label: "Actual Total",
          width: 17,
          type: "currency",
        },
        {
          key: "received_quantity",
          label: "Received",
          width: 13,
          type: "number",
        },
        {
          key: "missing_quantity",
          label: "Missing",
          width: 13,
          type: "number",
        },
        {
          key: "damaged_quantity",
          label: "Damaged",
          width: 13,
          type: "number",
        },
        {
          key: "refund_required",
          label: "Refund Required",
          width: 16,
          type: "status",
        },
        {
          key: "replacement_required",
          label: "Replacement Required",
          width: 20,
          type: "status",
        },
        {
          key: "notes",
          label: "Notes",
          width: 35,
        },
      ],
    });

    const transactionRows =
      selectedTransactions.map((row) => {
        const supplier =
          supplierRows.find(
            (supplierRow) =>
              String(
                supplierRow.money_supplier_id,
              ) ===
              String(
                row.supplier_id,
              ),
          );

        return {
          supplier_name:
            supplier?.supplier_name ||
            "",
          transaction_date:
            row.transaction_date ||
            row.created_at ||
            "",
          reference:
            row.reference ||
            row.transaction_reference ||
            "",
          description:
            row.description || "",
          category:
            row.category || "",
          amount_pence:
            row.amount_pence ||
            row.amount ||
            0,
          receipt_present:
            Boolean(row.receipt_url),
          reconciled:
            row.reconciled === true,
          refund:
            Boolean(
              row.is_refund ||
                row.refund_id,
            ),
          created_at:
            row.created_at || "",
        };
      });

    addTableSheet({
      workbook,
      sheetName:
        "Money Activity",
      title:
        "Money Management Activity",
      subtitle:
        "Financial activity connected to exported supplier records. Bank-account details are not included.",
      colour: BRAND.emerald,
      tableStyle:
        "TableStyleMedium9",
      rows: transactionRows,
      columns: [
        {
          key: "supplier_name",
          label: "Supplier",
          width: 28,
        },
        {
          key: "transaction_date",
          label: "Transaction Date",
          width: 20,
          type: "date",
        },
        {
          key: "reference",
          label: "Reference",
          width: 22,
        },
        {
          key: "description",
          label: "Description",
          width: 35,
        },
        {
          key: "category",
          label: "Category",
          width: 20,
        },
        {
          key: "amount_pence",
          label: "Amount",
          width: 16,
          type: "currency",
        },
        {
          key: "receipt_present",
          label: "Receipt Present",
          width: 16,
          type: "status",
        },
        {
          key: "reconciled",
          label: "Reconciled",
          width: 14,
          type: "status",
        },
        {
          key: "refund",
          label: "Refund",
          width: 12,
          type: "status",
        },
      ],
    });

    const warningRows =
      supplierRows
        .filter(
          (row) =>
            row.do_not_use === true ||
            row.do_not_invite === true ||
            row.needs_review === true ||
            Number(
              row.overdue_order_count || 0,
            ) > 0 ||
            Number(
              row.missing_receipt_count ||
                0,
            ) > 0 ||
            Number(
              row.unreconciled_count || 0,
            ) > 0,
        )
        .map((row) => ({
          supplier_name:
            row.supplier_name,
          stock_status: row.status,
          do_not_use:
            row.do_not_use,
          do_not_invite:
            row.do_not_invite,
          needs_review:
            row.needs_review,
          overdue_orders:
            row.overdue_order_count,
          missing_receipts:
            row.missing_receipt_count,
          unreconciled_transactions:
            row.unreconciled_count,
          warning_summary: [
            row.do_not_use
              ? "Do not use"
              : "",
            row.do_not_invite
              ? "Do not invite"
              : "",
            row.needs_review
              ? "Needs review"
              : "",
            Number(
              row.overdue_order_count || 0,
            ) > 0
              ? "Overdue deliveries"
              : "",
            Number(
              row.missing_receipt_count ||
                0,
            ) > 0
              ? "Missing receipts"
              : "",
            Number(
              row.unreconciled_count || 0,
            ) > 0
              ? "Unreconciled payments"
              : "",
          ]
            .filter(Boolean)
            .join(", "),
        }));

    addTableSheet({
      workbook,
      sheetName: "Warnings",
      title:
        "Supplier Warnings",
      subtitle:
        "Suppliers requiring review because of Event Hub, Money Management, stock, order or payment warnings.",
      colour: BRAND.red,
      tableStyle:
        "TableStyleMedium3",
      rows: warningRows,
      columns: [
        {
          key: "supplier_name",
          label: "Supplier",
          width: 30,
        },
        {
          key: "stock_status",
          label: "Status",
          width: 18,
          type: "status",
        },
        {
          key: "do_not_use",
          label: "Do Not Use",
          width: 14,
          type: "status",
        },
        {
          key: "do_not_invite",
          label: "Do Not Invite",
          width: 15,
          type: "status",
        },
        {
          key: "needs_review",
          label: "Needs Review",
          width: 15,
          type: "status",
        },
        {
          key: "overdue_orders",
          label: "Overdue Orders",
          width: 15,
          type: "number",
        },
        {
          key: "missing_receipts",
          label: "Missing Receipts",
          width: 16,
          type: "number",
        },
        {
          key: "unreconciled_transactions",
          label: "Unreconciled",
          width: 15,
          type: "number",
        },
        {
          key: "warning_summary",
          label: "Warning Summary",
          width: 42,
          type: "status",
        },
      ],
    });

    addTableSheet({
      workbook,
      sheetName: "Integration Status",
      title: "Integration Status",
      subtitle:
        "Shows any optional connected-app tables that were unavailable when this workbook was created.",
      colour:
        integrationWarnings.length > 0
          ? BRAND.amber
          : BRAND.emerald,
      tableStyle:
        integrationWarnings.length > 0
          ? "TableStyleMedium3"
          : "TableStyleMedium9",
      rows:
        integrationWarnings.length > 0
          ? integrationWarnings.map((warning) => ({
              source: warning.source,
              table: warning.table,
              status: "Unavailable",
              error_code: warning.code,
              message: warning.message,
            }))
          : [
              {
                source: "All configured integrations",
                table: "All configured tables",
                status: "Available",
                error_code: "",
                message:
                  "No missing optional integration tables were detected.",
              },
            ],
      columns: [
        {
          key: "source",
          label: "Integration",
          width: 32,
        },
        {
          key: "table",
          label: "Supabase Table",
          width: 34,
        },
        {
          key: "status",
          label: "Status",
          width: 16,
          type: "status",
        },
        {
          key: "error_code",
          label: "Error Code",
          width: 16,
        },
        {
          key: "message",
          label: "Details",
          width: 65,
        },
      ],
    });

    const buffer =
      await workbook.xlsx.writeBuffer();

    await writeAuditLog({
      admin,
      action: "supplier_exported",
      actionLabel:
        "Supplier workbook exported",
      summary:
        `Exported a styled supplier workbook containing ${supplierRows.length} suppliers.`,
      afterData: {
        filters,
        supplier_count:
          supplierRows.length,
        stock_item_count:
          itemRows.length,
        order_count:
          orderRows.length,
        money_activity_count:
          transactionRows.length,
        warning_count:
          warningRows.length,
        worksheet_count:
          workbook.worksheets.length,
        integration_warning_count:
          integrationWarnings.length,
        integration_warnings:
          integrationWarnings,
      },
      route:
        endpoint.replace("POST ", ""),
      httpMethod: "POST",
      riskLevel: "low",
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          `attachment; filename="burton-pride-stock-suppliers-${formatFileDate()}.xlsx"`,
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    return apiError(
      error,
      endpoint,
      "The supplier workbook could not be exported.",
    );
  }
}
