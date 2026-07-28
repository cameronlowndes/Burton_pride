import ExcelJS, {
  Border,
  Borders,
  Font,
  Worksheet,
} from "exceljs";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  TABLES,
  apiError,
  getSupplierOrThrow,
  requireAdmin,
  writeAuditLog,
} from "../../_lib/supplierApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    supplierId: string;
  }>;
};

type ExportRow = Record<string, unknown>;

const BRAND = {
  navy: "FF0F172A",
  slate: "FF1E293B",
  purple: "FF6D28D9",
  pink: "FFDB2777",
  cyan: "FF0891B2",
  emerald: "FF059669",
  amber: "FFD97706",
  red: "FFDC2626",
  white: "FFFFFFFF",
  lightText: "FFE2E8F0",
  palePurple: "FFF3E8FF",
  palePink: "FFFCE7F3",
  paleCyan: "FFCFFAFE",
  paleEmerald: "FFD1FAE5",
  paleAmber: "FFFEF3C7",
  paleRed: "FFFEE2E2",
  paleSlate: "FFF1F5F9",
  border: "FFCBD5E1",
  greyText: "FF475569",
};

const THIN_BORDER: Partial<Borders> = {
  top: { style: "thin", color: { argb: BRAND.border } },
  left: { style: "thin", color: { argb: BRAND.border } },
  bottom: { style: "thin", color: { argb: BRAND.border } },
  right: { style: "thin", color: { argb: BRAND.border } },
};

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

function isDateKey(key: string) {
  return (
    key.endsWith("_at") ||
    key.endsWith("_date") ||
    key.endsWith("_expiry") ||
    key === "created_at" ||
    key === "updated_at"
  );
}

function isMoneyKey(key: string) {
  return (
    key.endsWith("_pence") ||
    key.includes("amount") ||
    key.includes("cost") ||
    key.includes("total") ||
    key.includes("value")
  );
}

function isBooleanValue(value: unknown) {
  return typeof value === "boolean";
}

function toExcelValue(key: string, value: unknown) {
  if (value === null || value === undefined) return "";

  if (isDateKey(key)) {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) return date;
  }

  if (key.endsWith("_pence")) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric / 100 : 0;
  }

  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return value as string;
}

function applyTitleBand(
  sheet: Worksheet,
  title: string,
  subtitle: string,
  columnCount: number,
  colour = BRAND.purple,
) {
  const lastColumn = Math.max(columnCount, 2);

  sheet.mergeCells(1, 1, 1, lastColumn);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = {
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
  sheet.getRow(1).height = 34;

  sheet.mergeCells(2, 1, 2, lastColumn);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = {
    italic: true,
    size: 10,
    color: { argb: BRAND.lightText },
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
  sheet.getRow(2).height = 28;

  sheet.getRow(3).height = 8;
}

function styleHeaderRow(
  sheet: Worksheet,
  rowNumber: number,
  colour = BRAND.slate,
) {
  const row = sheet.getRow(rowNumber);

  row.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: BRAND.white },
      size: 10,
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: colour },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.border = THIN_BORDER;
  });

  row.height = 28;
}

function applyDataRowStyles(
  sheet: Worksheet,
  startRow: number,
  endRow: number,
  columnCount: number,
) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const isEven = (rowNumber - startRow) % 2 === 0;

    for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
      const cell = row.getCell(columnNumber);

      cell.border = THIN_BORDER;
      cell.alignment = {
        vertical: "top",
        horizontal: "left",
        wrapText: true,
      };

      if (isEven) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: BRAND.paleSlate },
        };
      }
    }
  }
}

function applyWorksheetDefaults(sheet: Worksheet) {
  sheet.properties.defaultRowHeight = 20;
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };

  sheet.headerFooter.oddHeader =
    '&L&"Arial,Bold"Burton Pride Stock Management&C&"Arial,Bold"&B Supplier Workbook&R&D';
  sheet.headerFooter.oddFooter =
    "&LConfidential admin report&CPage &P of &N&RGenerated &D &T";

  sheet.views = [
    {
      state: "frozen",
      ySplit: 4,
      showGridLines: false,
    },
  ];
}

