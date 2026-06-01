import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import HiddenRefundsPageClient from "../../../../components/money/Refunds/Delete/HiddenRefundsPageClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Deleted Refunds | Burton Pride Admin Portal",
  description:
    "View and restore refunds that were moved out of the active refund tracker.",
};

export default async function HiddenRefundsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <HiddenRefundsPageClient />;
}
