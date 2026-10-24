import type { Metadata } from "next";
import { Suspense } from "react";
import { requireLotteryPermission } from "@/lib/lottery/adminAuth";
import FinanceClient from "../../components/LotteryManagement/Finance/FinanceClient";
export const metadata: Metadata = {
  title: "Finance & Transfers | Lottery Management",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function FinancePage() {
  await requireLotteryPermission("lottery:finance:view");
  return (
    <Suspense fallback={<p role="status">Loading lottery finances…</p>}>
      <FinanceClient />
    </Suspense>
  );
}
