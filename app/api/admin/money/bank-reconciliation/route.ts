import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BankImportRowStatus =
  | "unmatched"
  | "matched"
  | "possible_match"
  | "ignored"
  | "needs_review";

type BankCsvRow = {
  row_number: number;
  transaction_date: string | null;
  description: string;
  amount_pence: number;
  money_in_pence: number;
  money_out_pence: number;
  balance_pence: number | null;
  reference: string | null;
  raw: Record<string, string>;
};

type MatchCandidate = {
  transaction_id: string;
  transaction_reference: string | null;
  title: string | null;
  transaction_date: string | null;
  amount_pence: number;
  type: string | null;
  payment_method: string | null;
  confidence: "high" | "medium" | "low";
  score: number;
  reasons: string[];
};

function jsonError(message: string, details?: unknown, status = 500) {
  return NextResponse.json(
    {
      error: message,
      details:
        details instanceof Error
          ? details.message
          : typeof details === "string"
            ? details
            : details || null,
    },
    { status },
  );
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function normalise(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMoneyToPence(value: unknown) {
  const raw = cleanText(value);

  if (!raw) return 0;

  const isNegative =
    raw.includes("(") ||
    raw.includes(")") ||
    raw.trim().startsWith("-");

  const cleaned = raw
    .replace(/[£$,]/g, "")
    .replace(/[()]/g, "")
    .replace(/[^\d.-]/g, "");

  const numberValue = Number(cleaned);

  if (!Number.isFinite(numberValue)) return 0;

  const pence = Math.round(Math.abs(numberValue) * 100);

  return isNegative ? -pence : pence;
}

function parseDate(value: unknown) {
  const raw = cleanText(value);

  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const ukMatch = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (ukMatch) {
    const day = ukMatch[1].padStart(2, "0");
    const month = ukMatch[2].padStart(2, "0");
    const year =
      ukMatch[3].length === 2 ? `20${ukMatch[3]}` : ukMatch[3];

    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString().slice(0, 10);
}

function getUserName(user: Awaited<ReturnType<typeof currentUser>>) {
  if (!user) return "Unknown user";

  const fullName = `${user.firstName || ""} ${user.lastName || ""}`
    .replace(/\s+/g, " ")
    .trim();

  if (fullName) return fullName;

  const email = user.emailAddresses?.[0]?.emailAddress || "";

  if (email) {
    return email
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .trim();
  }

  return "Unknown user";
}

function getUserEmail(user: Awaited<ReturnType<typeof currentUser>>) {
  return user?.emailAddresses?.[0]?.emailAddress || null;
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);

  return result.map((value) => value.trim());
}

function parseCsv(csvText: string) {
  const cleanCsv = csvText.replace(/^\uFEFF/, "");
  const lines = cleanCsv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one bank row.");
  }

  const headers = splitCsvLine(lines[0]).map((header) => normalise(header));

  return lines.slice(1).map((line, rowIndex) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    return {
      row_number: rowIndex + 2,
      raw: row,
    };
  });
}

function firstValue(row: Record<string, string>, possibleHeaders: string[]) {
  for (const header of possibleHeaders) {
    const normalisedHeader = normalise(header);

    if (row[normalisedHeader]) {
      return row[normalisedHeader];
    }
  }

  return "";
}

function parseBankRows(csvText: string): BankCsvRow[] {
  const parsedRows = parseCsv(csvText);

  return parsedRows.map(({ row_number, raw }) => {
    const dateValue = firstValue(raw, [
      "date",
      "transaction date",
      "posted date",
      "payment date",
      "date paid",
    ]);

    const description =
      firstValue(raw, [
        "description",
        "details",
        "transaction description",
        "narrative",
        "name",
        "payee",
        "reference",
      ]) || "Bank transaction";

    const reference =
      firstValue(raw, [
        "reference",
        "ref",
        "transaction reference",
        "payment reference",
        "bank reference",
      ]) || null;

    const moneyInValue = firstValue(raw, [
      "money in",
      "paid in",
      "credit",
      "credits",
      "in",
      "income",
      "amount in",
    ]);

    const moneyOutValue = firstValue(raw, [
      "money out",
      "paid out",
      "debit",
      "debits",
      "out",
      "expense",
      "amount out",
    ]);

    const amountValue = firstValue(raw, [
      "amount",
      "transaction amount",
      "value",
    ]);

    const balanceValue = firstValue(raw, [
      "balance",
      "running balance",
      "account balance",
    ]);

    const moneyInPence = Math.abs(parseMoneyToPence(moneyInValue));
    const moneyOutPence = Math.abs(parseMoneyToPence(moneyOutValue));

    let amountPence = parseMoneyToPence(amountValue);

    if (!amountPence && moneyInPence) {
      amountPence = moneyInPence;
    }

    if (!amountPence && moneyOutPence) {
      amountPence = -moneyOutPence;
    }

    return {
      row_number,
      transaction_date: parseDate(dateValue),
      description: cleanText(description),
      amount_pence: amountPence,
      money_in_pence: amountPence > 0 ? Math.abs(amountPence) : moneyInPence,
      money_out_pence:
        amountPence < 0 ? Math.abs(amountPence) : moneyOutPence,
      balance_pence: balanceValue ? parseMoneyToPence(balanceValue) : null,
      reference: reference ? cleanText(reference) : null,
      raw,
    };
  });
}

