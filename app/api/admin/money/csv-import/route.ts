import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createMoneyAuditLog } from "@/lib/money/adminMoneyAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CsvImportType = "income" | "expense";

type CsvImportRow = {
  import?: boolean;
  selected?: boolean;

  title?: string | null;
  description?: string | null;
  type?: CsvImportType | string | null;
  category?: string | null;

  amount?: string | number | null;
  amountPence?: number | null;
  amount_pence?: number | null;

  paymentMethod?: string | null;
  payment_method?: string | null;

  transactionDate?: string | null;
  transaction_date?: string | null;

  bankStatementDate?: string | null;
  bank_statement_date?: string | null;

  bankStatementDescription?: string | null;
  bank_statement_description?: string | null;

  isPersonalFunds?: boolean | null;
  is_personal_funds?: boolean | null;
  personalFundsName?: string | null;
  personal_funds_name?: string | null;

  sponsorId?: string | null;
  sponsor_id?: string | null;
  sponsorName?: string | null;
  sponsor_name?: string | null;
  sponsorshipNote?: string | null;
  sponsorship_note?: string | null;

  originalRow?: any;
  csv_original_row?: any;
};

type CsvImportRequestBody = {
  rows?: CsvImportRow[];
  transactions?: CsvImportRow[];
  importedBy?: string | null;
  notes?: string | null;
};

type Actor = {
  userId: string | null;
  name: string;
  email: string | null;
};

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function formatNameFromEmail(email?: string | null) {
  const cleanEmail = cleanString(email);

  if (!cleanEmail || !cleanEmail.includes("@")) {
    return null;
  }

  const username = cleanEmail.split("@")[0] || "";

  const name = username
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();

  return name || null;
}

async function getActor(): Promise<Actor> {
  try {
    const user = await currentUser();

    const actorEmail =
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      null;

    const actorName =
      user?.fullName ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      formatNameFromEmail(actorEmail) ||
      "Unknown admin";

    return {
      userId: user?.id || null,
      name: actorName.trim() || "Unknown admin",
      email: actorEmail,
    };
  } catch {
    return {
      userId: null,
      name: "Unknown admin",
      email: null,
    };
  }
}

function parseAmountToPence(row: CsvImportRow) {
  const directPence = row.amountPence ?? row.amount_pence;

  if (typeof directPence === "number" && Number.isFinite(directPence)) {
    return Math.round(Math.abs(directPence));
  }

  const rawAmount = cleanString(row.amount)
    .replace("£", "")
    .replaceAll(",", "")
    .trim();

  if (!rawAmount) return 0;

  const numberAmount = Number(rawAmount);

  if (!Number.isFinite(numberAmount)) return 0;

  return Math.round(Math.abs(numberAmount) * 100);
}

function normaliseDate(value: unknown) {
  const raw = cleanString(value);

  if (!raw) return null;

  // Already yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  // UK dd/mm/yyyy or dd-mm-yyyy
  const ukMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);

  if (ukMatch) {
    const day = ukMatch[1].padStart(2, "0");
    const month = ukMatch[2].padStart(2, "0");
    const year =
      ukMatch[3].length === 2 ? `20${ukMatch[3]}` : ukMatch[3].padStart(4, "0");

    return `${year}-${month}-${day}`;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

function getTransactionYear(dateValue: string | null) {
  if (!dateValue) return new Date().getFullYear().toString();

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return new Date().getFullYear().toString();
  }

  return date.getFullYear().toString();
}

async function isYearLocked(year: string) {
  const { data, error } = await supabaseAdmin
    .from("money_year_locks")
    .select("year,is_locked")
    .eq("year", year)
    .eq("is_locked", true)
    .maybeSingle();

  if (error) {
    console.error("CSV import year lock check failed:", error);
    return false;
  }

  return Boolean(data?.is_locked);
}

function makeTransactionReference(index: number) {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  const rowPart = String(index + 1).padStart(3, "0");

  return `CSV-${datePart}-${rowPart}-${randomPart}`;
}

function getRowOriginalData(row: CsvImportRow) {
  return row.originalRow || row.csv_original_row || row;
}