function setAutoWidths(
  sheet: Worksheet,
  rows: ExportRow[],
  keys: string[],
) {
  keys.forEach((key, index) => {
    const headerLength = titleCase(key).length;

    const maxDataLength = rows.reduce((maximum, row) => {
      const value = safeText(row[key]);
      return Math.max(maximum, Math.min(value.length, 60));
    }, 0);

    sheet.getColumn(index + 1).width = Math.min(
      42,
      Math.max(14, headerLength + 3, maxDataLength + 2),
    );
  });
}

function applyColumnFormats(
  sheet: Worksheet,
  keys: string[],
  startRow: number,
  endRow: number,
) {
  keys.forEach((key, index) => {
    const column = sheet.getColumn(index + 1);

    if (isDateKey(key)) {
      column.numFmt = "dd mmm yyyy hh:mm";
      column.alignment = {
        vertical: "top",
        horizontal: "center",
        wrapText: true,
      };
    }

    if (key.endsWith("_pence")) {
      column.numFmt = '£#,##0.00;[Red]-£#,##0.00';
      column.alignment = {
        vertical: "top",
        horizontal: "right",
      };
    } else if (isMoneyKey(key)) {
      for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
        const cell = sheet.getRow(rowNumber).getCell(index + 1);
        if (typeof cell.value === "number") {
          cell.numFmt = '£#,##0.00;[Red]-£#,##0.00';
          cell.alignment = {
            vertical: "top",
            horizontal: "right",
          };
        }
      }
    }

    if (
      key.includes("quantity") ||
      key.includes("days") ||
      key.includes("rating") ||
      key.includes("count")
    ) {
      column.alignment = {
        vertical: "top",
        horizontal: "center",
      };
    }
  });
}

function applyBooleanHighlights(
  sheet: Worksheet,
  rows: ExportRow[],
  keys: string[],
  startRow: number,
) {
  rows.forEach((row, rowIndex) => {
    keys.forEach((key, columnIndex) => {
      const value = row[key];

      if (!isBooleanValue(value)) return;

      const cell = sheet.getRow(startRow + rowIndex).getCell(columnIndex + 1);
      const enabled = value === true;

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: enabled ? BRAND.paleEmerald : BRAND.paleRed,
        },
      };
      cell.font = {
        bold: true,
        color: {
          argb: enabled ? BRAND.emerald : BRAND.red,
        },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
      };
    });
  });
}

function applyWarningHighlights(
  sheet: Worksheet,
  rows: ExportRow[],
  keys: string[],
  startRow: number,
) {
  rows.forEach((row, rowIndex) => {
    keys.forEach((key, columnIndex) => {
      const text = safeText(row[key]).toLowerCase();

      if (!text) return;

      const cell = sheet.getRow(startRow + rowIndex).getCell(columnIndex + 1);

      if (
        text.includes("blocked") ||
        text.includes("do not use") ||
        text.includes("do_not_use") ||
        text.includes("failed") ||
        text.includes("critical") ||
        text.includes("damaged")
      ) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: BRAND.paleRed },
        };
        cell.font = {
          bold: true,
          color: { argb: BRAND.red },
        };
      } else if (
        text.includes("review") ||
        text.includes("warning") ||
        text.includes("missing") ||
        text.includes("overdue") ||
        text.includes("pending") ||
        text.includes("replacement")
      ) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: BRAND.paleAmber },
        };
        cell.font = {
          bold: true,
          color: { argb: BRAND.amber },
        };
      } else if (
        text.includes("success") ||
        text.includes("active") ||
        text.includes("received") ||
        text.includes("good") ||
        text.includes("completed")
      ) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: BRAND.paleEmerald },
        };
        cell.font = {
          bold: true,
          color: { argb: BRAND.emerald },
        };
      }
    });
  });
}

