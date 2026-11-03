import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedAdmin, getAuditServiceClient, hasLotteryPermission, type LotteryPermission } from "@/lib/lottery/audit-server";
import { buildReportFilename, buildStyledXlsx, xlsxDownloadResponse } from "@/lib/lottery/reports/xlsx";
import type { ReportSheet } from "@/lib/lottery/reports/xlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExportType = "entrants" | "tickets" | "orders" | "prizes" | "winners" | "audit" | "regulatory" | "archive";
type DatasetType = Exclude<ExportType, "archive">;
type Row = Record<string, unknown>;
type Dataset = { table: string; name: string; title: string; fields: string[]; permissions: string[] };
const DATASETS: Record<DatasetType, Dataset> = {
  entrants: { table: "lottery_entries", name: "Entrants", title: "Recorded entrants",
    fields: ["id", "lottery_id", "order_id", "entrant_name", "entrant_email", "entry_number", "created_at"],
    permissions: ["lottery:orders:view"] },
  tickets: { table: "lottery_tickets", name: "Tickets", title: "Ticket records (all statuses)",
    fields: ["id", "lottery_id", "order_id", "ticket_number", "status", "issued_at", "created_at"],
    permissions: ["lottery:view"] },
  orders: { table: "lottery_orders", name: "Orders", title: "Order and payment records",
    fields: ["id", "lottery_id", "order_reference", "purchaser_name", "purchaser_email", "purchaser_phone", "quantity", "total_amount", "currency", "payment_status", "eligibility_accepted", "terms_version", "privacy_notice_version", "marketing_opt_in", "paid_at", "created_at"],
    permissions: ["lottery:orders:view", "lottery:finance:view"] },
  prizes: { table: "lottery_prizes", name: "Prizes", title: "Prize records (declared values are not purchase costs)",
    fields: ["id", "lottery_id", "name", "description", "quantity", "declared_value", "is_donated", "donor_name", "sponsor_name", "status", "allocated_winner_id", "allocated_at", "claimed_at", "fulfilled_at", "unclaimed_at", "withdrawn_at", "created_at"],
    permissions: ["lottery:view"] },
  winners: { table: "lottery_winners", name: "Winners", title: "Winner workflow records",
    fields: ["id", "lottery_id", "draw_id", "prize_id", "ticket_id", "order_id", "winner_name", "winner_email", "prize_name", "prize_value", "status", "selected_at", "contacted_at", "eligibility_confirmed_at", "claimed_at", "fulfilled_at", "unclaimed_at", "disqualified_at", "replaced_at", "created_at"],
    permissions: ["lottery:winners:manage"] },
  audit: { table: "lottery_audit_logs", name: "Audit Log", title: "Audit record summary (sensitive metadata omitted)",
    fields: ["id", "lottery_id", "entity_type", "entity_id", "admin_name", "action_group", "risk_level", "action_code", "action_label", "created_at"],
    permissions: ["lottery:audit:view"] },
  regulatory: { table: "lotteries", name: "Regulatory Records", title: "Regulatory source records (not a completed return)",
    fields: ["id", "title", "slug", "status", "lottery_type", "promoting_society_legal_name", "registration_licence_type", "registration_licence_number", "licensing_authority", "responsible_promoter_name", "responsible_promoter_address", "minimum_age", "geographic_eligibility", "terms_version", "privacy_notice_version", "maximum_proceeds", "maximum_prize_value", "sales_open_at", "sales_close_at", "draw_at", "created_at"],
    permissions: ["lottery:finance:view"] },
};
const ARCHIVE_DATASETS: DatasetType[] = ["entrants", "tickets", "orders", "prizes", "winners", "audit"];
const MONEY_FIELDS = new Set(["total_amount", "declared_value", "prize_value", "maximum_proceeds", "maximum_prize_value"]);
const NUMBER_FIELDS = new Set(["quantity", "minimum_age"]);
const BOOLEAN_FIELDS = new Set(["is_donated", "eligibility_accepted", "marketing_opt_in"]);
const MAX_ROWS = 20_000;
const MAX_DATA_BYTES = 8 * 1024 * 1024;
const MAX_XLSX_BYTES = 20 * 1024 * 1024;
const PAGE_SIZE = 250;

