import { NextResponse } from "next/server";
import { lotteryAdminDb, requireLotteryPermission } from "@/lib/lottery/adminAuth";
import { loadDrawReadiness } from "@/lib/lottery/drawReadiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
const LIST_STATUSES = ["scheduled", "live", "sales_closed", "draw_ready", "completed", "under_review"];
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "X-Content-Type-Options": "nosniff",
  } });
}
export async function GET() {
  try {
    await requireLotteryPermission("lottery:view");
    const db = lotteryAdminDb();
    const ids: string[] = [];
    // Explicit paging avoids silently dropping lotteries at the API row limit.
    for (let offset = 0; ; offset += 200) {
      const page = await db.from("lotteries").select("id")
        .in("status", LIST_STATUSES).order("id", { ascending: true }).range(offset, offset + 199);
      if (page.error || !Array.isArray(page.data)) throw page.error ?? new Error("Lottery list unavailable");
      if (ids.length + page.data.length > 10_000) throw new Error("Draw register exceeds the supported limit");
      ids.push(...page.data.map((row) => row.id));
      if (page.data.length < 200) break;
    }
    const items = [];
    // Keep database concurrency bounded while using the same checks as POST.
    for (let offset = 0; offset < ids.length; offset += 4) {
      const batch = await Promise.all(ids.slice(offset, offset + 4).map((id) => loadDrawReadiness(db, id)));
      for (const state of batch) {
        if (!state) continue;
        const { lottery, metrics } = state;
        const salesClosedCheck = state.checks.find((check: { key: string; ok: boolean }) => check.key === "sales_closed");
        const lotteryStateCheck = state.checks.find((check: { key: string; ok: boolean }) => check.key === "lottery_state");
        const drawTimeCheck = state.checks.find((check: { key: string; ok: boolean }) => check.key === "draw_time");
        items.push({ id: lottery.id, title: lottery.title, slug: lottery.slug,
          internal_reference: lottery.internal_reference, lottery_status: lottery.status,
          draw_at: lottery.draw_at, sales_close_at: lottery.sales_close_at,
          ...metrics, draw_status: state.draw_status,
          latest_draw_id: state.latest_draw_id, latest_draw_status: state.latest_draw_status,
          previous_failed_draw_safe: state.previous_failed_draw_safe,
          unresolved_warnings: state.unresolved_warnings, block_reasons: state.block_reasons,
          sales_closed: !!salesClosedCheck && !!lotteryStateCheck && salesClosedCheck.ok && lotteryStateCheck.ok,
          draw_time_reached: !!drawTimeCheck && drawTimeCheck.ok,
          requires_draw_readiness_check: true,
        });
      }
    }
    items.sort((a, b) => (a.draw_at ? Date.parse(a.draw_at) : Infinity) - (b.draw_at ? Date.parse(b.draw_at) : Infinity));
    return json({ ok: true, items, summary: {
      ready: items.filter((item) => item.draw_status === "ready").length,
      upcoming: items.filter((item) => item.draw_status === "upcoming").length,
      running: items.filter((item) => item.draw_status === "running").length,
      completed: items.filter((item) => item.draw_status === "completed").length,
      blocked: items.filter((item) => ["blocked", "under_review"].includes(item.draw_status)).length,
    } });
  } catch (error) {
    const candidate = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 500;
    const status = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 503;
    if (status >= 500) console.error("[lottery draw list] Query failed", error);
    return json({ ok: false, error: status >= 500 ? "The draw register could not be verified. Refresh and check the server logs if this continues."
      : error instanceof Error ? error.message : "The request could not be completed." }, status);
  }
}
