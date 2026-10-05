import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const LIST_STATUSES = [
  "scheduled",
  "live",
  "sales_closed",
  "draw_ready",
  "completed",
  "under_review",
];
const MAX_OFFSET = 100000;
const ROW_CONCURRENCY = 3;
type LotteryRow = {
  id: string;
  title: string;
  slug: string;
  internal_reference: string | null;
  status: string;
  sales_close_at: string | null;
  draw_at: string | null;
};
type LatestDraw = { id: string; status: string; completed_at: string | null };
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
          "The lottery draw list is temporarily unavailable.",
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
function pageArgument(
  params: URLSearchParams,
  key: string,
  fallback: number,
  max: number,
): number {
  const values = params.getAll(key);
  if (values.length > 1) throw new RouteError(400, `Provide ${key} only once.`);
  if (values.length === 0) return fallback;
  if (!/^[1-9]\d{0,5}$/.test(values[0]) || Number(values[0]) > max)
    throw new RouteError(400, `Provide a valid ${key}.`);
  return Number(values[0]);
}
function timestamp(value: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}
function drawState(
  lottery: LotteryRow,
  latest: LatestDraw | null,
  warningCount: number,
  now: number,
): string {
  // Completion/running here describes recorded workflow state, never readiness.
  if (warningCount > 0 || lottery.status === "under_review")
    return "under_review";
  if (latest?.status === "completed") return "completed";
  if (latest && ["running", "live"].includes(latest.status)) return "running";
  if (
    latest &&
    ["failed", "blocked", "redraw_requested"].includes(latest.status)
  )
    return "blocked";
  const closes = timestamp(lottery.sales_close_at),
    drawAt = timestamp(lottery.draw_at);
  if (
    ["scheduled", "live"].includes(lottery.status) &&
    closes !== null &&
    closes > now &&
    drawAt !== null &&
    drawAt > closes
  )
    return "upcoming";
  // Dates and a draw_ready/sales_closed label cannot prove a frozen paid-only
  // pool, integrity/compliance approval, recent 2FA or single execution protection.
  return "not_ready";
}
async function mapBounded<T, R>(
  rows: T[],
  work: (row: T) => Promise<R>,
  signal: AbortSignal,
): Promise<R[]> {
  const results: R[] = new Array(rows.length);
  let index = 0;
  const worker = async () => {
    while (index < rows.length) {
      if (signal.aborted)
        throw new RouteError(
          503,
          "The lottery draw list is temporarily unavailable.",
        );
      const current = index++;
      results[current] = await work(rows[current]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(ROW_CONCURRENCY, rows.length) }, () =>
      worker(),
    ),
  );
  return results;
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
        "The lottery draw list is temporarily unavailable.",
      );
    const admin = adminResult.data;
    // Use the same conservative role restriction as the repaired admin routes.
    // Integrate lottery:view through a VERIFIED central guard when supplied.
    // Never use the reviewed cookie-trusting adminAuth helper or email fallback.
    if (
      !admin ||
      admin.supabase_user_id !== data.user.id ||
      admin.is_active !== true ||
      admin.role !== "main_admin"
    )
      throw new RouteError(
        403,
        "You do not have permission to view the lottery draw list.",
      );
    stage = "validation";
    const page = pageArgument(
      request.nextUrl.searchParams,
      "page",
      1,
      MAX_OFFSET + 1,
    );
    const pageSize = pageArgument(
      request.nextUrl.searchParams,
      "pageSize",
      25,
      50,
    );
    const start = (page - 1) * pageSize;
    if (start > MAX_OFFSET)
      throw new RouteError(
        400,
        "The requested draw page is beyond the supported range.",
      );
    stage = "lotteries";
    const lotteriesResult = await withSignal(
      db
        .from("lotteries")
        .select(
          "id,title,slug,internal_reference,status,sales_close_at,draw_at",
          { count: "exact" },
        )
        .in("status", LIST_STATUSES)
        .order("draw_at", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true })
        .range(start, start + pageSize - 1)
        .abortSignal(controller.signal),
      controller.signal,
    );
    if (
      lotteriesResult.error ||
      !Array.isArray(lotteriesResult.data) ||
      lotteriesResult.count === null ||
      !Number.isSafeInteger(lotteriesResult.count) ||
      lotteriesResult.count < 0
    )
      throw new RouteError(
        503,
        "The lottery draw list could not be fully loaded.",
      );
    const total = lotteriesResult.count;
    if (
      lotteriesResult.data.length !==
      Math.min(pageSize, Math.max(0, total - start))
    )
      throw new RouteError(
        503,
        "The lottery draw list changed or could not be fully loaded. Please refresh.",
      );
    const lotteries = lotteriesResult.data as unknown as LotteryRow[];
    const ids = new Set<string>();
    for (const lottery of lotteries) {
      if (
        typeof lottery.id !== "string" ||
        !lottery.id ||
        ids.has(lottery.id) ||
        !LIST_STATUSES.includes(lottery.status)
      )
        throw new RouteError(
          503,
          "The lottery draw list could not be verified.",
        );
      ids.add(lottery.id);
    }
    stage = "draw_metrics";
    const now = Date.now();
    const items = await mapBounded(
      lotteries,
      async (lottery) => {
        const [
          paidOrders,
          issuedTickets,
          excludedTickets,
          prizes,
          warnings,
          latestDraw,
        ] = await Promise.all([
          withSignal(
            db
              .from("lottery_orders")
              .select("id", { count: "exact", head: true })
              .eq("lottery_id", lottery.id)
              .eq("payment_status", "paid")
              .abortSignal(controller.signal),
            controller.signal,
          ),
          withSignal(
            db
              .from("lottery_tickets")
              .select("id", { count: "exact", head: true })
              .eq("lottery_id", lottery.id)
              .eq("status", "issued")
              .abortSignal(controller.signal),
            controller.signal,
          ),
          withSignal(
            db
              .from("lottery_tickets")
              .select("id", { count: "exact", head: true })
              .eq("lottery_id", lottery.id)
              .in("status", [
                "void",
                "refunded",
                "test",
                "cancelled",
                "invalid",
                "excluded",
              ])
              .abortSignal(controller.signal),
            controller.signal,
          ),
          withSignal(
            db
              .from("lottery_prizes")
              .select("id", { count: "exact", head: true })
              .eq("lottery_id", lottery.id)
              .eq("status", "available_for_draw")
              .abortSignal(controller.signal),
            controller.signal,
          ),
          withSignal(
            db
              .from("lottery_integrity_warnings")
              .select("id", { count: "exact", head: true })
              .eq("lottery_id", lottery.id)
              .eq("resolved", false)
              .abortSignal(controller.signal),
            controller.signal,
          ),
          withSignal(
            db
              .from("lottery_draws")
              .select("id,status,completed_at")
              .eq("lottery_id", lottery.id)
              .order("created_at", { ascending: false })
              .order("id", { ascending: false })
              .limit(1)
              .abortSignal(controller.signal),
            controller.signal,
          ),
        ]);
        for (const result of [
          paidOrders,
          issuedTickets,
          excludedTickets,
          prizes,
          warnings,
        ]) {
          if (
            result.error ||
            result.count === null ||
            !Number.isSafeInteger(result.count) ||
            result.count < 0
          )
            throw new RouteError(
              503,
              "Draw metrics could not be fully loaded.",
            );
        }
        if (
          latestDraw.error ||
          !Array.isArray(latestDraw.data) ||
          latestDraw.data.length > 1
        )
          throw new RouteError(
            503,
            "The latest draw record could not be loaded.",
          );
        const latest = (latestDraw.data[0] ?? null) as LatestDraw | null;
        if (
          latest &&
          (typeof latest.id !== "string" || typeof latest.status !== "string")
        )
          throw new RouteError(
            503,
            "The latest draw record could not be verified.",
          );
        const drawStatus = drawState(lottery, latest, warnings.count!, now);
        return {
          id: lottery.id,
          title: lottery.title,
          slug: lottery.slug,
          internal_reference: lottery.internal_reference,
          lottery_status: lottery.status,
          draw_at: lottery.draw_at,
          sales_close_at: lottery.sales_close_at,
          paid_orders: paidOrders.count,
          issued_tickets: issuedTickets.count,
          // Preserve the old key but do not mislabel issued tickets as eligible.
          eligible_tickets: null,
          excluded_tickets: excludedTickets.count,
          prizes_available: prizes.count,
          unresolved_warnings: warnings.count,
          draw_status: drawStatus,
          latest_draw_id: latest?.id ?? null,
          latest_draw_status: latest?.status ?? null,
          readiness_verified: false,
          readiness_reason:
            "Server readiness verification is required; dates and ticket statuses do not prove eligibility.",
        };
      },
      controller.signal,
    );
    return json(
      {
        items,
        summary: {
          ready: 0,
          upcoming: items.filter((row) =>
            ["upcoming", "not_ready"].includes(row.draw_status),
          ).length,
          completed: items.filter((row) => row.draw_status === "completed")
            .length,
          blocked: items.filter((row) =>
            ["blocked", "under_review", "redraw_requested"].includes(
              row.draw_status,
            ),
          ).length,
        },
        summary_scope: "current_page",
        pagination: {
          page,
          pageSize,
          total,
          has_more: start + items.length < total,
          next_page:
            start + pageSize < total && start + pageSize <= MAX_OFFSET
              ? page + 1
              : null,
        },
        readiness_verified: false,
        counts_snapshot_atomic: false,
        generated_at: new Date().toISOString(),
        metric_definitions: {
          paid_orders:
            "Orders currently marked paid; not a reconciliation proof.",
          issued_tickets:
            "Tickets currently marked issued; not a frozen paid-only pool.",
          eligible_tickets:
            "Unavailable until the secure server readiness workflow verifies the frozen pool.",
          excluded_tickets:
            "Recorded exclusion statuses; not an exhaustive eligibility calculation.",
        },
      },
      requestId,
    );
  } catch (error) {
    controller.abort();
    const responseStatus = error instanceof RouteError ? error.status : 500;
    if (responseStatus >= 500)
      console.error("Lottery draw list request failed", {
        request_id: requestId,
        stage,
        status: responseStatus,
      });
    return json(
      {
        error:
          error instanceof RouteError
            ? error.message
            : "The lottery draw list could not be loaded.",
      },
      requestId,
      responseStatus,
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", cancel);
  }
}
