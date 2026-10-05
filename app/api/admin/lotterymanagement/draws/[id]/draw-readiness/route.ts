import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
        new RouteError(503, "Draw authorization is temporarily unavailable."),
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

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = `DRAW-READY-${randomUUID()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const cancel = () => controller.abort();
  request.signal.addEventListener("abort", cancel, { once: true });
  if (request.signal.aborted) controller.abort();
  let stage = "session";
  try {
    const client = await withSignal(createClient(), controller.signal);
    const { data, error } = await withSignal(
      client.auth.getUser(),
      controller.signal,
    );
    if (error || !data.user?.id || data.user.is_anonymous === true)
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
        "Draw authorization is temporarily unavailable.",
      );
    const admin = adminResult.data;
    // Interim access restriction, not a substitute for lottery:view.
    if (
      !admin ||
      admin.supabase_user_id !== data.user.id ||
      admin.is_active !== true ||
      admin.role !== "main_admin"
    )
      throw new RouteError(
        403,
        "You do not have permission to view draw readiness.",
      );

    stage = "validation";
    const { id } = await withSignal(context.params, controller.signal);
    if (typeof id !== "string" || !UUID.test(id))
      throw new RouteError(400, "Provide a valid lottery ID.");
    const lotteryId = id.toLowerCase();
    stage = "lottery";
    const result = await withSignal(
      db
        .from("lotteries")
        .select("id,title,internal_reference,status,draw_at,sales_close_at")
        .eq("id", lotteryId)
        .abortSignal(controller.signal)
        .maybeSingle(),
      controller.signal,
    );
    if (result.error)
      throw new RouteError(503, "Unable to load lottery readiness.");
    const lottery = result.data;
    if (!lottery) throw new RouteError(404, "Lottery not found.");
    if (lottery.id !== lotteryId || typeof lottery.status !== "string")
      throw new RouteError(503, "The lottery record could not be verified.");
    stage = "metrics";
    // Only exact counts: fetching entire arrays can silently stop at the API row cap.
    const [paid, issued, excluded, prizes, warnings, draws] = await Promise.all(
      [
        withSignal(
          db
            .from("lottery_orders")
            .select("id", { count: "exact", head: true })
            .eq("lottery_id", lotteryId)
            .eq("payment_status", "paid")
            .abortSignal(controller.signal),
          controller.signal,
        ),
        withSignal(
          db
            .from("lottery_tickets")
            .select("id", { count: "exact", head: true })
            .eq("lottery_id", lotteryId)
            .eq("status", "issued")
            .abortSignal(controller.signal),
          controller.signal,
        ),
        withSignal(
          db
            .from("lottery_tickets")
            .select("id", { count: "exact", head: true })
            .eq("lottery_id", lotteryId)
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
            .eq("lottery_id", lotteryId)
            .eq("status", "available_for_draw")
            .abortSignal(controller.signal),
          controller.signal,
        ),
        // Match the repaired draw list. Missing resolved column fails closed.
        // Treat NULL as unresolved too; it cannot prove a warning was resolved.
        withSignal(
          db
            .from("lottery_integrity_warnings")
            .select("id", { count: "exact", head: true })
            .eq("lottery_id", lotteryId)
            .or("resolved.eq.false,resolved.is.null")
            .abortSignal(controller.signal),
          controller.signal,
        ),
        // Conservatively block ANY existing draw until primary/redraw semantics and
        // failed-draw recovery rules are supplied. Do not infer safety from one row.
        withSignal(
          db
            .from("lottery_draws")
            .select("id", { count: "exact", head: true })
            .eq("lottery_id", lotteryId)
            .abortSignal(controller.signal),
          controller.signal,
        ),
      ],
    );
    for (const metric of [paid, issued, excluded, prizes, warnings, draws]) {
      if (
        metric.error ||
        metric.count === null ||
        !Number.isSafeInteger(metric.count) ||
        metric.count < 0
      )
        throw new RouteError(
          503,
          "Readiness metrics could not be fully loaded.",
        );
    }
    const now = Date.now();
    const timestamp = (value: unknown): number | null => {
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      )
        return null;
      const time = Date.parse(value);
      return Number.isFinite(time) ? time : null;
    };
    const closes = timestamp(lottery.sales_close_at);
    const drawAt = timestamp(lottery.draw_at);
    const closedState = ["sales_closed", "draw_ready"].includes(lottery.status);
    const makeCheck = (
      key: string,
      label: string,
      ok: boolean,
      detail: string,
      verified = true,
    ) => ({ key, label, ok, detail, verified });
    const checks = [
      makeCheck(
        "sales_closed",
        "Ticket sales are closed",
        closedState && closes !== null && closes <= now,
        "Requires sales_closed or draw_ready status and an elapsed sales closing time; this does not prove checkout is locked.",
      ),
      makeCheck(
        "lottery_state",
        "Lottery is in a drawable state",
        closedState,
        "Only sales_closed and draw_ready states are accepted for preliminary checks.",
      ),
      makeCheck(
        "draw_time",
        "The scheduled draw time has arrived",
        drawAt !== null && drawAt <= now && closes !== null && drawAt >= closes,
        "Requires a valid draw timestamp at or after sales close and no later than now.",
      ),
      makeCheck(
        "payments",
        "Paid orders are recorded",
        paid.count! > 0,
        "Recorded paid status only; refunds, disputes and payment reconciliation are not verified.",
      ),
      makeCheck(
        "tickets",
        "Frozen eligible ticket pool is verified",
        false,
        "Issued tickets are not proof of eligibility. A same-lottery paid/non-refunded order join and frozen pool/hash are required.",
        false,
      ),
      makeCheck(
        "prizes",
        "Prizes are marked available for draw",
        prizes.count! > 0,
        "Counts available_for_draw only; confirmed status alone does not prove availability.",
      ),
      makeCheck(
        "integrity_warnings",
        "No unresolved integrity warnings",
        warnings.count === 0,
        "Counts both unresolved and unknown-resolution warnings.",
      ),
      makeCheck(
        "previous_draw",
        "No previous draw record exists",
        draws.count === 0,
        "Any previous draw requires the verified recovery or redraw workflow.",
      ),
      makeCheck(
        "compliance",
        "Compliance approval is verified",
        false,
        "Approval records and permitted sales channel must be checked by the secure draw service.",
        false,
      ),
      makeCheck(
        "payment_reconciliation",
        "Payment reconciliation is verified",
        false,
        "Paid order counts cannot prove reconciliation or exclude refunds and disputes.",
        false,
      ),
      makeCheck(
        "recent_mfa",
        "Draw permission and recent MFA are verified",
        false,
        "The execution service must enforce lottery:draw and recent server-verified MFA.",
        false,
      ),
      makeCheck(
        "execution_safeguards",
        "Atomic draw and audit safeguards are verified",
        false,
        "Database locking, single execution, immutable snapshot and transactional audit remain unverified.",
        false,
      ),
    ];
    return json(
      {
        ok: true,
        lottery: {
          id: lottery.id,
          title: lottery.title,
          internal_reference: lottery.internal_reference,
          status: lottery.status,
          draw_at: lottery.draw_at,
          sales_close_at: lottery.sales_close_at,
        },
        metrics: {
          paid_orders: paid.count,
          issued_tickets: issued.count,
          eligible_tickets: null,
          excluded_tickets: excluded.count,
          prizes_available: prizes.count,
          unresolved_warnings: warnings.count,
          previous_draws: draws.count,
        },
        ready: false,
        readiness_verified: false,
        execution_enabled: false,
        counts_snapshot_atomic: false,
        generated_at: new Date().toISOString(),
        checks,
      },
      requestId,
    );
  } catch (error) {
    controller.abort();
    const status = error instanceof RouteError ? error.status : 500;
    if (status >= 500)
      console.error("Draw readiness request failed", {
        request_id: requestId,
        stage,
        status,
      });
    return json(
      {
        ok: false,
        error:
          error instanceof RouteError
            ? error.message
            : "Unable to complete the draw readiness checks.",
        code:
          status === 401
            ? "AUTHENTICATION_REQUIRED"
            : status === 403
              ? "READINESS_ACCESS_DENIED"
              : status < 500
                ? "READINESS_REQUEST_INVALID"
                : "READINESS_REQUEST_FAILED",
        execution_enabled: false,
        retryable: false,
      },
      requestId,
      status,
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", cancel);
  }
}
