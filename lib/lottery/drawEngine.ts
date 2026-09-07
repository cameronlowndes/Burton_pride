import { createHash, randomInt } from "node:crypto";

import { writeLotteryAuditSafe } from "./audit-server";
import { lotteryAdminDb, type LotteryAdmin } from "./adminAuth";
import type { DrawReadinessCheck } from "./types";

type TicketRow = {
  id: string;
  lottery_id: string;
  order_id: string;
  ticket_number: string;
  status: string;
};

type PrizeRow = {
  id: string;
  name: string;
  display_order: number | null;
};

export async function getDrawReadiness(lotteryId: string) {
  const db = lotteryAdminDb();

  const { data: lottery, error: lotteryError } = await db
    .from("lotteries")
    .select(
      "id,title,slug,internal_reference,status,sales_close_at,draw_at,compliance_approved_at",
    )
    .eq("id", lotteryId)
    .maybeSingle();

  if (lotteryError || !lottery) {
    throw Object.assign(new Error("Lottery not found."), { status: 404 });
  }

  const now = Date.now();
  const salesCloseMs = lottery.sales_close_at
    ? new Date(lottery.sales_close_at).getTime()
    : Number.NaN;

  const [
    paidOrdersResult,
    eligibleTicketsResult,
    excludedTicketsResult,
    prizesResult,
    unresolvedIntegrityResult,
    completedDrawResult,
  ] = await Promise.all([
    db
      .from("lottery_orders")
      .select("id", { count: "exact", head: true })
      .eq("lottery_id", lotteryId)
      .eq("payment_status", "paid"),
    db
      .from("lottery_tickets")
      .select("id", { count: "exact", head: true })
      .eq("lottery_id", lotteryId)
      .eq("status", "issued"),
    db
      .from("lottery_tickets")
      .select("id", { count: "exact", head: true })
      .eq("lottery_id", lotteryId)
      .in("status", ["void", "refunded", "test"]),
    db
      .from("lottery_prizes")
      .select("id", { count: "exact", head: true })
      .eq("lottery_id", lotteryId)
      .eq("status", "available_for_draw"),
    db
      .from("lottery_integrity_warnings")
      .select("id", { count: "exact", head: true })
      .eq("lottery_id", lotteryId)
      .eq("resolved", false),
    db
      .from("lottery_draws")
      .select("id,status")
      .eq("lottery_id", lotteryId)
      .eq("status", "completed")
      .limit(1),
  ]);

  const queryError =
    paidOrdersResult.error ||
    eligibleTicketsResult.error ||
    excludedTicketsResult.error ||
    prizesResult.error ||
    unresolvedIntegrityResult.error ||
    completedDrawResult.error;

  if (queryError) {
    throw Object.assign(new Error("The draw readiness checks could not be completed."), {
      status: 500,
      cause: queryError,
    });
  }

  const paidOrders = paidOrdersResult.count ?? 0;
  const eligibleTickets = eligibleTicketsResult.count ?? 0;
  const excludedTickets = excludedTicketsResult.count ?? 0;
  const prizesAvailable = prizesResult.count ?? 0;
  const unresolvedWarnings = unresolvedIntegrityResult.count ?? 0;
  const alreadyCompleted = (completedDrawResult.data?.length ?? 0) > 0;

  const checks: DrawReadinessCheck[] = [
    {
      key: "sales_closed",
      label: "Sales are closed",
      ok:
        ["sales_closed", "draw_ready"].includes(lottery.status) ||
        (!Number.isNaN(salesCloseMs) && salesCloseMs <= now),
      detail: lottery.sales_close_at
        ? `Sales close: ${lottery.sales_close_at}`
        : "No sales closing date is configured.",
    },
    {
      key: "not_cancelled",
      label: "Lottery is not paused, cancelled or under review",
      ok: !["paused", "cancelled", "under_review"].includes(lottery.status),
    },
    {
      key: "compliance",
      label: "Compliance approval is valid",
      ok: Boolean(lottery.compliance_approved_at),
    },
    {
      key: "integrity",
      label: "No unresolved payment or ticket integrity warnings",
      ok: unresolvedWarnings === 0,
      detail: unresolvedWarnings
        ? `${unresolvedWarnings} unresolved warning(s).`
        : null,
    },
    {
      key: "paid_orders",
      label: "Paid orders exist",
      ok: paidOrders > 0,
      detail: `${paidOrders} paid order(s).`,
    },
    {
      key: "eligible_tickets",
      label: "Eligible ticket pool is available",
      ok: eligibleTickets > 0,
      detail: `${eligibleTickets} issued ticket(s) eligible before snapshot creation.`,
    },
    {
      key: "prizes",
      label: "Prizes are available for allocation",
      ok: prizesAvailable > 0,
      detail: `${prizesAvailable} prize(s) available for draw.`,
    },
    {
      key: "not_completed",
      label: "A completed draw does not already exist",
      ok: !alreadyCompleted,
    },
  ];

  return {
    lottery,
    metrics: {
      paid_orders: paidOrders,
      eligible_tickets: eligibleTickets,
      excluded_tickets: excludedTickets,
      prizes_available: prizesAvailable,
    },
    checks,
    ready: checks.every((check) => check.ok),
  };
}

