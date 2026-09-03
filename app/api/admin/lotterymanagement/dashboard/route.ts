import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;

type PageResult<T> = {
  data: T[] | null;
  error: unknown | null;
};

type LotteryRow = {
  id: string;
  title: string | null;
  name: string | null;
  slug: string | null;
  status: string | null;
  is_active: boolean | null;
  sales_open_at: string | null;
  sales_close_at: string | null;
  draw_at: string | null;
  created_at: string;
};

type OrderRow = {
  id: string;
  lottery_id: string;
  quantity: number | null;
  total_amount: number | string | null;
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

type EntryRow = {
  id: string;
  lottery_id: string;
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
  message: string;
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
  admin_email: string | null;
  risk_level: string | null;
  created_at: string;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function requireActiveAdmin() {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user?.email) return null;

  let adminResult = await supabaseAdmin
    .from("admin_users")
    .select("id,email,full_name,role,is_active")
    .eq("supabase_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!adminResult.data) {
    adminResult = await supabaseAdmin
      .from("admin_users")
      .select("id,email,full_name,role,is_active")
      .ilike("email", user.email)
      .eq("is_active", true)
      .maybeSingle();
  }

  return adminResult.data || null;
}

async function loadAll<T>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
) {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await loadPage(from, from + PAGE_SIZE - 1);
    if (result.error) throw result.error;

    const page = result.data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

function lotteryTitle(lottery: LotteryRow | undefined) {
  return lottery?.title || lottery?.name || "Untitled lottery";
}

function time(value: string | null | undefined) {
  if (!value) return 0;
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : 0;
}

export async function GET() {
  try {
    const admin = await requireActiveAdmin();
    if (!admin) return json({ ok: false, error: "Unauthorized." }, 401);

    const [
      lotteries,
      orders,
      entries,
      tickets,
      winners,
      prizes,
      draws,
      warningRows,
      auditResult,
    ] = await Promise.all([
      loadAll<LotteryRow>((from, to) =>
        supabaseAdmin
          .from("lotteries")
          .select(
            "id,title,name,slug,status,is_active,sales_open_at,sales_close_at,draw_at,created_at",
          )
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      loadAll<OrderRow>((from, to) =>
        supabaseAdmin
          .from("lottery_orders")
          .select(
            "id,lottery_id,quantity,total_amount,payment_status,created_at",
          )
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      loadAll<EntryRow>((from, to) =>
        supabaseAdmin
          .from("lottery_entries")
          .select("id,lottery_id,created_at")
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      loadAll<TicketRow>((from, to) =>
        supabaseAdmin
          .from("lottery_tickets")
          .select("id,lottery_id,status,issued_at,created_at")
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      loadAll<WinnerRow>((from, to) =>
        supabaseAdmin
          .from("lottery_winners")
          .select(
            "id,lottery_id,prize_id,status,claimed,fulfilled_at,created_at",
          )
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      loadAll<PrizeRow>((from, to) =>
        supabaseAdmin
          .from("lottery_prizes")
          .select(
            "id,lottery_id,quantity,status,allocated_winner_id,claimed_at,fulfilled_at",
          )
          .order("id", { ascending: true })
          .range(from, to),
      ),
      loadAll<DrawRow>((from, to) =>
        supabaseAdmin
          .from("lottery_draws")
          .select("id,lottery_id,status,scheduled_at,created_at")
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      loadAll<WarningRow>((from, to) =>
        supabaseAdmin
          .from("lottery_integrity_warnings")
          .select(
            "id,lottery_id,warning_code,severity,message,resolved,created_at",
          )
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      supabaseAdmin
        .from("lottery_audit_logs")
        .select(
          "id,lottery_id,lottery_title,action_code,action_label,admin_name,admin_email,risk_level,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (auditResult.error) throw auditResult.error;

    const lotteryById = new Map(lotteries.map((item) => [item.id, item]));
    const completedStatuses = new Set(["completed", "archived", "cancelled"]);
    const activeLotteries = lotteries.filter(
      (item) =>
        item.is_active !== false &&
        !completedStatuses.has(String(item.status || "").toLowerCase()),
    );
    const liveLotteryIds = new Set(
      lotteries
        .filter((item) => String(item.status || "").toLowerCase() === "live")
        .map((item) => item.id),
    );
    const paidOrders = orders.filter(
      (item) => String(item.payment_status || "").toLowerCase() === "paid",
    );
    const paymentAttentionStatuses = new Set([
      "pending",
      "failed",
      "incomplete",
      "processing",
      "requires_action",
      "disputed",
    ]);
    const paymentAttentionOrders = orders.filter((item) =>
      paymentAttentionStatuses.has(
        String(item.payment_status || "pending").toLowerCase(),
      ),
    );
    const issuedTickets = tickets.filter((item) =>
      ["issued", "winner"].includes(String(item.status || "").toLowerCase()),
    );
    const unresolvedWarnings = warningRows.filter((item) => !item.resolved);

    const grossTicketProceeds = paidOrders.reduce(
      (total, order) => total + Number(order.total_amount || 0),
      0,
    );
    const currentLiveSales = paidOrders.reduce(
      (total, order) =>
        total +
        (liveLotteryIds.has(order.lottery_id)
          ? Number(order.total_amount || 0)
          : 0),
      0,
    );
    const paidTicketQuantity = paidOrders.reduce(
      (total, order) => total + Number(order.quantity || 0),
      0,
    );

    const unclaimedPrizeIds = new Set<string>();
    for (const winner of winners) {
      const status = String(winner.status || "").toLowerCase();
      if (
        winner.prize_id &&
        !winner.claimed &&
        !winner.fulfilled_at &&
        !["fulfilled", "disqualified", "replaced"].includes(status)
      ) {
        unclaimedPrizeIds.add(winner.prize_id);
      }
    }
    for (const prize of prizes) {
      const status = String(prize.status || "").toLowerCase();
      if (
        prize.allocated_winner_id &&
        !prize.claimed_at &&
        !prize.fulfilled_at &&
        !["fulfilled", "withdrawn"].includes(status)
      ) {
        unclaimedPrizeIds.add(prize.id);
      }
    }

    const now = Date.now();
    const upcomingSalesClosingDates = activeLotteries
      .filter((item) => time(item.sales_close_at) > now)
      .sort((a, b) => time(a.sales_close_at) - time(b.sales_close_at))
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        lottery_id: item.id,
        title: lotteryTitle(item),
        lottery_title: lotteryTitle(item),
        slug: item.slug,
        status: item.status,
        sales_close_at: item.sales_close_at,
      }));

    const scheduledDrawLotteryIds = new Set<string>();
    const upcomingDraws: Array<{
      id: string;
      draw_id: string | null;
      lottery_id: string;
      title: string;
      lottery_title: string;
      slug: string | null;
      status: string | null;
      scheduled_at: string | null;
      draw_at: string | null;
    }> = draws
      .filter(
        (item) =>
          time(item.scheduled_at) > now &&
          !["completed", "cancelled", "failed"].includes(
            String(item.status || "").toLowerCase(),
          ),
      )
      .map((item) => {
        scheduledDrawLotteryIds.add(item.lottery_id);
        const linkedLottery = lotteryById.get(item.lottery_id);
        return {
          id: item.id,
          draw_id: item.id,
          lottery_id: item.lottery_id,
          title: lotteryTitle(linkedLottery),
          lottery_title: lotteryTitle(linkedLottery),
          slug: linkedLottery?.slug || null,
          status: item.status,
          scheduled_at: item.scheduled_at,
          draw_at: item.scheduled_at,
        };
      });

    for (const item of activeLotteries) {
      if (
        time(item.draw_at) > now &&
        !scheduledDrawLotteryIds.has(item.id)
      ) {
        upcomingDraws.push({
          id: item.id,
          draw_id: null,
          lottery_id: item.id,
          title: lotteryTitle(item),
          lottery_title: lotteryTitle(item),
          slug: item.slug,
          status: item.status,
          scheduled_at: item.draw_at,
          draw_at: item.draw_at,
        });
      }
    }

    upcomingDraws.sort((a, b) => time(a.draw_at) - time(b.draw_at));
    const visibleUpcomingDraws = upcomingDraws.slice(0, 8);

    const warningItems = unresolvedWarnings.slice(0, 10).map((item) => {
      const linkedLottery = item.lottery_id
        ? lotteryById.get(item.lottery_id)
        : undefined;
      return {
        ...item,
        title: item.message,
        lottery_title: lotteryTitle(linkedLottery),
      };
    });

    const recentActivity = ((auditResult.data || []) as AuditRow[]).map(
      (item) => ({
        ...item,
        title: item.action_label || item.action_code || "Lottery activity",
        lottery_title:
          item.lottery_title ||
          lotteryTitle(
            item.lottery_id ? lotteryById.get(item.lottery_id) : undefined,
          ),
        admin:
          item.admin_name || item.admin_email || "Admin Portal",
      }),
    );

    const stats = {
      activeLotteries: activeLotteries.length,
      currentLiveSales,
      grossTicketProceeds,
      paidEntries: paidOrders.length,
      ticketsIssued: issuedTickets.length,
      paymentAttention: paymentAttentionOrders.length,
      unclaimedPrizes: unclaimedPrizeIds.size,
      complianceWarnings: unresolvedWarnings.length,
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

    const recentLotteries = [...lotteries]
      .sort((a, b) => time(b.created_at) - time(a.created_at))
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: lotteryTitle(item),
        slug: item.slug,
        status: item.status,
        created_at: item.created_at,
      }));

    const dashboard = {
      ...stats,
      stats,
      summary,
      totalLotteries: lotteries.length,
      liveLotteries: lotteries.filter((item) => item.status === "live").length,
      draftLotteries: lotteries.filter((item) => item.status === "draft").length,
      scheduledLotteries: lotteries.filter(
        (item) => item.status === "scheduled",
      ).length,
      completedLotteries: lotteries.filter(
        (item) => item.status === "completed",
      ).length,
      totalOrders: orders.length,
      paidOrders: paidOrders.length,
      paidTicketQuantity,
      totalEntries: entries.length,
      totalWinners: winners.length,
      totalRevenue: grossTicketProceeds,
      recentLotteries,
      upcomingSalesClosingDates,
      upcomingDraws: visibleUpcomingDraws,
      warningItems,
      recentActivity,
    };

    return json({
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
    });
  } catch (error) {
    console.error("[api/admin/lottery/dashboard][GET]", error);
    return json(
      { ok: false, success: false, error: "Unable to load lottery dashboard." },
      500,
    );
  }
}