class ExportError extends Error {
  status: number;
  constructor(message: string, status = 503) { super(message); this.status = status; }
}
function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
    "X-Content-Type-Options": "nosniff", "Vary": "Cookie, Authorization",
  } });
}
function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function safeText(value: string) {
  if (value.length > 2_000) throw new ExportError("A text field is too long for this bounded export. Use a dedicated large-export service.", 413);
  // Defend copied text as well as XLSX cells against formula injection. No
  // formulas, hyperlinks or object-valued cells are accepted from database rows.
  const text = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  return /^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
}
function decimal(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) return null;
  const pence = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(pence) ? pence / 100 : null;
}
function exportCell(field: string, value: unknown): string | number | boolean {
  // Explicit text prevents missing/invalid numbers from becoming zero. Numeric
  // styles are intentionally omitted so the helper must not coerce these cells.
  if (value === null || value === undefined) return "Unavailable";
  if (MONEY_FIELDS.has(field)) return decimal(value) ?? "Unavailable";
  if (NUMBER_FIELDS.has(field)) {
    const n = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
    return Number.isSafeInteger(n) && n >= 0 ? n : "Unavailable";
  }
  if (BOOLEAN_FIELDS.has(field)) return typeof value === "boolean" ? value : "Unavailable";
  if (typeof value === "string") return safeText(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : "Unavailable";
  if (typeof value === "boolean") return value;
  throw new ExportError("An export field has an unsupported data type.");
}
function makeSheet(dataset: Dataset, rows: Row[]): ReportSheet {
  return {
    name: dataset.name, title: dataset.title,
    subtitle: "Source records. Unavailable values are not zero. Dates are ISO timestamps.",
    columns: dataset.fields.map(key => ({
      header: key.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()),
      key, width: key.endsWith("_id") || key === "id" ? 38 : key.includes("email") ? 30 : 24,
    })),
    rows: rows.map(row => Object.fromEntries(dataset.fields.map(field => [field, exportCell(field, row[field])]))),
  };
}
async function authorize(permissions: string[], signal: AbortSignal) {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new ExportError("Unauthorized.", 401);
  const db = getAuditServiceClient();
  const result = await db.from("admin_users")
    .select("id,supabase_user_id,email,full_name,role,is_active,is_main_admin")
    .eq("supabase_user_id", user.id).eq("is_active", true).abortSignal(signal).maybeSingle();
  if (result.error) throw new ExportError("Administrator verification is unavailable.");
  const verified = result.data;
  if (!verified || verified.supabase_user_id !== user.id || verified.is_active !== true ||
      (verified.role !== "main_admin" && verified.is_main_admin !== true)) {
    throw new ExportError("An active main administrator account is required.", 403);
  }
  const admin = await getAuthenticatedAdmin();
  if (!admin || admin.id !== verified.id || permissions.some(permission => !hasLotteryPermission(admin, permission as LotteryPermission))) {
    throw new ExportError("You do not have permission to export this dataset.", 403);
  }
  return { db, verified };
}
type Db = ReturnType<typeof getAuditServiceClient>;
type Budget = { rows: number; bytes: number };
async function readDataset(db: Db, dataset: Dataset, lotteryId: string, year: string | null, signal: AbortSignal, budget: Budget) {
  const rows: Row[] = [];
  const ids = new Set<string>();
  let total: number | null = null;
  while (total === null || rows.length < total) {
    let query = db.from(dataset.table).select(dataset.fields.join(","), { count: "exact" })
      .eq(dataset.table === "lotteries" ? "id" : "lottery_id", lotteryId);
    if (year) {
      // Calendar-year creation cohort in Europe/London. January boundaries are
      // UTC/GMT, unlike summer dates. Null dates are excluded by these filters.
      query = query.gte("created_at", `${year}-01-01T00:00:00.000Z`)
        .lt("created_at", `${Number(year) + 1}-01-01T00:00:00.000Z`);
    }
    const result = await query.order("id", { ascending: true })
      .range(rows.length, rows.length + PAGE_SIZE - 1).abortSignal(signal);
    if (result.error || !result.data || result.count === null || !Number.isSafeInteger(result.count) || result.count < 0 ||
        (total !== null && result.count !== total)) throw new ExportError("Complete export data is unavailable or changed while loading.");
    if (total === null && budget.rows + result.count > MAX_ROWS) throw new ExportError("Export exceeds the row limit. Narrow the year or use a large-export service.", 413);
    total = result.count;
    const batch = result.data as unknown as Row[];
    if (!batch.length && rows.length < total) throw new ExportError("Export data was truncated.");
    for (const row of batch) {
      if (typeof row.id !== "string" || ids.has(row.id) ||
          (dataset.table === "lotteries" ? row.id !== lotteryId : row.lottery_id !== lotteryId)) {
        throw new ExportError("Export record scope or uniqueness could not be verified.");
      }
      ids.add(row.id);
    }
    budget.bytes += Buffer.byteLength(JSON.stringify(batch), "utf8");
    if (budget.bytes > MAX_DATA_BYTES) throw new ExportError("Export exceeds the data-size limit. Narrow the scope.", 413);
    rows.push(...batch);
    if (rows.length > total) throw new ExportError("Export data changed while loading.");
  }
  budget.rows += rows.length;
  return rows;
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const params = request.nextUrl.searchParams;
    if (["type", "lottery_id", "year", "test"].some(key => params.getAll(key).length > 1)) throw new ExportError("Duplicate export parameters are not allowed.", 400);
    const rawType = params.get("type");
    if (!rawType || (!Object.hasOwn(DATASETS, rawType) && rawType !== "archive")) throw new ExportError("Invalid export type.", 400);
    const type = rawType as ExportType;
    const types: DatasetType[] = type === "archive" ? ARCHIVE_DATASETS : [type];
    const permissions = [...new Set(["lottery:export", ...types.flatMap(key => DATASETS[key].permissions), ...(type === "archive" ? ["lottery:view"] : [])])];
    const signal = AbortSignal.timeout(25_000);
    const { db, verified } = await authorize(permissions, signal);
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    if ((origin && origin !== request.nextUrl.origin) || fetchSite === "cross-site") throw new ExportError("A same-origin export request is required.", 403);
    if (params.has("test")) throw new ExportError("Test exports are not available in this production route.", 400);
    const lotteryId = params.get("lottery_id");
    const year = params.get("year");
    if (!lotteryId || !isUuid(lotteryId)) throw new ExportError("An explicit valid lottery ID is required.", 400);
    if (year !== null && (!/^\d{4}$/.test(year) || Number(year) < 2000 || Number(year) > 9998)) throw new ExportError("Enter a calendar year between 2000 and 9998, or omit year.", 400);
    const lookup = await db.from("lotteries").select("id,title,slug,status,lottery_type,created_at")
      .eq("id", lotteryId).abortSignal(signal).maybeSingle();
    if (lookup.error) throw new ExportError("Lottery verification is unavailable.");
    if (!lookup.data) throw new ExportError("Lottery not found.", 404);
    const lottery = lookup.data as unknown as Row;
    if (lottery.id !== lotteryId || typeof lottery.title !== "string") throw new ExportError("Lottery export scope could not be verified.");
    const budget: Budget = { rows: 0, bytes: 0 };
    const sheets: ReportSheet[] = [];
    if (type === "archive") sheets.push(makeSheet({ table: "lotteries", name: "Overview", title: "Lottery context (independent of creation-year filter)", fields: ["id", "title", "slug", "status", "lottery_type", "created_at"], permissions: [] }, [lottery]));
    const counts: Record<string, number> = {};
    for (const key of types) {
      const rows = await readDataset(db, DATASETS[key], lotteryId, year, signal, budget);
      counts[key] = rows.length;
      sheets.push(makeSheet(DATASETS[key], rows));
    }
    const buffer = await buildStyledXlsx({
      title: "Burton Pride Lottery Management",
      subtitle: `${type} source records. Separate reads do not establish a consistent accounting snapshot.`,
      generatedBy: safeText(String(verified.full_name || "Main administrator")),
      lotteryTitle: safeText(lottery.title),
      periodLabel: year ? `Records created in calendar year ${year} (Europe/London)` : "All recorded dates for the selected lottery",
      sheets,
    });
    if (!buffer || buffer.byteLength > MAX_XLSX_BYTES) throw new ExportError("Workbook exceeds the download-size limit.", 413);
    // Record preparation, not receipt by the user. No file can be released when
    // this fails. This is the only write and there is no best-effort fallback.
    const audit = await db.from("lottery_audit_logs").insert({
      lottery_id: lotteryId, entity_type: "report", entity_id: requestId,
      admin_id: verified.id, admin_email: verified.email,
      admin_name: verified.full_name || "Main administrator",
      action_group: "export", risk_level: "medium",
      action_code: "report.export_prepared", action_label: "Lottery source-record Excel export prepared",
      reason: "An authorized export was prepared for download.",
      metadata: { request_id: requestId, export_type: type, lottery_id: lotteryId, year, format: "xlsx", row_counts: counts, bytes: buffer.byteLength, snapshot_consistent: false },
      created_at: new Date().toISOString(),
    }).select("id").abortSignal(signal).single();
    if (audit.error || !audit.data?.id) throw new ExportError("The export audit could not be saved. No workbook was released.");
    const filenameScope = `${lotteryId}${year ? `-${year}` : ""}`;
    const download = xlsxDownloadResponse(buffer, buildReportFilename(type, filenameScope));
    download.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate, max-age=0");
    download.headers.set("X-Content-Type-Options", "nosniff");
    download.headers.set("Vary", "Cookie, Authorization");
    download.headers.set("X-Export-Request-ID", requestId);
    return download;
  } catch (error) {
    console.error(`[${requestId}] Lottery XLSX export failed:`, error);
    return response({ ok: false, error: error instanceof ExportError ? error.message : "Could not generate the Excel report.", request_id: requestId }, error instanceof ExportError ? error.status : 503);
  }
}
