import { requireLotteryPermission } from "@/lib/lottery/adminAuth";
import ReadyToPrintClient from "../../components/LotteryManagement/PaperTickets/ReadyToPrintClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = {
  title: "Paper tickets - Ready to Print | Burton Pride",
  robots: { index: false, follow: false },
};

export default async function ReadyToPrintPage({ searchParams }: {
  searchParams: Promise<{ batch?: string | string[] }>;
}) {
  await requireLotteryPermission("lottery:manage");
  const params = await searchParams;
  const batchId = typeof params.batch === "string" ? params.batch : "";
  return <ReadyToPrintClient key={batchId || "overview"} initialBatchId={batchId} />;
}