function addRowsSheet({
  workbook,
  name,
  title,
  subtitle,
  rows,
  colour,
}: {
  workbook: ExcelJS.Workbook;
  name: string;
  title: string;
  subtitle: string;
  rows: ExportRow[];
  colour: string;
}) {
  const sheet = workbook.addWorksheet(name);
  applyWorksheetDefaults(sheet);

  if (rows.length === 0) {
    applyTitleBand(sheet, title, subtitle, 2, colour);
    sheet.mergeCells("A4:B6");

    const emptyCell = sheet.getCell("A4");
    emptyCell.value = "No records were found for this section.";
    emptyCell.font = {
      italic: true,
      color: { argb: BRAND.greyText },
      size: 12,
    };
    emptyCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND.paleSlate },
    };
    emptyCell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    emptyCell.border = THIN_BORDER;

    sheet.getColumn(1).width = 32;
    sheet.getColumn(2).width = 32;
    return sheet;
  }

  const keys = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row))),
  );

  applyTitleBand(sheet, title, subtitle, keys.length, colour);

  const headerRowNumber = 4;
  const firstDataRow = 5;
  const lastDataRow = firstDataRow + rows.length - 1;

  keys.forEach((key, index) => {
    sheet.getRow(headerRowNumber).getCell(index + 1).value = titleCase(key);
  });

  styleHeaderRow(sheet, headerRowNumber, colour);

  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(firstDataRow + rowIndex);

    keys.forEach((key, columnIndex) => {
      excelRow.getCell(columnIndex + 1).value = toExcelValue(key, row[key]);
    });
  });

  applyDataRowStyles(
    sheet,
    firstDataRow,
    lastDataRow,
    keys.length,
  );
  setAutoWidths(sheet, rows, keys);
  applyColumnFormats(
    sheet,
    keys,
    firstDataRow,
    lastDataRow,
  );
  applyBooleanHighlights(sheet, rows, keys, firstDataRow);
  applyWarningHighlights(sheet, rows, keys, firstDataRow);

  const tableName = `${name.replace(/[^a-z0-9]/gi, "")}Table`;

  sheet.addTable({
    name: tableName,
    ref: `A${headerRowNumber}`,
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium2",
      showFirstColumn: false,
      showLastColumn: false,
      showRowStripes: true,
      showColumnStripes: false,
    },
    columns: keys.map((key) => ({
      name: titleCase(key),
      filterButton: true,
    })),
    rows: rows.map((row) =>
      keys.map((key) => toExcelValue(key, row[key])),
    ),
  });

  sheet.autoFilter = {
    from: {
      row: headerRowNumber,
      column: 1,
    },
    to: {
      row: lastDataRow,
      column: keys.length,
    },
  };

  sheet.pageSetup.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(keys.length).letter}${lastDataRow}`;

  return sheet;
}

function addSupplierSummarySheet(
  workbook: ExcelJS.Workbook,
  supplier: ExportRow,
) {
  const sheet = workbook.addWorksheet("Supplier Summary");
  applyWorksheetDefaults(sheet);
  sheet.views = [
    {
      state: "frozen",
      ySplit: 4,
      showGridLines: false,
    },
  ];

  applyTitleBand(
    sheet,
    safeText(supplier.display_name) || "Supplier Summary",
    "Combined Stock Management supplier profile exported by Burton Pride.",
    4,
    BRAND.purple,
  );

  sheet.getColumn("A").width = 30;
  sheet.getColumn("B").width = 42;
  sheet.getColumn("C").width = 30;
  sheet.getColumn("D").width = 42;

  const entries = Object.entries(supplier);
  const pairs: Array<{
    left?: [string, unknown];
    right?: [string, unknown];
  }> = [];

  for (let index = 0; index < entries.length; index += 2) {
    pairs.push({
      left: entries[index],
      right: entries[index + 1],
    });
  }

  const firstDataRow = 4;

  pairs.forEach((pair, index) => {
    const rowNumber = firstDataRow + index;
    const row = sheet.getRow(rowNumber);

    if (pair.left) {
      row.getCell(1).value = titleCase(pair.left[0]);
      row.getCell(2).value = toExcelValue(pair.left[0], pair.left[1]);
    }

    if (pair.right) {
      row.getCell(3).value = titleCase(pair.right[0]);
      row.getCell(4).value = toExcelValue(pair.right[0], pair.right[1]);
    }

    [1, 3].forEach((columnNumber) => {
      const cell = row.getCell(columnNumber);
      cell.font = {
        bold: true,
        color: { argb: BRAND.white },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BRAND.slate },
      };
      cell.border = THIN_BORDER;
      cell.alignment = {
        vertical: "top",
        horizontal: "left",
        wrapText: true,
      };
    });

    [2, 4].forEach((columnNumber) => {
      const cell = row.getCell(columnNumber);
      cell.border = THIN_BORDER;
      cell.alignment = {
        vertical: "top",
        horizontal: "left",
        wrapText: true,
      };

      if (index % 2 === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: BRAND.palePurple },
        };
      }
    });
  });

  for (let rowNumber = firstDataRow; rowNumber < firstDataRow + pairs.length; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);

    [2, 4].forEach((columnNumber) => {
      const cell = row.getCell(columnNumber);

      if (cell.value instanceof Date) {
        cell.numFmt = "dd mmm yyyy hh:mm";
      }

      if (
        safeText(row.getCell(columnNumber - 1).value)
          .toLowerCase()
          .includes("pence") &&
        typeof cell.value === "number"
      ) {
        cell.numFmt = '£#,##0.00;[Red]-£#,##0.00';
      }
    });
  }

  sheet.pageSetup.printArea = `A1:D${firstDataRow + pairs.length - 1}`;

  return sheet;
}

function addDashboardSheet({
  workbook,
  supplier,
  itemCount,
  orderCount,
  reviewCount,
  complianceCount,
  auditCount,
}: {
  workbook: ExcelJS.Workbook;
  supplier: ExportRow;
  itemCount: number;
  orderCount: number;
  reviewCount: number;
  complianceCount: number;
  auditCount: number;
}) {
  const sheet = workbook.addWorksheet("Dashboard", {
    properties: {
      tabColor: {
        argb: BRAND.pink,
      },
    },
  });

  applyWorksheetDefaults(sheet);
  sheet.views = [{ showGridLines: false }];

  sheet.mergeCells("A1:H2");
  const title = sheet.getCell("A1");
  title.value = "Burton Pride Supplier Workbook";
  title.font = {
    bold: true,
    size: 24,
    color: { argb: BRAND.white },
  };
  title.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND.pink },
  };
  title.alignment = {
    vertical: "middle",
    horizontal: "center",
  };

  sheet.mergeCells("A3:H3");
  const supplierName = sheet.getCell("A3");
  supplierName.value =
    safeText(supplier.display_name) || "Unnamed supplier";
  supplierName.font = {
    bold: true,
    size: 16,
    color: { argb: BRAND.navy },
  };
  supplierName.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND.palePink },
  };
  supplierName.alignment = {
    vertical: "middle",
    horizontal: "center",
  };

  const cards = [
    {
      range: "A5:B7",
      label: "Stock Item Links",
      value: itemCount,
      colour: BRAND.cyan,
      pale: BRAND.paleCyan,
    },
    {
      range: "C5:D7",
      label: "Purchase Orders",
      value: orderCount,
      colour: BRAND.purple,
      pale: BRAND.palePurple,
    },
    {
      range: "E5:F7",
      label: "Supplier Reviews",
      value: reviewCount,
      colour: BRAND.emerald,
      pale: BRAND.paleEmerald,
    },
    {
      range: "G5:H7",
      label: "Audit Entries",
      value: auditCount,
      colour: BRAND.amber,
      pale: BRAND.paleAmber,
    },
  ];

  cards.forEach((card) => {
    sheet.mergeCells(card.range);
    const cell = sheet.getCell(card.range.split(":")[0]);
    cell.value = `${card.value}\n${card.label}`;
    cell.font = {
      bold: true,
      size: 16,
      color: { argb: card.colour },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: card.pale },
    };
    cell.border = {
      top: { style: "medium", color: { argb: card.colour } },
      left: { style: "medium", color: { argb: card.colour } },
      bottom: { style: "medium", color: { argb: card.colour } },
      right: { style: "medium", color: { argb: card.colour } },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
  });

  const statusRows: [string, string | number][] = [
    ["Supplier Use", titleCase(safeText(supplier.supplier_use) || "Not recorded")],
    ["Active", supplier.is_active === true ? "Yes" : "No"],
    ["Needs Review", supplier.needs_review === true ? "Yes" : "No"],
    ["Do Not Use", supplier.do_not_use === true ? "Yes" : "No"],
    ["Event Hub Linked", supplier.event_record_id ? "Yes" : "No"],
    ["Money Management Linked", supplier.money_supplier_id ? "Yes" : "No"],
    ["Compliance Records", String(complianceCount)],
    ["Last Updated", supplier.updated_at ? String(supplier.updated_at) : "Not recorded"],
  ];

  sheet.getCell("A9").value = "Supplier Overview";
  sheet.getCell("A9").font = {
    bold: true,
    size: 14,
    color: { argb: BRAND.white },
  };
  sheet.getCell("A9").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND.navy },
  };
  sheet.mergeCells("A9:H9");

  statusRows.forEach((entry, index) => {
    const rowNumber = 10 + index;
    sheet.mergeCells(rowNumber, 1, rowNumber, 2);
    sheet.mergeCells(rowNumber, 3, rowNumber, 8);

    const labelCell = sheet.getCell(rowNumber, 1);
    const valueCell = sheet.getCell(rowNumber, 3);

    labelCell.value = entry[0];
    valueCell.value = entry[1];

    labelCell.font = {
      bold: true,
      color: { argb: BRAND.white },
    };
    labelCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND.slate },
    };
    labelCell.border = THIN_BORDER;
    valueCell.border = THIN_BORDER;
    valueCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: index % 2 === 0 ? BRAND.paleSlate : BRAND.white,
      },
    };

    labelCell.alignment = {
      vertical: "middle",
      horizontal: "left",
    };
    valueCell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
  });

  for (let column = 1; column <= 8; column += 1) {
    sheet.getColumn(column).width = 16;
  }

  sheet.pageSetup.orientation = "portrait";
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 1;
  sheet.pageSetup.printArea = "A1:H17";

  return sheet;
}

export async function POST(
  _request: Request,
  context: RouteContext,
) {
  const { supplierId } = await context.params;
  const endpoint =
    `POST /api/admin/stockmanagement/suppliers/${supplierId}/export`;

  try {
    const admin = await requireAdmin();
    const supplier = await getSupplierOrThrow(supplierId);

    const [
      items,
      orders,
      reviews,
      compliance,
      audits,
    ] = await Promise.all([
      supabaseAdmin
        .from(TABLES.itemLinks)
        .select("*")
        .eq("stock_supplier_profile_id", supplierId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from(TABLES.orders)
        .select("*")
        .eq("stock_supplier_profile_id", supplierId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from(TABLES.reviews)
        .select("*")
        .eq("stock_supplier_profile_id", supplierId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from(TABLES.compliance)
        .select("*")
        .eq("stock_supplier_profile_id", supplierId),
      supabaseAdmin
        .from(TABLES.audit)
        .select("*")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false }),
    ]);

    for (const result of [
      items,
      orders,
      reviews,
      compliance,
      audits,
    ]) {
      if (result.error) {
        throw result.error;
      }
    }

    const itemRows = (items.data || []) as ExportRow[];
    const orderRows = (orders.data || []) as ExportRow[];
    const reviewRows = (reviews.data || []) as ExportRow[];
    const complianceRows = (compliance.data || []) as ExportRow[];
    const auditRows = (audits.data || []) as ExportRow[];

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Burton Pride Stock Management";
    workbook.lastModifiedBy = "Burton Pride Admin Portal";
    // set extended properties via workbook.properties to satisfy types
    (workbook.properties as { company?: string }).company =
      "Burton Pride C.I.C";
    (workbook.properties as { subject?: string }).subject =
      "Stock supplier operational workbook";
    (workbook.properties as { title?: string }).title = `${safeText(
      supplier.display_name,
    )} Supplier Workbook`;
    (workbook.properties as { description?: string }).description =
      "Combined supplier profile, stock links, purchase orders, compliance, reviews and audit history.";
    (workbook.properties as { category?: string }).category = "Stock Management";
    (workbook.properties as { keywords?: string }).keywords =
      "Burton Pride, supplier, stock, purchasing, compliance, orders";
    workbook.created = new Date();
    workbook.modified = new Date();

    addDashboardSheet({
      workbook,
      supplier,
      itemCount: itemRows.length,
      orderCount: orderRows.length,
      reviewCount: reviewRows.length,
      complianceCount: complianceRows.length,
      auditCount: auditRows.length,
    });

    addSupplierSummarySheet(workbook, supplier);

    addRowsSheet({
      workbook,
      name: "Stock Items",
      title: "Stock Items Supplied",
      subtitle:
        "Preferred and alternative supplier links, product codes, costs, quantities and lead times.",
      rows: itemRows,
      colour: BRAND.cyan,
    });

    addRowsSheet({
      workbook,
      name: "Purchase Orders",
      title: "Purchase Orders and Deliveries",
      subtitle:
        "Order status, delivery dates, spending, missing items, damaged items, refunds and replacements.",
      rows: orderRows,
      colour: BRAND.purple,
    });

    addRowsSheet({
      workbook,
      name: "Supplier Reviews",
      title: "Supplier Reviews",
      subtitle:
        "Operational, delivery, quality, communication and value assessments.",
      rows: reviewRows,
      colour: BRAND.emerald,
    });

    addRowsSheet({
      workbook,
      name: "Compliance",
      title: "Insurance and Food-Hygiene Compliance",
      subtitle:
        "Public liability insurance and food-hygiene evidence connected to this supplier.",
      rows: complianceRows,
      colour: BRAND.amber,
    });

    addRowsSheet({
      workbook,
      name: "Audit History",
      title: "Supplier Audit History",
      subtitle:
        "Administrative changes and significant supplier actions. Page views and searches are not included.",
      rows: auditRows,
      colour: BRAND.slate,
    });

    workbook.worksheets.forEach((sheet) => {
      sheet.properties.tabColor = {
        argb:
          sheet.name === "Dashboard"
            ? BRAND.pink
            : sheet.name === "Supplier Summary"
              ? BRAND.purple
              : sheet.name === "Stock Items"
                ? BRAND.cyan
                : sheet.name === "Purchase Orders"
                  ? BRAND.purple
                  : sheet.name === "Supplier Reviews"
                    ? BRAND.emerald
                    : sheet.name === "Compliance"
                      ? BRAND.amber
                      : BRAND.slate,
      };

      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (!cell.font) {
            cell.font = {
              name: "Arial",
              size: 10,
            } as Partial<Font>;
          } else {
            cell.font = {
              name: "Arial",
              size: 10,
              ...cell.font,
            } as Partial<Font>;
          }
        });
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    await writeAuditLog({
      admin,
      action: "supplier_exported",
      actionLabel: "Supplier workbook exported",
      summary: `Exported styled supplier workbook for ${String(
        supplier.display_name,
      )}.`,
      supplierId,
      route: endpoint.replace("POST ", ""),
      httpMethod: "POST",
      riskLevel: "low",
      afterData: {
        worksheet_count: workbook.worksheets.length,
        stock_item_rows: itemRows.length,
        order_rows: orderRows.length,
        review_rows: reviewRows.length,
        compliance_rows: complianceRows.length,
        audit_rows: auditRows.length,
      },
    });

    const safeName = String(
      supplier.display_name || "supplier",
    )
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          `attachment; filename="${safeName}-supplier-workbook.xlsx"`,
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
      "The full supplier workbook could not be exported.",
    );
  }
}
