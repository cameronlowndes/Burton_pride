import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function money(pence: number | null | undefined) {
  return Number(pence || 0) / 100;
}

function addTitle(sheet: ExcelJS.Worksheet, title: string) {
  sheet.mergeCells("A1:H1");

  const cell = sheet.getCell("A1");
  cell.value = title;
  cell.font = {
    bold: true,
    size: 16,
  };
  cell.alignment = {
    vertical: "middle",
  };

  sheet.getRow(1).height = 25;
}

function styleHeader(row: ExcelJS.Row) {
  row.font = {
    bold: true,
  };

  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FFE5E7EB",
      },
    };

    cell.border = {
      top: {
        style: "thin",
      },
      bottom: {
        style: "thin",
      },
      left: {
        style: "thin",
      },
      right: {
        style: "thin",
      },
    };
  });
}

function autoWidth(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((column) => {
    column.width = 24;
  });
}

async function createWorkbookArrayBuffer(workbook: ExcelJS.Workbook) {
  return workbook.xlsx.writeBuffer();
}

function jsonText(value: unknown) {
  if (!value) return "";

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

export async function GET(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      {
        error: "Unauthorised",
      },
      {
        status: 401,
      }
    );
  }

  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  const year = Number(yearParam || new Date().getFullYear());

  if (!Number.isFinite(year)) {
    return NextResponse.json(
      {
        error: "Invalid year",
      },
      {
        status: 400,
      }
    );
  }

  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-01-01`;

  try {
    const zip = new JSZip();

    const [
      transactionsResult,
      sponsorsResult,
      auditLogsResult,
      csvImportsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("money_transactions")
        .select("*")
        .gte("transaction_date", startDate)
        .lt("transaction_date", endDate)
        .is("deleted_at", null)
        .order("transaction_date", {
          ascending: true,
        }),

      supabaseAdmin
        .from("money_sponsors")
        .select("*")
        .order("created_at", {
          ascending: true,
        }),

      supabaseAdmin
        .from("money_audit_logs")
        .select("*")
        .gte("created_at", startDate)
        .lt("created_at", endDate)
        .order("created_at", {
          ascending: true,
        }),

      supabaseAdmin
        .from("money_csv_import_history")
        .select("*")
        .gte("created_at", startDate)
        .lt("created_at", endDate)
        .order("created_at", {
          ascending: true,
        }),
    ]);

    if (transactionsResult.error) {
      return NextResponse.json(
        {
          error: transactionsResult.error.message,
        },
        {
          status: 500,
        }
      );
    }

    if (sponsorsResult.error) {
      return NextResponse.json(
        {
          error: sponsorsResult.error.message,
        },
        {
          status: 500,
        }
      );
    }

    const transactions = transactionsResult.data || [];
    const sponsors = sponsorsResult.data || [];
    const auditLogs = auditLogsResult.data || [];
    const csvImports = csvImportsResult.data || [];

    const incomePence = transactions
      .filter((item: any) => item.type === "income")
      .reduce(
        (sum: number, item: any) => sum + Number(item.amount_pence || 0),
        0
      );

    const expensePence = transactions
      .filter((item: any) => item.type === "expense")
      .reduce(
        (sum: number, item: any) => sum + Number(item.amount_pence || 0),
        0
      );

    const personalFundsPence = transactions
      .filter((item: any) => item.is_personal_funds)
      .reduce(
        (sum: number, item: any) => sum + Number(item.amount_pence || 0),
        0
      );

    const repaidPersonalFundsPence = transactions
      .filter(
        (item: any) => item.is_personal_funds && item.personal_funds_repaid
      )
      .reduce(
        (sum: number, item: any) => sum + Number(item.amount_pence || 0),
        0
      );

    const balancePence = incomePence - expensePence;

    /**
     * 1. YEARLY REPORT
     */
    const yearlyWorkbook = new ExcelJS.Workbook();
    yearlyWorkbook.creator = "Burton Pride Money Tracker";
    yearlyWorkbook.created = new Date();

    const yearlySheet = yearlyWorkbook.addWorksheet("Yearly Report");

    addTitle(yearlySheet, `Burton Pride Accountant Yearly Report - ${year}`);

    yearlySheet.addRow([]);
    yearlySheet.addRow(["Section", "Amount"]);
    styleHeader(yearlySheet.getRow(3));

    yearlySheet.addRow(["Total income", money(incomePence)]);
    yearlySheet.addRow(["Total expenses", money(expensePence)]);
    yearlySheet.addRow(["Year balance", money(balancePence)]);
    yearlySheet.addRow(["Personal funds used", money(personalFundsPence)]);
    yearlySheet.addRow([
      "Personal funds repaid",
      money(repaidPersonalFundsPence),
    ]);
    yearlySheet.addRow([
      "Personal funds outstanding",
      money(personalFundsPence - repaidPersonalFundsPence),
    ]);

    yearlySheet.getColumn(1).width = 35;
    yearlySheet.getColumn(2).width = 18;
    yearlySheet.getColumn(2).numFmt = "£#,##0.00";

    zip.file(
      `01-yearly-report-${year}.xlsx`,
      await createWorkbookArrayBuffer(yearlyWorkbook)
    );

    /**
     * 2. TRANSACTION LIST
     */
    const transactionsWorkbook = new ExcelJS.Workbook();
    transactionsWorkbook.creator = "Burton Pride Money Tracker";
    transactionsWorkbook.created = new Date();

    const transactionSheet = transactionsWorkbook.addWorksheet("Transactions");

    addTitle(transactionSheet, `Transaction List - ${year}`);

    transactionSheet.addRow([]);
    transactionSheet.addRow([
      "Date",
      "Title",
      "Description",
      "Type",
      "Category",
      "Payment Method",
      "Amount",
      "Sponsor",
      "Personal Funds",
      "Paid Back",
      "Receipt",
      "Created At",
    ]);

    styleHeader(transactionSheet.getRow(3));

    transactions.forEach((item: any) => {
      transactionSheet.addRow([
        item.transaction_date || "",
        item.title || "",
        item.description || "",
        item.type || "",
        item.category || "",
        item.payment_method || "",
        money(item.amount_pence),
        item.sponsor_name || "",
        item.is_personal_funds ? item.personal_funds_name || "Yes" : "No",
        item.personal_funds_repaid ? "Yes" : "No",
        item.invoice_image_url || "",
        item.created_at || "",
      ]);
    });

    autoWidth(transactionSheet);
    transactionSheet.getColumn(7).numFmt = "£#,##0.00";

    zip.file(
      `02-transaction-list-${year}.xlsx`,
      await createWorkbookArrayBuffer(transactionsWorkbook)
    );

    /**
     * 3. RECEIPTS INDEX
     */
    const receiptsWorkbook = new ExcelJS.Workbook();
    receiptsWorkbook.creator = "Burton Pride Money Tracker";
    receiptsWorkbook.created = new Date();

    const receiptSheet = receiptsWorkbook.addWorksheet("Receipts");

    addTitle(receiptSheet, `Receipts Index - ${year}`);

    receiptSheet.addRow([]);
    receiptSheet.addRow([
      "Date",
      "Transaction",
      "Amount",
      "Receipt URL / File",
      "Notes",
    ]);

    styleHeader(receiptSheet.getRow(3));

    const receiptTransactions = transactions.filter(
      (item: any) => item.invoice_image_url
    );

    receiptTransactions.forEach((item: any) => {
      receiptSheet.addRow([
        item.transaction_date || "",
        item.title || "",
        money(item.amount_pence),
        item.invoice_image_url || "",
        item.description || "",
      ]);
    });

    autoWidth(receiptSheet);
    receiptSheet.getColumn(3).numFmt = "£#,##0.00";

    zip.file(
      `03-receipts-index-${year}.xlsx`,
      await createWorkbookArrayBuffer(receiptsWorkbook)
    );

    /**
     * 4. AUDIT LOGS
     */
    const auditWorkbook = new ExcelJS.Workbook();
    auditWorkbook.creator = "Burton Pride Money Tracker";
    auditWorkbook.created = new Date();

    const auditSheet = auditWorkbook.addWorksheet("Audit Logs");

    addTitle(auditSheet, `Audit Logs - ${year}`);

    auditSheet.addRow([]);
    auditSheet.addRow([
      "Created At",
      "Action",
      "Actor Name",
      "Actor Email",
      "Transaction ID",
      "Transaction Title",
      "Before Data",
      "After Data",
      "Changed Fields",
      "Metadata",
    ]);

    styleHeader(auditSheet.getRow(3));

    auditLogs.forEach((log: any) => {
      auditSheet.addRow([
        log.created_at || "",
        log.action || "",
        log.actor_name || "",
        log.actor_email || "",
        log.transaction_id || "",
        log.transaction_title || "",
        jsonText(log.before_data),
        jsonText(log.after_data),
        jsonText(log.changed_fields),
        jsonText(log.metadata),
      ]);
    });

    autoWidth(auditSheet);

    zip.file(
      `04-audit-logs-${year}.xlsx`,
      await createWorkbookArrayBuffer(auditWorkbook)
    );

    /**
     * 5. FUNDING / SPONSOR BREAKDOWN
     */
    const fundingWorkbook = new ExcelJS.Workbook();
    fundingWorkbook.creator = "Burton Pride Money Tracker";
    fundingWorkbook.created = new Date();

    const fundingSheet = fundingWorkbook.addWorksheet("Funding Breakdown");

    addTitle(fundingSheet, `Funding Breakdown - ${year}`);

    fundingSheet.addRow([]);
    fundingSheet.addRow([
      "Sponsor / Funding Name",
      "Agreed Amount",
      "Received",
      "Spent",
      "Remaining",
      "Notes",
      "Active",
    ]);

    styleHeader(fundingSheet.getRow(3));

    sponsors.forEach((sponsor: any) => {
      const sponsorTransactions = transactions.filter((item: any) => {
        if (item.sponsor_id && sponsor.id) {
          return item.sponsor_id === sponsor.id;
        }

        if (item.sponsor_name && sponsor.sponsor_name) {
          return (
            String(item.sponsor_name).toLowerCase().trim() ===
            String(sponsor.sponsor_name).toLowerCase().trim()
          );
        }

        return false;
      });

      const received = sponsorTransactions
        .filter((item: any) => item.type === "income")
        .reduce(
          (sum: number, item: any) => sum + Number(item.amount_pence || 0),
          0
        );

      const spent = sponsorTransactions
        .filter((item: any) => item.type === "expense")
        .reduce(
          (sum: number, item: any) => sum + Number(item.amount_pence || 0),
          0
        );

      const agreed = Number(sponsor.agreed_amount_pence || 0);
      const remaining = received - spent;

      fundingSheet.addRow([
        sponsor.sponsor_name || "",
        money(agreed),
        money(received),
        money(spent),
        money(remaining),
        sponsor.notes || "",
        sponsor.is_active ? "Yes" : "No",
      ]);
    });

    autoWidth(fundingSheet);

    fundingSheet.getColumn(2).numFmt = "£#,##0.00";
    fundingSheet.getColumn(3).numFmt = "£#,##0.00";
    fundingSheet.getColumn(4).numFmt = "£#,##0.00";
    fundingSheet.getColumn(5).numFmt = "£#,##0.00";

    zip.file(
      `05-funding-breakdown-${year}.xlsx`,
      await createWorkbookArrayBuffer(fundingWorkbook)
    );

    /**
     * 6. PERSONAL FUNDS REPORT
     */
    const personalWorkbook = new ExcelJS.Workbook();
    personalWorkbook.creator = "Burton Pride Money Tracker";
    personalWorkbook.created = new Date();

    const personalSheet = personalWorkbook.addWorksheet("Personal Funds");

    addTitle(personalSheet, `Personal Funds Report - ${year}`);

    personalSheet.addRow([]);
    personalSheet.addRow([
      "Date",
      "Person",
      "Title",
      "Amount",
      "Paid Back",
      "Paid Back At",
      "Notes",
    ]);

    styleHeader(personalSheet.getRow(3));

    transactions
      .filter((item: any) => item.is_personal_funds)
      .forEach((item: any) => {
        personalSheet.addRow([
          item.transaction_date || "",
          item.personal_funds_name || "",
          item.title || "",
          money(item.amount_pence),
          item.personal_funds_repaid ? "Yes" : "No",
          item.personal_funds_repaid_at || "",
          item.description || "",
        ]);
      });

    autoWidth(personalSheet);
    personalSheet.getColumn(4).numFmt = "£#,##0.00";

    zip.file(
      `06-personal-funds-report-${year}.xlsx`,
      await createWorkbookArrayBuffer(personalWorkbook)
    );

    /**
     * 7. CSV IMPORT HISTORY
     */
    const csvWorkbook = new ExcelJS.Workbook();
    csvWorkbook.creator = "Burton Pride Money Tracker";
    csvWorkbook.created = new Date();

    const csvSheet = csvWorkbook.addWorksheet("CSV Import History");

    addTitle(csvSheet, `CSV Import History - ${year}`);

    csvSheet.addRow([]);
    csvSheet.addRow([
      "Created At",
      "File Name",
      "Imported By",
      "Status",
      "Rows Total",
      "Rows Imported",
      "Rows Failed",
      "Error Notes",
    ]);

    styleHeader(csvSheet.getRow(3));

    csvImports.forEach((item: any) => {
      csvSheet.addRow([
        item.created_at || "",
        item.file_name || "",
        item.imported_by_name || item.imported_by_email || "",
        item.status || "",
        item.rows_total ?? "",
        item.rows_imported ?? "",
        item.rows_failed ?? "",
        item.error_notes || item.error_message || "",
      ]);
    });

    autoWidth(csvSheet);

    zip.file(
      `07-csv-import-history-${year}.xlsx`,
      await createWorkbookArrayBuffer(csvWorkbook)
    );

    /**
     * Accountant README
     */
    zip.file(
      `README-${year}.txt`,
      [
        `Burton Pride C.I.C Accountant Export Pack`,
        ``,
        `Year: ${year}`,
        `Generated: ${new Date().toISOString()}`,
        ``,
        `Included files:`,
        `01-yearly-report-${year}.xlsx`,
        `02-transaction-list-${year}.xlsx`,
        `03-receipts-index-${year}.xlsx`,
        `04-audit-logs-${year}.xlsx`,
        `05-funding-breakdown-${year}.xlsx`,
        `06-personal-funds-report-${year}.xlsx`,
        `07-csv-import-history-${year}.xlsx`,
        ``,
        `Notes:`,
        `Receipts are listed by their stored receipt URL or file path.`,
        `Audit logs are included for transparency and accountant checking.`,
        `Funding breakdown is calculated from sponsor/funding linked transactions.`,
        `Personal funds report shows money paid by people and whether it has been repaid.`,
      ].join("\n")
    );

    /**
     * IMPORTANT:
     * Use arraybuffer here, not nodebuffer.
     * This fixes:
     * Argument of type 'Buffer<ArrayBufferLike>' is not assignable to parameter of type 'BodyInit'
     */
    const zipArrayBuffer = await zip.generateAsync({
      type: "arraybuffer",
    });

    return new NextResponse(zipArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="burton-pride-accountant-export-pack-${year}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Accountant export pack error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Failed to create accountant export pack.",
      },
      {
        status: 500,
      }
    );
  }
}