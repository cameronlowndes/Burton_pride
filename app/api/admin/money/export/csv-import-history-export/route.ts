import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { requireAdmin } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMPORT_BATCH_TABLES = ["money_import_batches", "money_bank_imports"];
const IMPORT_ROW_TABLES = ["money_bank_import_rows"];

type ImportBatch = Record<string, any>;
type ImportRow = Record<string, any>;

function safeText(value: unknown, fallback = "None") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function safeJson(value: unknown) {
  if (value === null || value === undefined) return "";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function numberValue(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "None";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-GB");
}

function getBatchDate(row: ImportBatch) {
  return (
    row.created_at ||
    row.imported_at ||
    row.uploaded_at ||
    row.started_at ||
    row.completed_at ||
    row.updated_at ||
    null
  );
}

function getRowDate(row: ImportRow) {
  return (
    row.created_at ||
    row.imported_at ||
    row.transaction_date ||
    row.date ||
    row.updated_at ||
    null
  );
}

function isInYear(value: string | null | undefined, year: number) {
  if (!value) return true;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return true;

  return date.getFullYear() === year;
}

function getBatchFileName(row: ImportBatch) {
  return (
    row.file_name ||
    row.filename ||
    row.csv_file_name ||
    row.original_file_name ||
    row.name ||
    "CSV import"
  );
}

function getBatchStatus(row: ImportBatch) {
  const status = String(
    row.status ||
      row.import_status ||
      row.result ||
      row.state ||
      (numberValue(row.failed_rows) > 0 ||
      numberValue(row.failed_count) > 0 ||
      numberValue(row.rows_failed) > 0
        ? "completed_with_errors"
        : "completed")
  );

  if (status === "completed_with_errors") return "Completed with errors";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "processing") return "Processing";
  if (status === "pending") return "Pending";

  return status.replaceAll("_", " ");
}

function getBatchTotalRows(row: ImportBatch) {
  return (
    numberValue(row.total_rows) ||
    numberValue(row.row_count) ||
    numberValue(row.rows_total) ||
    numberValue(row.total) ||
    numberValue(row.imported_rows) + numberValue(row.failed_rows)
  );
}

function getBatchImportedRows(row: ImportBatch) {
  return (
    numberValue(row.imported_rows) ||
    numberValue(row.success_rows) ||
    numberValue(row.successful_rows) ||
    numberValue(row.rows_imported) ||
    numberValue(row.success_count)
  );
}

function getBatchFailedRows(row: ImportBatch) {
  return (
    numberValue(row.failed_rows) ||
    numberValue(row.error_rows) ||
    numberValue(row.rows_failed) ||
    numberValue(row.failed_count) ||
    numberValue(row.error_count)
  );
}

function getBatchSkippedRows(row: ImportBatch) {
  return (
    numberValue(row.skipped_rows) ||
    numberValue(row.rows_skipped) ||
    numberValue(row.skipped_count)
  );
}

function getBatchImporterName(row: ImportBatch) {
  return (
    row.imported_by_name ||
    row.created_by_name ||
    row.actor_name ||
    row.user_name ||
    row.admin_name ||
    row.imported_by ||
    row.created_by ||
    "Unknown user"
  );
}

function getBatchImporterEmail(row: ImportBatch) {
  return (
    row.imported_by_email ||
    row.created_by_email ||
    row.actor_email ||
    row.user_email ||
    row.admin_email ||
    row.email ||
    ""
  );
}

function getBatchErrorText(row: ImportBatch) {
  return (
    row.error_message ||
    row.error ||
    row.errors ||
    row.failed_reason ||
    row.failure_reason ||
    row.notes ||
    ""
  );
}

function getRowBatchId(row: ImportRow) {
  return (
    row.batch_id ||
    row.import_batch_id ||
    row.import_id ||
    row.money_import_batch_id ||
    row.bank_import_id ||
    ""
  );
}

function getRowStatus(row: ImportRow) {
  const status = String(
    row.status ||
      row.import_status ||
      row.result ||
      row.state ||
      (row.error || row.error_message ? "failed" : "imported")
  );

  if (status === "imported") return "Imported";
  if (status === "success") return "Imported";
  if (status === "failed") return "Failed";
  if (status === "skipped") return "Skipped";
  if (status === "pending") return "Pending";

  return status.replaceAll("_", " ");
}

function getRowError(row: ImportRow) {
  return (
    row.error_message ||
    row.error ||
    row.errors ||
    row.failed_reason ||
    row.failure_reason ||
    row.notes ||
    ""
  );
}

function getRowNumber(row: ImportRow) {
  return (
    row.row_number ||
    row.csv_row_number ||
    row.line_number ||
    row.line ||
    row.index ||
    ""
  );
}