function shuffleIndexes(length: number) {
  const indexes = Array.from({ length }, (_, index) => index);

  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const randomIndex = randomInt(0, index + 1);
    [indexes[index], indexes[randomIndex]] = [
      indexes[randomIndex],
      indexes[index],
    ];
  }

  return indexes;
}

async function failDraw(params: {
  drawId: string;
  lotteryTitle: string;
  reason: string;
  admin: LotteryAdmin;
}) {
  const db = lotteryAdminDb();
  const { error } = await db.rpc("lottery_fail_draw", {
    p_draw_id: params.drawId,
    p_reason: params.reason,
  });

  if (error) {
    console.error("Unable to mark lottery draw as failed:", error);
    return;
  }

  // This is a real state change, so it belongs in Lottery Management audit logs.
  await writeLotteryAuditSafe({
    admin: params.admin,
    actionCode: "draw.failed",
    actionLabel: "Lottery draw failed",
    actionGroup: "draw",
    riskLevel: "high",
    entityType: "draw",
    entityId: params.drawId,
    reason: `Draw ${params.drawId} for lottery "${params.lotteryTitle}" failed. ${params.reason}`,
  });
}

export async function executeSecureDraw(
  lotteryId: string,
  admin: LotteryAdmin,
) {
  const db = lotteryAdminDb();
  const readiness = await getDrawReadiness(lotteryId);

  if (!readiness.ready) {
    // No draw record has changed yet, so a blocked readiness check is not audited.
    throw Object.assign(
      new Error(
        "This draw is blocked because one or more integrity checks failed.",
      ),
      {
        status: 409,
        details: readiness.checks.filter((check) => !check.ok),
      },
    );
  }

  /*
   * The database RPC performs the lock, snapshot creation and draw shell
   * atomically. This prevents two admins from starting the same draw at once.
   */
  const { data: startData, error: startError } = await db.rpc(
    "lottery_begin_draw",
    {
      p_lottery_id: lotteryId,
      p_admin_id: admin.id,
      p_admin_email: admin.email,
      p_admin_name: admin.name,
    },
  );

  if (startError) {
    throw Object.assign(new Error("Could not start the secure draw."), {
      status: 409,
      cause: startError,
    });
  }

  const drawId = String(startData?.draw_id ?? startData?.[0]?.draw_id ?? "");

  if (!drawId) {
    throw new Error("Secure draw initialization did not return a draw ID.");
  }

  const [
    { data: tickets, error: ticketError },
    { data: prizes, error: prizeError },
  ] = await Promise.all([
    db
      .from("lottery_draw_entries")
      .select("ticket_id,lottery_id,order_id,ticket_number")
      .eq("draw_id", drawId)
      .order("ticket_number", { ascending: true }),
    db
      .from("lottery_prizes")
      .select("id,name,display_order")
      .eq("lottery_id", lotteryId)
      .eq("status", "available_for_draw")
      .order("display_order", { ascending: true }),
  ]);

  if (ticketError || prizeError || !tickets?.length || !prizes?.length) {
    const failureReason =
      "Snapshot or prizes unavailable after draw initialization.";

    await failDraw({
      drawId,
      lotteryTitle: readiness.lottery.title,
      reason: failureReason,
      admin,
    });

    throw new Error(
      "The draw could not continue because its frozen data was incomplete.",
    );
  }

  const normalizedTickets: TicketRow[] = tickets.map((row: any) => ({
    id: row.ticket_id,
    lottery_id: row.lottery_id,
    order_id: row.order_id,
    ticket_number: row.ticket_number,
    status: "issued",
  }));

  const normalizedPrizes: PrizeRow[] = prizes as PrizeRow[];

  if (normalizedPrizes.length > normalizedTickets.length) {
    const failureReason = "More prizes than eligible tickets.";

    await failDraw({
      drawId,
      lotteryTitle: readiness.lottery.title,
      reason: failureReason,
      admin,
    });

    throw Object.assign(
      new Error("There are more drawable prizes than eligible tickets."),
      { status: 409 },
    );
  }

  const canonicalSnapshot = normalizedTickets
    .map(
      (ticket) =>
        `${ticket.id}:${ticket.ticket_number}:${ticket.order_id}`,
    )
    .join("\n");

  const snapshotHash = createHash("sha256")
    .update(canonicalSnapshot)
    .digest("hex");
  const winningIndexes = shuffleIndexes(normalizedTickets.length).slice(
    0,
    normalizedPrizes.length,
  );

  const allocations = normalizedPrizes.map((prize, index) => {
    const ticket = normalizedTickets[winningIndexes[index]];

    return {
      prize_id: prize.id,
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      order_id: ticket.order_id,
    };
  });

  const { data: finishData, error: finishError } = await db.rpc(
    "lottery_complete_draw",
    {
      p_draw_id: drawId,
      p_snapshot_hash: snapshotHash,
      p_allocations: allocations,
      p_admin_id: admin.id,
      p_admin_email: admin.email,
      p_admin_name: admin.name,
    },
  );

  if (finishError) {
    const failureReason = "Result commit failed after secure selection.";

    await failDraw({
      drawId,
      lotteryTitle: readiness.lottery.title,
      reason: failureReason,
      admin,
    });

    throw new Error(
      "The winner selection could not be committed. No result has been published.",
    );
  }

  // Only the completed state change is logged; readiness checks and page views are not.
  await writeLotteryAuditSafe({
    admin,
    actionCode: "draw.completed",
    actionLabel: "Lottery draw completed",
    actionGroup: "draw",
    riskLevel: "critical",
    entityType: "draw",
    entityId: drawId,
    reason: `Secure draw ${drawId} for lottery "${readiness.lottery.title}" completed with ${normalizedTickets.length} eligible ticket(s) and ${allocations.length} winner allocation(s). Snapshot hash: ${snapshotHash}.`,
  });

  const winners = allocations.map((allocation, index) => ({
    prize_id: allocation.prize_id,
    prize_name: normalizedPrizes[index].name,
    ticket_id: allocation.ticket_id,
    ticket_number: allocation.ticket_number,
    winner_status: "contact_pending",
  }));

  return {
    draw: {
      id: drawId,
      completed_at:
        finishData?.completed_at ??
        finishData?.[0]?.completed_at ??
        new Date().toISOString(),
      eligible_ticket_count: normalizedTickets.length,
      snapshot_hash: snapshotHash,
    },
    winners,
  };
}