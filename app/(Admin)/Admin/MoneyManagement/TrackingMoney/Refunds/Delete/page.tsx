import HiddenRefundsPageClient from "../../../../components/money/Refunds/Delete/HiddenRefundsPageClient";
import { requireAdmin } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Deleted Refunds | Burton Pride Admin Portal",
  description:
    "View and restore refunds that were moved out of the active refund tracker.",
};

export default async function HiddenRefundsPage() {
  await requireAdmin();

  return <HiddenRefundsPageClient />;
}