function getRowAmount(row: ImportRow) {
  return (
    row.amount ||
    row.amount_pence ||
    row.value ||
    row.transaction_amount ||
    ""
  );
}

function getRowDescription(row: ImportRow) {
  return (
    row.description ||
    row.title ||
    row.payee ||
    row.reference ||
    row.memo ||
    ""
  );
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
    wrapText: true,
  };
}

function addMergedSection(
  worksheet: ExcelJS.Worksheet,
  text: string,
  fromCell: string,
  toCell: string,
  colour = "FF4F46E5"
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

function styleStatusCell(cell: ExcelJS.Cell, status: string) {
  const clean = status.toLowerCase();

  if (clean.includes("failed") || clean.includes("error")) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEE2E2" },
    };

    cell.font = {
      bold: true,
      color: { argb: "FF991B1B" },
    };

    return;
  }

  if (clean.includes("completed") || clean.includes("imported")) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };

    cell.font = {
      bold: true,
      color: { argb: "FF166534" },
    };

    return;
  }

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFEF3C7" },
  };

  cell.font = {
    bold: true,
    color: { argb: "FF92400E" },
  };
}

async function tryLoadTable(tableNames: string[]) {
  const attempts: any[] = [];

  for (const table of tableNames) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .limit(5000);

    if (error) {
      attempts.push({
        table,
        message: error.message,
        hint: error.hint,
        code: error.code,
      });

      continue;
    }

    return {
      table,
      rows: data || [],
      attempts,
    };
  }

  return {
    table: "",
    rows: [],
    attempts,
  };
}

