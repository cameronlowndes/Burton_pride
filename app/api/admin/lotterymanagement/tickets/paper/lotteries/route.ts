import { lotteryAdminDb, requireLotteryPermission } from "@/lib/lottery/adminAuth";
import { printJson } from "@/lib/lottery/paper-print-server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  await requireLotteryPermission("lottery:manage");
  const { data, error } = await lotteryAdminDb().from("lotteries")
    .select("id,title,status,max_tickets")
    .eq("paper_tickets_enabled", true)
    .not("status", "in", "(completed,cancelled,archived)")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Paper lottery selection failed", error);
    return printJson({ ok: false, error: "Unable to load paper lotteries." }, 500);
  }
  return printJson({ ok: true, items: data || [] });
}