function daysBetween(dateA?: string | null, dateB?: string | null) {
  if (!dateA || !dateB) return 9999;

  const first = new Date(dateA);
  const second = new Date(dateB);

  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) {
    return 9999;
  }

  const diff = Math.abs(first.getTime() - second.getTime());

  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function calculateCandidateScore(row: BankCsvRow, transaction: any) {
  const rowAbsAmount = Math.abs(row.amount_pence);
  const transactionAmount = Math.abs(Number(transaction.amount_pence || 0));

  let score = 0;
  const reasons: string[] = [];

  if (rowAbsAmount && rowAbsAmount === transactionAmount) {
    score += 50;
    reasons.push("Amount matches exactly");
  }

  const dateDiff = daysBetween(row.transaction_date, transaction.transaction_date);

  if (dateDiff === 0) {
    score += 25;
    reasons.push("Date matches exactly");
  } else if (dateDiff <= 2) {
    score += 15;
    reasons.push(`Date is within ${dateDiff} day${dateDiff === 1 ? "" : "s"}`);
  } else if (dateDiff <= 7) {
    score += 7;
    reasons.push("Date is within 7 days");
  }

  const rowText = normalise(`${row.description} ${row.reference || ""}`);
  const transactionText = normalise(
    `${transaction.title || ""} ${transaction.description || ""} ${
      transaction.transaction_reference || ""
    } ${transaction.sponsor_name || ""}`,
  );

  const rowWords = rowText.split(" ").filter((word) => word.length >= 4);
  const matchingWords = rowWords.filter((word) =>
    transactionText.includes(word),
  );

  if (matchingWords.length > 0) {
    score += Math.min(20, matchingWords.length * 5);
    reasons.push(`Text match: ${matchingWords.slice(0, 4).join(", ")}`);
  }

  const rowType = row.amount_pence >= 0 ? "income" : "expense";

  if (transaction.type === rowType) {
    score += 10;
    reasons.push("Money in/out type matches");
  }

  let confidence: MatchCandidate["confidence"] = "low";

  if (score >= 75) confidence = "high";
  else if (score >= 45) confidence = "medium";

  return {
    score,
    confidence,
    reasons,
  };
}