export async function GET(req: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json(
      {
        error: "Unauthorised. Please sign in again.",
      },
      {
        status: 401,
      }
    );
  }

  const url = new URL(req.url);
  const yearValue = url.searchParams.get("year");
  const year = Number(yearValue || new Date().getFullYear());

  if (!Number.isFinite(year)) {
    return NextResponse.json(
      {
        error: "Invalid year. Please select a valid year.",
        details: {
          receivedYear: yearValue,
        },
      },
      {
        status: 400,
      }
    );
  }

  try {
    const selectedYear = String(year);
    const fileDate = new Date().toISOString().slice(0, 10);

    const batchResult = await tryLoadTable(IMPORT_BATCH_TABLES);
    const rowResult = await tryLoadTable(IMPORT_ROW_TABLES);

    if (!batchResult.table && !rowResult.table) {
      return NextResponse.json(
        {
          error: "Could not find any CSV / bank import tables.",
          details: {
            attemptedBatchTables: batchResult.attempts,
            attemptedRowTables: rowResult.attempts,
            likelyFix:
              "Your Supabase hints suggest money_import_batches, money_bank_imports, or money_bank_import_rows. Check these tables exist and are exposed through the Supabase API.",
          },
        },
        {
          status: 500,
        }
      );
    }

    const batchRows = (batchResult.rows || []).filter((row: ImportBatch) =>
      isInYear(getBatchDate(row), year)
    );

    const importRows = (rowResult.rows || []).filter((row: ImportRow) =>
      isInYear(getRowDate(row), year)
    );

    const rowImportedCount = importRows.filter((row) =>
      getRowStatus(row).toLowerCase().includes("imported")
    ).length;

    const rowFailedCount = importRows.filter((row) =>
      getRowStatus(row).toLowerCase().includes("failed")
    ).length;

    const rowSkippedCount = importRows.filter((row) =>
      getRowStatus(row).toLowerCase().includes("skipped")
    ).length;

    const batchTotalRows = batchRows.reduce(
      (sum, row) => sum + getBatchTotalRows(row),
      0
    );

    const batchImportedRows = batchRows.reduce(
      (sum, row) => sum + getBatchImportedRows(row),
      0
    );

    const batchFailedRows = batchRows.reduce(
      (sum, row) => sum + getBatchFailedRows(row),
      0
    );

    const batchSkippedRows = batchRows.reduce(
      (sum, row) => sum + getBatchSkippedRows(row),
      0
    );

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Burton Pride C.I.C";
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.subject = "CSV import history report";
    workbook.title = "Burton Pride CSV Import History";
    workbook.company = "Burton Pride C.I.C";

    const summarySheet = workbook.addWorksheet("CSV Import Summary", {
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
      { key: "label", width: 34 },
      { key: "value", width: 22 },
      { key: "notes", width: 80 },
    ];

    addMergedTitle(
      summarySheet,
      "Burton Pride C.I.C - CSV / Bank Import History",
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

    addMergedSection(summarySheet, "Import Summary", "A4", "C4");

    const summaryHeader = summarySheet.addRow(["Item", "Value", "Notes"]);
    styleHeaderRow(summaryHeader, "FF111827");

    const summaryRows: Array<[string, string | number, string]> = [
      [
        "Batch table used",
        batchResult.table || "None found",
        "Table used for import batches.",
      ],
      [
        "Row table used",
        rowResult.table || "None found",
        "Table used for imported CSV/bank rows.",
      ],
      ["Import batches", batchRows.length, "Number of import batch records."],
      [
        "Imported row records",
        importRows.length,
        "Number of row-level import records.",
      ],
      [
        "Batch total rows",
        batchTotalRows || importRows.length,
        "Total rows based on batch table, or row table if batch total is unavailable.",
      ],
      [
        "Batch imported rows",
        batchImportedRows || rowImportedCount,
        "Imported rows based on batch table, or row status if available.",
      ],
      [
        "Batch failed rows",
        batchFailedRows || rowFailedCount,
        "Failed rows based on batch table, or row status if available.",
      ],
      [
        "Batch skipped rows",
        batchSkippedRows || rowSkippedCount,
        "Skipped rows based on batch table, or row status if available.",
      ],
    ];

    summaryRows.forEach(([label, value, notes]) => {
      const row = summarySheet.addRow([label, value, notes]);
      styleBodyRow(row);
      row.getCell(1).font = { bold: true };
      row.getCell(2).font = { bold: true };
    });

    summarySheet.addRow([]);

    addMergedSection(summarySheet, "Tables Tried", "A15", "C15", "FF334155");

    const triedHeader = summarySheet.addRow(["Type", "Table", "Result"]);
    styleHeaderRow(triedHeader, "FF334155");

    [...batchResult.attempts, ...rowResult.attempts].forEach((attempt) => {
      const row = summarySheet.addRow([
        "Attempted",
        attempt.table,
        `${attempt.code || ""} ${attempt.message || ""} ${
          attempt.hint ? `Hint: ${attempt.hint}` : ""
        }`,
      ]);
      styleBodyRow(row);
    });

    if (batchResult.table) {
      const row = summarySheet.addRow([
        "Used batch table",
        batchResult.table,
        "Loaded successfully.",
      ]);
      styleBodyRow(row);
    }

    if (rowResult.table) {
      const row = summarySheet.addRow([
        "Used row table",
        rowResult.table,
        "Loaded successfully.",
      ]);
      styleBodyRow(row);
    }

    const batchSheet = workbook.addWorksheet("Import Batches", {
      views: [{ state: "frozen", ySplit: 4 }],
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    batchSheet.columns = [
      { key: "date", width: 24 },
      { key: "fileName", width: 34 },
      { key: "status", width: 24 },
      { key: "totalRows", width: 16 },
      { key: "importedRows", width: 16 },
      { key: "failedRows", width: 16 },
      { key: "skippedRows", width: 16 },
      { key: "importer", width: 28 },
      { key: "email", width: 34 },
      { key: "error", width: 60 },
      { key: "id", width: 40 },
    ];

    addMergedTitle(
      batchSheet,
      "Burton Pride C.I.C - Import Batches",
      "A1",
      "K1"
    );

    addMergedSubtitle(
      batchSheet,
      `Year: Jan to Dec ${selectedYear} | Rows: ${batchRows.length} | Table: ${
        batchResult.table || "None"
      }`,
      "A2",
      "K2"
    );

    batchSheet.addRow([]);

    const batchHeader = batchSheet.addRow([
      "Import Date",
      "CSV / Bank File",
      "Status",
      "Total Rows",
      "Imported",
      "Failed",
      "Skipped",
      "Imported By",
      "Email",
      "Error / Notes",
      "Import ID",
    ]);
    styleHeaderRow(batchHeader, "FF4F46E5");

    if (batchRows.length === 0) {
      const row = batchSheet.addRow([
        `No import batch records found for ${selectedYear}.`,
      ]);
      styleBodyRow(row);
    } else {
      batchRows.forEach((item: ImportBatch) => {
        const status = getBatchStatus(item);

        const row = batchSheet.addRow({
          date: formatDate(getBatchDate(item)),
          fileName: getBatchFileName(item),
          status,
          totalRows: getBatchTotalRows(item),
          importedRows: getBatchImportedRows(item),
          failedRows: getBatchFailedRows(item),
          skippedRows: getBatchSkippedRows(item),
          importer: getBatchImporterName(item),
          email: getBatchImporterEmail(item),
          error: safeText(getBatchErrorText(item), ""),
          id: safeText(item.id, ""),
        });

        styleBodyRow(row);
        row.getCell("fileName").font = { bold: true };
        row.getCell("importer").font = { bold: true };
        styleStatusCell(row.getCell("status"), status);
      });
    }

    batchSheet.autoFilter = {
      from: "A4",
      to: "K4",
    };

    const rowsSheet = workbook.addWorksheet("Imported Rows", {
      views: [{ state: "frozen", ySplit: 4 }],
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    rowsSheet.columns = [
      { key: "date", width: 24 },
      { key: "status", width: 20 },
      { key: "rowNumber", width: 16 },
      { key: "description", width: 44 },
      { key: "amount", width: 18 },
      { key: "error", width: 60 },
      { key: "batchId", width: 40 },
      { key: "rowId", width: 40 },
      { key: "raw", width: 90 },
    ];

    addMergedTitle(
      rowsSheet,
      "Burton Pride C.I.C - Imported CSV / Bank Rows",
      "A1",
      "I1"
    );

    addMergedSubtitle(
      rowsSheet,
      `Year: Jan to Dec ${selectedYear} | Rows: ${importRows.length} | Table: ${
        rowResult.table || "None"
      }`,
      "A2",
      "I2"
    );

    rowsSheet.addRow([]);

    const rowsHeader = rowsSheet.addRow([
      "Date",
      "Status",
      "CSV Row",
      "Description / Reference",
      "Amount",
      "Error / Notes",
      "Batch ID",
      "Row ID",
      "Raw Data",
    ]);
    styleHeaderRow(rowsHeader, "FF047857");

    if (importRows.length === 0) {
      const row = rowsSheet.addRow([
        `No row-level import records found for ${selectedYear}.`,
      ]);
      styleBodyRow(row);
    } else {
      importRows.forEach((item: ImportRow) => {
        const status = getRowStatus(item);

        const row = rowsSheet.addRow({
          date: formatDate(getRowDate(item)),
          status,
          rowNumber: getRowNumber(item),
          description: safeText(getRowDescription(item), ""),
          amount: getRowAmount(item),
          error: safeText(getRowError(item), ""),
          batchId: getRowBatchId(item),
          rowId: safeText(item.id, ""),
          raw: safeJson(item),
        });

        styleBodyRow(row);
        styleStatusCell(row.getCell("status"), status);
        row.getCell("description").font = { bold: true };
      });
    }

    rowsSheet.autoFilter = {
      from: "A4",
      to: "I4",
    };

    const rawSheet = workbook.addWorksheet("Raw Debug", {
      views: [{ state: "frozen", ySplit: 4 }],
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    rawSheet.columns = [
      { key: "type", width: 18 },
      { key: "id", width: 40 },
      { key: "createdAt", width: 28 },
      { key: "raw", width: 120 },
    ];

    addMergedTitle(
      rawSheet,
      "Burton Pride C.I.C - Raw CSV / Bank Import Data",
      "A1",
      "D1"
    );

    addMergedSubtitle(
      rawSheet,
      `Batch table: ${batchResult.table || "None"} | Row table: ${
        rowResult.table || "None"
      }`,
      "A2",
      "D2"
    );

    rawSheet.addRow([]);

    const rawHeader = rawSheet.addRow([
      "Type",
      "ID",
      "Created At",
      "Raw Data",
    ]);
    styleHeaderRow(rawHeader, "FF111827");

    batchRows.forEach((item: ImportBatch) => {
      const row = rawSheet.addRow({
        type: "Batch",
        id: safeText(item.id, ""),
        createdAt: formatDate(getBatchDate(item)),
        raw: safeJson(item),
      });

      styleBodyRow(row);
    });

    importRows.forEach((item: ImportRow) => {
      const row = rawSheet.addRow({
        type: "Row",
        id: safeText(item.id, ""),
        createdAt: formatDate(getRowDate(item)),
        raw: safeJson(item),
      });

      styleBodyRow(row);
    });

    rawSheet.autoFilter = {
      from: "A4",
      to: "D4",
    };

    [summarySheet, batchSheet, rowsSheet, rawSheet].forEach((sheet) => {
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.alignment = {
            ...cell.alignment,
            vertical: cell.alignment?.vertical || "top",
            wrapText: true,
          };
        });
      });
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();
    const bytes = new Uint8Array(excelBuffer as ArrayBuffer);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="burton-pride-csv-import-history-${selectedYear}-${fileDate}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("CSV import history export error:", error);

    return NextResponse.json(
      {
        error:
          error?.message || "Failed to create CSV import history export.",
        details: {
          message: error?.message || String(error),
          route: "/api/admin/money/export/csv-import-history-export",
          expectedFile:
            "app/api/admin/money/export/csv-import-history-export/route.ts",
          likelyFix:
            "This route now checks money_import_batches, money_bank_imports and money_bank_import_rows. If your real table names are different, update IMPORT_BATCH_TABLES and IMPORT_ROW_TABLES at the top of this file.",
          raw: error?.details || null,
        },
      },
      {
        status: 500,
      }
    );
  }
}