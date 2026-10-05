import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PAGE_SIZE = 200;
const MAX_ROWS_PER_TABLE = 50000;
type PageResult = {
  data: unknown[] | null;
  error: unknown;
  count: number | null;
};
type LotteryRow = {
  id: string;
  title: string | null;
  name: string | null;
  slug: string | null;
  status: string | null;
  is_active: boolean | null;
  sales_close_at: string | null;
  draw_at: string | null;
  created_at: string;
};
type OrderRow = {
  id: string;
  lottery_id: string;
  quantity: number | null;
  total_amount: number | string | null;
  currency: string | null;
  payment_status: string | null;
  created_at: string;
};
type TicketRow = {
  id: string;
  lottery_id: string;
  status: string | null;
  issued_at: string | null;
  created_at: string;
};
type WinnerRow = {
  id: string;
  lottery_id: string;
  prize_id: string | null;
  status: string | null;
  claimed: boolean | null;
  fulfilled_at: string | null;
  created_at: string;
};
type PrizeRow = {
  id: string;
  lottery_id: string;
  quantity: number | null;
  status: string | null;
  allocated_winner_id: string | null;
  claimed_at: string | null;
  fulfilled_at: string | null;
};
type DrawRow = {
  id: string;
  lottery_id: string;
  status: string | null;
  scheduled_at: string | null;
  created_at: string;
};
type WarningRow = {
  id: string;
  lottery_id: string | null;
  warning_code: string;
  severity: string;
  resolved: boolean;
  created_at: string;
};
type AuditRow = {
  id: string;
  lottery_id: string | null;
  lottery_title: string | null;
  action_code: string | null;
  action_label: string | null;
  admin_name: string | null;
  risk_level: string | null;
  created_at: string;
};
class RouteError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function json(body: Record<string, unknown>, requestId: string, status = 200) {
  return NextResponse.json(
    { ...body, request_id: requestId },
    {
      status,
      headers: {
        "Cache-Control":
          "private, no-store, no-cache, must-revalidate, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Request-ID": requestId,
        Vary: "Cookie, Authorization",
      },
    },
  );
}
function withSignal<T>(
  promise: PromiseLike<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () =>
      reject(
        new RouteError(
          503,
          "The lottery dashboard is temporarily unavailable.",
        ),
      );
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

async function loadAll<T extends { id: string }>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult>,
  signal: AbortSignal,
): Promise<T[]> {
  const rows: T[] = [];
  const ids = new Set<string>();
  let total: number | null = null;
  for (let start = 0; total === null || start < total; start += PAGE_SIZE) {
    const end: number =
      total === null
        ? start + PAGE_SIZE - 1
        : Math.min(start + PAGE_SIZE, total) - 1;
    const result: PageResult = await withSignal(loadPage(start, end), signal);
    if (
      result.error ||
      !Array.isArray(result.data) ||
      result.count === null ||
      !Number.isSafeInteger(result.count) ||
      result.count < 0
    )
      throw new RouteError(503, "Unable to load complete dashboard records.");
    if (total === null) total = result.count;
    if (total > MAX_ROWS_PER_TABLE)
      throw new RouteError(
        413,
        "The dashboard requires database aggregation for this volume of records.",
      );
    if (
      result.count !== total ||
      result.data.length !== Math.min(PAGE_SIZE, total - start)
    )
      throw new RouteError(
        503,
        "Dashboard records changed or could not be fully loaded. Please refresh.",
      );
    for (const value of result.data) {
      if (
        !value ||
        typeof value !== "object" ||
        !("id" in value) ||
        typeof value.id !== "string" ||
        !value.id ||
        ids.has(value.id)
      )
        throw new RouteError(
          503,
          "Unable to verify complete dashboard records.",
        );
      ids.add(value.id);
      rows.push(value as T);
    }
  }
  return rows;
}
function lotteryTitle(lottery: LotteryRow | undefined) {
  return lottery?.title || lottery?.name || "Untitled lottery";
}
function time(value: string | null | undefined): number {
  if (!value) return 0;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : 0;
}
function status(value: string | null | undefined) {
  return typeof value === "string" ? value.toLowerCase() : "";
}
// total_amount is treated as currency major units, matching the supplied route.
// The schema/ledger must confirm that convention before financial sign-off.
function moneyPence(value: number | string | null): number | null {
  if (value === null) return null;
  const text =
    typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : typeof value === "string"
        ? value.trim()
        : "";
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : null;
}
function sumPaidAmounts(
  orders: OrderRow[],
  quality: Set<string>,
): number | null {
  let total = 0;
  for (const order of orders) {
    if (order.currency !== "GBP") {
      quality.add("UNKNOWN_OR_UNSUPPORTED_CURRENCY");
      return null;
    }
    const pence = moneyPence(order.total_amount);
    if (pence === null || !Number.isSafeInteger(total + pence)) {
      quality.add("INVALID_PAID_ORDER_AMOUNT");
      return null;
    }
    total += pence;
  }
  return total / 100;
}
export async function GET(request: NextRequest) {
  const requestId = randomUUID(),
    controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const cancel = () => controller.abort();
  request.signal.addEventListener("abort", cancel, { once: true });
  if (request.signal.aborted) controller.abort();
  let stage = "session";
  try {
    const client = await withSignal(createClient(), controller.signal);
    const { data, error: authError } = await withSignal(
      client.auth.getUser(),
      controller.signal,
    );
    if (authError || !data.user?.id || data.user.is_anonymous === true)
      throw new RouteError(401, "Authentication required.");
    const { supabaseAdmin: db } = await import("@/lib/supabase/supabaseAdmin");
    stage = "authorization";
    const adminResult = await withSignal(
      db
        .from("admin_users")
        .select("id,supabase_user_id,role,is_active")
        .eq("supabase_user_id", data.user.id)
        .eq("is_active", true)
        .abortSignal(controller.signal)
        .maybeSingle(),
      controller.signal,
    );
    if (adminResult.error)
      throw new RouteError(
        503,
        "The lottery dashboard is temporarily unavailable.",
      );
    const admin = adminResult.data;
    // Conservative role restriction until verified dashboard/finance/audit
    // permission storage is supplied. No cookie identity or email fallback.
    if (
      !admin ||
      admin.supabase_user_id !== data.user.id ||
      admin.is_active !== true ||
      admin.role !== "main_admin"
    )
      throw new RouteError(
        403,
        "You do not have permission to view the lottery dashboard.",
      );
    stage = "dashboard_queries";
    const snapshot = new Date().toISOString();
    // Exact counts and expected batch lengths detect database row caps. Independent
    // statements do not provide a transaction snapshot; a database RPC is still needed.
    const [
      lotteries,
      orders,
      tickets,
      winners,
      prizes,
      draws,
      warningRows,
      entriesResult,
      auditResult,
    ] = await Promise.all([
      loadAll<LotteryRow>(
        (from, to) =>
          db
            .from("lotteries")
            .select(
              "id,title,name,slug,status,is_active,sales_close_at,draw_at,created_at",
              { count: "exact" },
            )
            .lte("created_at", snapshot)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to)
            .abortSignal(controller.signal),
        controller.signal,
      ),
      loadAll<OrderRow>(
        (from, to) =>
          db
            .from("lottery_orders")
            .select(
              "id,lottery_id,quantity,total_amount,currency,payment_status,created_at",
              { count: "exact" },
            )
            .lte("created_at", snapshot)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to)
            .abortSignal(controller.signal),
        controller.signal,
      ),
      loadAll<TicketRow>(
        (from, to) =>
          db
            .from("lottery_tickets")
            .select("id,lottery_id,status,issued_at,created_at", {
              count: "exact",
            })
            .lte("created_at", snapshot)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to)
            .abortSignal(controller.signal),
        controller.signal,
      ),
      loadAll<WinnerRow>(
        (from, to) =>
          db
            .from("lottery_winners")
            .select(
              "id,lottery_id,prize_id,status,claimed,fulfilled_at,created_at",
              { count: "exact" },
            )
            .lte("created_at", snapshot)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to)
            .abortSignal(controller.signal),
        controller.signal,
      ),
      loadAll<PrizeRow>(
        (from, to) =>
          db
            .from("lottery_prizes")
            .select(
              "id,lottery_id,quantity,status,allocated_winner_id,claimed_at,fulfilled_at",
              { count: "exact" },
            )
            .order("id", { ascending: true })
            .range(from, to)
            .abortSignal(controller.signal),
        controller.signal,
      ),
      loadAll<DrawRow>(
        (from, to) =>
          db
            .from("lottery_draws")
            .select("id,lottery_id,status,scheduled_at,created_at", {
              count: "exact",
            })
            .lte("created_at", snapshot)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to)
            .abortSignal(controller.signal),
        controller.signal,
      ),
      loadAll<WarningRow>(
        (from, to) =>
          db
            .from("lottery_integrity_warnings")
            .select("id,lottery_id,warning_code,severity,resolved,created_at", {
              count: "exact",
            })
            .lte("created_at", snapshot)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to)
            .abortSignal(controller.signal),
        controller.signal,
      ),
      withSignal(
        db
          .from("lottery_entries")
          .select("id", { count: "exact", head: true })
          .lte("created_at", snapshot)
          .abortSignal(controller.signal),
        controller.signal,
      ),
      withSignal(
        db
          .from("lottery_audit_logs")
          .select(
            "id,lottery_id,lottery_title,action_code,action_label,admin_name,risk_level,created_at",
          )
          .neq("action_group", "export")
          .not("action_code", "ilike", "%.viewed")
          .not("action_code", "ilike", "%.permission_denied")
          .not("action_code", "ilike", "%.invalid_filter")
          .not("action_code", "ilike", "%.load_failed")
          .not("action_code", "ilike", "%.exported")
          .not(
            "action_code",
            "in",
            "(export.audit_logs.csv,report.exported,export.exported)",
          )
          .lte("created_at", snapshot)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(10)
          .abortSignal(controller.signal),
        controller.signal,
      ),
    ]);
    if (
      entriesResult.error ||
      entriesResult.count === null ||
      !Number.isSafeInteger(entriesResult.count) ||
      entriesResult.count < 0 ||
      auditResult.error ||
      !Array.isArray(auditResult.data)
    )
      throw new RouteError(
        503,
        "Unable to load the complete lottery dashboard.",
      );
    stage = "dashboard_summary";
    const quality = new Set<string>();
    const lotteryById = new Map(lotteries.map((row) => [row.id, row]));
    const operationalStatuses = new Set([
      "scheduled",
      "live",
      "paused",
      "sales_closed",
      "draw_ready",
    ]);
    const activeLotteries = lotteries.filter(
      (row) =>
        row.is_active === true && operationalStatuses.has(status(row.status)),
    );
    if (
      lotteries.some(
        (row) =>
          operationalStatuses.has(status(row.status)) && row.is_active === null,
      )
    )
      quality.add("MISSING_LOTTERY_ACTIVE_FLAG");
    const liveLotteryIds = new Set(
      activeLotteries
        .filter((row) => status(row.status) === "live")
        .map((row) => row.id),
    );
    const paidOrders = orders.filter(
      (row) => status(row.payment_status) === "paid",
    );
    const attentionStatuses = new Set([
      "pending",
      "failed",
      "incomplete",
      "processing",
      "requires_action",
      "disputed",
    ]);
    const paymentAttentionOrders = orders.filter((row) =>
      attentionStatuses.has(status(row.payment_status)),
    );
    if (orders.some((row) => !row.payment_status))
      quality.add("MISSING_PAYMENT_STATUS");
    const issuedTickets = tickets.filter((row) =>
      ["issued", "winner"].includes(status(row.status)),
    );
    const unresolvedWarnings = warningRows.filter(
      (row) => row.resolved === false,
    );
    if (warningRows.some((row) => typeof row.resolved !== "boolean"))
      quality.add("MISSING_WARNING_RESOLUTION_STATE");
    const grossTicketProceeds = sumPaidAmounts(paidOrders, quality);
    const currentLiveSales = sumPaidAmounts(
      paidOrders.filter((row) => liveLotteryIds.has(row.lottery_id)),
      quality,
    );
    let paidTicketQuantity: number | null = 0;
    for (const order of paidOrders) {
      if (
        typeof order.quantity !== "number" ||
        !Number.isSafeInteger(order.quantity) ||
        order.quantity < 1 ||
        !Number.isSafeInteger(paidTicketQuantity + order.quantity)
      ) {
        paidTicketQuantity = null;
        quality.add("INVALID_PAID_TICKET_QUANTITY");
        break;
      }
      paidTicketQuantity += order.quantity;
    }
    const prizeById = new Map(prizes.map((row) => [row.id, row]));
    const knownWinnerStatuses = new Set([
      "selected",
      "contact_pending",
      "contacted",
      "eligibility_confirmed",
      "claimed",
      "fulfilled",
      "unclaimed",
      "disqualified",
      "replaced",
    ]);
    if (winners.some((row) => !knownWinnerStatuses.has(status(row.status))))
      quality.add("UNKNOWN_WINNER_STATUS");
    const winnerById = new Map(winners.map((row) => [row.id, row]));
    const pendingClaimStatuses = new Set([
      "selected",
      "contact_pending",
      "contacted",
      "eligibility_confirmed",
      "unclaimed",
    ]);
    const unclaimedPrizeIds = new Set<string>();
    for (const winner of winners) {
      if (
        winner.prize_id &&
        pendingClaimStatuses.has(status(winner.status)) &&
        winner.claimed !== true &&
        !winner.fulfilled_at
      ) {
        const prize = prizeById.get(winner.prize_id);
        if (!prize || prize.lottery_id !== winner.lottery_id)
          quality.add("UNVERIFIED_PRIZE_WINNER_LINK");
        else if (!["withdrawn", "fulfilled"].includes(status(prize.status)))
          unclaimedPrizeIds.add(winner.prize_id);
      }
    }
    for (const prize of prizes) {
      if (
        !prize.allocated_winner_id ||
        prize.claimed_at ||
        prize.fulfilled_at ||
        ["fulfilled", "withdrawn"].includes(status(prize.status))
      )
        continue;
      const winner = winnerById.get(prize.allocated_winner_id);
      if (
        !winner ||
        winner.lottery_id !== prize.lottery_id ||
        winner.prize_id !== prize.id
      ) {
        quality.add("UNVERIFIED_PRIZE_WINNER_LINK");
        continue;
      }
      if (
        pendingClaimStatuses.has(status(winner.status)) &&
        winner.claimed !== true &&
        !winner.fulfilled_at
      )
        unclaimedPrizeIds.add(prize.id);
    }
    const now = Date.now();
    const upcomingSalesClosingDates = activeLotteries
      .filter((row) => time(row.sales_close_at) > now)
      .sort(
        (a, b) =>
          time(a.sales_close_at) - time(b.sales_close_at) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 8)
      .map((row) => ({
        id: row.id,
        lottery_id: row.id,
        title: lotteryTitle(row),
        lottery_title: lotteryTitle(row),
        slug: row.slug,
        status: row.status,
        sales_close_at: row.sales_close_at,
      }));
    const activeIds = new Set(activeLotteries.map((row) => row.id)),
      scheduledLotteryIds = new Set<string>();
    const upcomingDraws = draws
      .filter(
        (row) =>
          activeIds.has(row.lottery_id) &&
          time(row.scheduled_at) > now &&
          ["scheduled", "not_started", "pending", "ready"].includes(
            status(row.status),
          ),
      )
      .map((row) => {
        scheduledLotteryIds.add(row.lottery_id);
        const lottery = lotteryById.get(row.lottery_id);
        return {
          id: row.id,
          draw_id: row.id as string | null,
          lottery_id: row.lottery_id,
          title: lotteryTitle(lottery),
          lottery_title: lotteryTitle(lottery),
          slug: lottery?.slug || null,
          status: row.status,
          scheduled_at: row.scheduled_at,
          draw_at: row.scheduled_at,
        };
      });
    for (const row of activeLotteries)
      if (time(row.draw_at) > now && !scheduledLotteryIds.has(row.id))
        upcomingDraws.push({
          id: row.id,
          draw_id: null,
          lottery_id: row.id,
          title: lotteryTitle(row),
          lottery_title: lotteryTitle(row),
          slug: row.slug,
          status: row.status,
          scheduled_at: row.draw_at,
          draw_at: row.draw_at,
        });
    upcomingDraws.sort(
      (a, b) => time(a.draw_at) - time(b.draw_at) || a.id.localeCompare(b.id),
    );
    const visibleUpcomingDraws = upcomingDraws.slice(0, 8);
    const warningItems = unresolvedWarnings.slice(0, 10).map((row) => ({
      id: row.id,
      lottery_id: row.lottery_id,
      warning_code: row.warning_code,
      severity: row.severity,
      resolved: false,
      created_at: row.created_at,
      message: "An unresolved integrity warning requires review.",
      title: "An unresolved integrity warning requires review.",
      lottery_title: lotteryTitle(
        row.lottery_id ? lotteryById.get(row.lottery_id) : undefined,
      ),
    }));
    const recentActivity = (auditResult.data as unknown as AuditRow[]).map(
      (row) => ({
        id: row.id,
        lottery_id: row.lottery_id,
        lottery_title:
          row.lottery_title ||
          lotteryTitle(
            row.lottery_id ? lotteryById.get(row.lottery_id) : undefined,
          ),
        action_code: row.action_code,
        action_label: row.action_label,
        admin_name: row.admin_name,
        risk_level: row.risk_level,
        created_at: row.created_at,
        title: row.action_label || row.action_code || "Lottery activity",
        admin: row.admin_name || "Admin Portal",
      }),
    );
    const stats = {
      activeLotteries: activeLotteries.length,
      currentLiveSales,
      grossTicketProceeds,
      paidEntries: paidOrders.length,
      ticketsIssued: issuedTickets.length,
      paymentAttention: quality.has("MISSING_PAYMENT_STATUS")
        ? null
        : paymentAttentionOrders.length,
      unclaimedPrizes:
        quality.has("UNVERIFIED_PRIZE_WINNER_LINK") ||
        quality.has("UNKNOWN_WINNER_STATUS")
          ? null
          : unclaimedPrizeIds.size,
      complianceWarnings: quality.has("MISSING_WARNING_RESOLUTION_STATE")
        ? null
        : unresolvedWarnings.length,
    };
    const summary = {
      active_lotteries: stats.activeLotteries,
      current_live_sales: stats.currentLiveSales,
      gross_ticket_proceeds: stats.grossTicketProceeds,
      paid_entries: stats.paidEntries,
      tickets_issued: stats.ticketsIssued,
      payment_attention: stats.paymentAttention,
      unclaimed_prizes: stats.unclaimedPrizes,
      compliance_warnings: stats.complianceWarnings,
    };
    const recentLotteries = lotteries.slice(0, 5).map((row) => ({
      id: row.id,
      title: lotteryTitle(row),
      slug: row.slug,
      status: row.status,
      created_at: row.created_at,
    }));
    const dashboard = {
      ...stats,
      stats,
      summary,
      totalLotteries: lotteries.length,
      liveLotteries: lotteries.filter((row) => status(row.status) === "live")
        .length,
      draftLotteries: lotteries.filter((row) => status(row.status) === "draft")
        .length,
      scheduledLotteries: lotteries.filter(
        (row) => status(row.status) === "scheduled",
      ).length,
      completedLotteries: lotteries.filter(
        (row) => status(row.status) === "completed",
      ).length,
      totalOrders: orders.length,
      paidOrders: paidOrders.length,
      paidTicketQuantity,
      totalEntries: entriesResult.count,
      totalWinners: winners.length,
      totalRevenue: grossTicketProceeds,
      recentLotteries,
      upcomingSalesClosingDates,
      upcomingDraws: visibleUpcomingDraws,
      warningItems,
      recentActivity,
    };
    return json(
      {
        ok: true,
        success: true,
        generated_at: new Date().toISOString(),
        dashboard,
        data: dashboard,
        stats,
        summary,
        upcomingSalesClosingDates,
        upcomingSalesClosings: upcomingSalesClosingDates,
        upcoming_sales_closing_dates: upcomingSalesClosingDates,
        upcomingDraws: visibleUpcomingDraws,
        upcoming_draws: visibleUpcomingDraws,
        warningItems,
        warnings: warningItems,
        recentActivity,
        recent_activity: recentActivity,
        data_quality: [...quality],
        snapshot_atomic: false,
        financial_basis: {
          currency: "GBP",
          amount_unit: "major_currency_units",
          measure: "stored_paid_order_amounts",
          ledger_verified: false,
          refunds_and_fees_reconciled: false,
        },
        metric_definitions: {
          activeLotteries:
            "Explicitly active operational lotteries; drafts excluded.",
          paidEntries: "Number of orders marked paid.",
          ticketsIssued:
            "Tickets with issued/winner status; not a verified draw-eligible pool.",
          unclaimedPrizes:
            "Distinct allocated prize IDs awaiting claim; not prize quantity.",
          complianceWarnings:
            "Recorded unresolved integrity warnings; not a compliance approval.",
        },
      },
      requestId,
    );
  } catch (error) {
    controller.abort();
    const responseStatus = error instanceof RouteError ? error.status : 500;
    if (responseStatus >= 500)
      console.error("Lottery dashboard request failed", {
        request_id: requestId,
        stage,
        status: responseStatus,
      });
    return json(
      {
        ok: false,
        success: false,
        error:
          error instanceof RouteError
            ? error.message
            : "Unable to load lottery dashboard.",
      },
      requestId,
      responseStatus,
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", cancel);
  }
}