async function writeAuditLog({
  action,
  userId,
  userName,
  userEmail,
  metadata,
}: {
  action: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  metadata: any;
}) {
  try {
    await supabaseAdmin.from("money_audit_logs").insert({
      action,
      actor_user_id: userId,
      actor_name: userName,
      actor_email: userEmail,
      metadata,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Bank reconciliation audit log failed:", error);
  }
}

async function getSignedInUser() {
  const user = await currentUser();

  if (!user?.id) {
    throw new Error("You must be signed in to use bank reconciliation.");
  }

  return {
    user,
    userId: user.id,
    userName: getUserName(user),
    userEmail: getUserEmail(user),
  };
}

async function getImportRows(importId: string) {
  const { data, error } = await supabaseAdmin
    .from("money_bank_import_rows")
    .select("*")
    .eq("import_id", importId)
    .order("row_number", { ascending: true });

  if (error) throw error;

  return data || [];
}

async function findCandidatesForRows(rows: any[], year?: string | null) {
  const dates = rows
    .map((row) => row.transaction_date)
    .filter(Boolean)
    .sort();

  const firstDate = dates[0] || `${year || new Date().getFullYear()}-01-01`;
  const lastDate =
    dates[dates.length - 1] || `${year || new Date().getFullYear()}-12-31`;

  const start = new Date(firstDate);
  start.setDate(start.getDate() - 14);

  const end = new Date(lastDate);
  end.setDate(end.getDate() + 14);

  let query = supabaseAdmin
    .from("money_transactions")
    .select(
      "id, transaction_reference, title, description, type, amount_pence, transaction_date, payment_method, sponsor_name, bank_reconciliation_status, deleted_at",
    )
    .is("deleted_at", null)
    .gte("transaction_date", start.toISOString().slice(0, 10))
    .lte("transaction_date", end.toISOString().slice(0, 10));

  const { data: transactions, error } = await query;

  if (error) throw error;

  const activeTransactions = transactions || [];

  return rows.map((row) => {
    const bankRow: BankCsvRow = {
      row_number: row.row_number,
      transaction_date: row.transaction_date,
      description: row.description || "",
      amount_pence: Number(row.amount_pence || 0),
      money_in_pence: Number(row.money_in_pence || 0),
      money_out_pence: Number(row.money_out_pence || 0),
      balance_pence: row.balance_pence,
      reference: row.reference || null,
      raw: row.raw || {},
    };

    const candidates: MatchCandidate[] = activeTransactions
      .map((transaction) => {
        const result = calculateCandidateScore(bankRow, transaction);

        return {
          transaction_id: transaction.id,
          transaction_reference: transaction.transaction_reference,
          title: transaction.title,
          transaction_date: transaction.transaction_date,
          amount_pence: Number(transaction.amount_pence || 0),
          type: transaction.type,
          payment_method: transaction.payment_method,
          confidence: result.confidence,
          score: result.score,
          reasons: result.reasons,
        };
      })
      .filter((candidate) => candidate.score >= 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      ...row,
      candidates,
    };
  });
}

export async function GET(request: Request) {
  try {
    await getSignedInUser();

    const url = new URL(request.url);
    const importId = url.searchParams.get("importId");

    if (importId) {
      const rows = await getImportRows(importId);

      const { data: bankImport, error: importError } = await supabaseAdmin
        .from("money_bank_imports")
        .select("*")
        .eq("id", importId)
        .maybeSingle();

      if (importError) throw importError;

      const rowsWithCandidates = await findCandidatesForRows(
        rows,
        bankImport?.year,
      );

      return NextResponse.json({
        import: bankImport || null,
        rows: rowsWithCandidates,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("money_bank_imports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({
      imports: data || [],
    });
  } catch (error) {
    return jsonError("Failed to load bank reconciliation data.", error);
  }
}

export async function POST(request: Request) {
  try {
    const { userId, userName, userEmail } = await getSignedInUser();

    const formData = await request.formData();

    const file = formData.get("file");
    const year = cleanText(formData.get("year")) || String(new Date().getFullYear());
    const sourceName = cleanText(formData.get("source_name")) || "Bank statement";

    if (!(file instanceof File)) {
      return jsonError("Please upload a CSV bank statement file.", null, 400);
    }

    const csvText = await file.text();
    const parsedRows = parseBankRows(csvText);

    if (parsedRows.length === 0) {
      return jsonError("No bank rows were found in this CSV.", null, 400);
    }

    const totalMoneyIn = parsedRows.reduce(
      (sum, row) => sum + Math.max(0, row.amount_pence),
      0,
    );

    const totalMoneyOut = parsedRows.reduce(
      (sum, row) => sum + Math.abs(Math.min(0, row.amount_pence)),
      0,
    );

    const { data: bankImport, error: importError } = await supabaseAdmin
      .from("money_bank_imports")
      .insert({
        source_name: sourceName,
        file_name: file.name,
        year,
        imported_by_user_id: userId,
        imported_by_name: userName,
        imported_by_email: userEmail,
        row_count: parsedRows.length,
        total_money_in_pence: totalMoneyIn,
        total_money_out_pence: totalMoneyOut,
        status: "imported",
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (importError) throw importError;

    const rowsPayload = parsedRows.map((row) => ({
      import_id: bankImport.id,
      row_number: row.row_number,
      transaction_date: row.transaction_date,
      description: row.description,
      amount_pence: row.amount_pence,
      money_in_pence: row.money_in_pence,
      money_out_pence: row.money_out_pence,
      balance_pence: row.balance_pence,
      reference: row.reference,
      raw: row.raw,
      status: "unmatched" as BankImportRowStatus,
      created_at: new Date().toISOString(),
    }));

    const { error: rowsError } = await supabaseAdmin
      .from("money_bank_import_rows")
      .insert(rowsPayload);

    if (rowsError) throw rowsError;

    await writeAuditLog({
      action: "bank_csv_imported",
      userId,
      userName,
      userEmail,
      metadata: {
        import_id: bankImport.id,
        file_name: file.name,
        row_count: parsedRows.length,
        total_money_in_pence: totalMoneyIn,
        total_money_out_pence: totalMoneyOut,
        year,
      },
    });

    const rows = await getImportRows(bankImport.id);
    const rowsWithCandidates = await findCandidatesForRows(rows, year);

    return NextResponse.json({
      import: bankImport,
      rows: rowsWithCandidates,
    });
  } catch (error) {
    return jsonError("Failed to import bank CSV.", error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId, userName, userEmail } = await getSignedInUser();

    const body = await request.json();

    const action = cleanText(body.action);
    const rowId = cleanText(body.row_id);
    const transactionId = cleanText(body.transaction_id);
    const note = cleanText(body.note);

    if (!rowId) {
      return jsonError("Missing bank row ID.", null, 400);
    }

    const { data: bankRow, error: rowError } = await supabaseAdmin
      .from("money_bank_import_rows")
      .select("*")
      .eq("id", rowId)
      .maybeSingle();

    if (rowError) throw rowError;

    if (!bankRow) {
      return jsonError("Bank row was not found.", null, 404);
    }

    if (action === "match") {
      if (!transactionId) {
        return jsonError("Missing transaction ID to match.", null, 400);
      }

      const { data: transaction, error: transactionError } = await supabaseAdmin
        .from("money_transactions")
        .select("*")
        .eq("id", transactionId)
        .maybeSingle();

      if (transactionError) throw transactionError;

      if (!transaction) {
        return jsonError("Money tracker transaction was not found.", null, 404);
      }

      const now = new Date().toISOString();

      const { error: updateRowError } = await supabaseAdmin
        .from("money_bank_import_rows")
        .update({
          status: "matched",
          matched_transaction_id: transactionId,
          matched_at: now,
          matched_by_user_id: userId,
          matched_by_name: userName,
          matched_by_email: userEmail,
          review_note: note || null,
          updated_at: now,
        })
        .eq("id", rowId);

      if (updateRowError) throw updateRowError;

      const { error: transactionUpdateError } = await supabaseAdmin
        .from("money_transactions")
        .update({
          bank_reconciliation_status: "matched",
          bank_reconciled_at: now,
          bank_reconciled_by: userName,
          bank_reconciliation_note:
            note ||
            `Matched from bank import row ${bankRow.row_number}.`,
        })
        .eq("id", transactionId);

      if (transactionUpdateError) throw transactionUpdateError;

      await writeAuditLog({
        action: "bank_row_matched",
        userId,
        userName,
        userEmail,
        metadata: {
          row_id: rowId,
          row_number: bankRow.row_number,
          transaction_id: transactionId,
          transaction_title: transaction.title,
          amount_pence: bankRow.amount_pence,
          note,
        },
      });

      return NextResponse.json({
        ok: true,
        status: "matched",
      });
    }

    if (action === "ignore") {
      const now = new Date().toISOString();

      const { error } = await supabaseAdmin
        .from("money_bank_import_rows")
        .update({
          status: "ignored",
          review_note: note || null,
          updated_at: now,
          reviewed_at: now,
          reviewed_by_user_id: userId,
          reviewed_by_name: userName,
          reviewed_by_email: userEmail,
        })
        .eq("id", rowId);

      if (error) throw error;

      await writeAuditLog({
        action: "bank_row_ignored",
        userId,
        userName,
        userEmail,
        metadata: {
          row_id: rowId,
          row_number: bankRow.row_number,
          amount_pence: bankRow.amount_pence,
          description: bankRow.description,
          note,
        },
      });

      return NextResponse.json({
        ok: true,
        status: "ignored",
      });
    }

    if (action === "needs_review") {
      const now = new Date().toISOString();

      const { error } = await supabaseAdmin
        .from("money_bank_import_rows")
        .update({
          status: "needs_review",
          review_note: note || null,
          updated_at: now,
          reviewed_at: now,
          reviewed_by_user_id: userId,
          reviewed_by_name: userName,
          reviewed_by_email: userEmail,
        })
        .eq("id", rowId);

      if (error) throw error;

      await writeAuditLog({
        action: "bank_row_needs_review",
        userId,
        userName,
        userEmail,
        metadata: {
          row_id: rowId,
          row_number: bankRow.row_number,
          amount_pence: bankRow.amount_pence,
          description: bankRow.description,
          note,
        },
      });

      return NextResponse.json({
        ok: true,
        status: "needs_review",
      });
    }

    return jsonError(
      "Invalid action. Use match, ignore, or needs_review.",
      null,
      400,
    );
  } catch (error) {
    return jsonError("Failed to update bank reconciliation row.", error);
  }
}