function buildPayload(row: CsvImportRow, index: number, batchId: string) {
  const type = row.type === "expense" ? "expense" : "income";
  const amountPence = parseAmountToPence(row);

  const transactionDate =
    normaliseDate(row.transactionDate || row.transaction_date) ||
    normaliseDate(row.bankStatementDate || row.bank_statement_date) ||
    new Date().toISOString().slice(0, 10);

  const bankStatementDate =
    normaliseDate(row.bankStatementDate || row.bank_statement_date) ||
    transactionDate;

  const bankDescription =
    cleanString(
      row.bankStatementDescription ||
        row.bank_statement_description ||
        row.description ||
        row.title,
    ) || null;

  const title =
    cleanString(row.title) ||
    bankDescription ||
    `CSV imported transaction ${index + 1}`;

  const paymentMethod =
    cleanString(row.paymentMethod || row.payment_method) || "Bank Transfer";

  const isPersonalFunds = Boolean(row.isPersonalFunds || row.is_personal_funds);

  const sponsorId = cleanString(row.sponsorId || row.sponsor_id) || null;
  const sponsorName = cleanString(row.sponsorName || row.sponsor_name) || null;
  const sponsorshipNote =
    cleanString(row.sponsorshipNote || row.sponsorship_note) || null;

  const hasFunding = Boolean(sponsorId || sponsorName || sponsorshipNote);

  return {
    transaction_reference: makeTransactionReference(index),
    title,
    description: cleanString(row.description) || bankDescription || null,
    type,
    category: cleanString(row.category) || (hasFunding ? "Sponsorship" : null),
    amount_pence: amountPence,
    payment_method: hasFunding ? "Sponsorship Money" : paymentMethod,
    transaction_date: transactionDate,
    invoice_image_url: null,

    is_personal_funds: hasFunding ? false : isPersonalFunds,
    personal_funds_name: hasFunding
      ? null
      : cleanString(row.personalFundsName || row.personal_funds_name) || null,
    personal_funds_repaid: false,
    personal_funds_repaid_at: null,

    sponsor_id: sponsorId,
    sponsor_name: sponsorName,
    sponsorship_note: sponsorshipNote,

    source: hasFunding ? "sponsorship" : "manual",

    import_source: "bank_csv",
    import_batch_id: batchId,
    bank_statement_description: bankDescription,
    bank_statement_date: bankStatementDate,
    csv_original_row: getRowOriginalData(row),
  };
}

export async function POST(req: Request) {
  try {
    const actor = await getActor();
    const body = (await req.json()) as CsvImportRequestBody;

    const rows = Array.isArray(body.rows)
      ? body.rows
      : Array.isArray(body.transactions)
        ? body.transactions
        : [];

    const selectedRows = rows.filter((row) => {
      if (row.import === false) return false;
      if (row.selected === false) return false;
      return true;
    });

    if (selectedRows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No CSV rows were selected for import.",
        },
        { status: 400 },
      );
    }

    const batchId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `csv-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const importedTransactions: any[] = [];
    const failedRows: any[] = [];

    for (let index = 0; index < selectedRows.length; index += 1) {
      const row = selectedRows[index];

      try {
        const payload = buildPayload(row, index, batchId);

        if (!payload.title) {
          throw new Error("Missing transaction title.");
        }

        if (!payload.amount_pence || payload.amount_pence <= 0) {
          throw new Error("Missing or invalid amount.");
        }

        if (payload.type !== "income" && payload.type !== "expense") {
          throw new Error("Transaction type must be income or expense.");
        }

        const year = getTransactionYear(payload.transaction_date);
        const locked = await isYearLocked(year);

        if (locked) {
          throw new Error(
            `${year} is locked. Unlock this year before importing CSV transactions.`,
          );
        }

        const { data, error } = await supabaseAdmin
          .from("money_transactions")
          .insert(payload)
          .select("*")
          .single();

        if (error) {
          throw new Error(error.message);
        }

        importedTransactions.push(data);

        await createMoneyAuditLog({
          action: "create",
          transactionId: data?.id || null,
          transactionTitle: data?.title || payload.title,
          beforeData: null,
          afterData: data,
          changedFields: {
            csv_import: {
              before: null,
              after: "Imported from bank statement CSV",
            },
            amount_pence: {
              before: null,
              after: payload.amount_pence,
            },
            transaction_date: {
              before: null,
              after: payload.transaction_date,
            },
            import_batch_id: {
              before: null,
              after: batchId,
            },
          },
          metadata: {
            source: "money_tracker",
            route: "/api/admin/money/csv-import",
            audit_event: "csv_import",
            import_batch_id: batchId,
            imported_by: actor.name,
            imported_by_email: actor.email,
            imported_by_user_id: actor.userId,
            csv_row_index: index,
            bank_statement_date: payload.bank_statement_date,
            bank_statement_description: payload.bank_statement_description,
          },
        });
      } catch (rowError: any) {
        failedRows.push({
          index,
          row,
          error: rowError?.message || "Failed to import this row.",
        });
      }
    }

    if (importedTransactions.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No transactions were imported.",
          batchId,
          imported: [],
          failedRows,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      batchId,
      importedCount: importedTransactions.length,
      failedCount: failedRows.length,
      imported: importedTransactions,
      failedRows,
      message:
        failedRows.length > 0
          ? `${importedTransactions.length} transaction(s) imported. ${failedRows.length} row(s) failed.`
          : `${importedTransactions.length} transaction(s) imported successfully.`,
    });
  } catch (err) {
    console.error("CSV import error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 },
    );
  }
}