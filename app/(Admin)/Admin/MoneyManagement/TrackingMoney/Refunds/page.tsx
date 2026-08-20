import MoneyRefundTracker from "../../../components/money/Clients/Refunds/MoneyRefundTracker";
import { requireAdmin } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Refund Tracker | Burton Pride Admin Portal",
  description:
    "Track refunds separately from normal income and expenses.",
};

export default async function MoneyRefundsPage() {
  await requireAdmin();

  return <MoneyRefundTracker />;
}