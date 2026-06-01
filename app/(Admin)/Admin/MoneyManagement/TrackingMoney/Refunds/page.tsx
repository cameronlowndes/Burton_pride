import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import MoneyRefundTracker from "../../../components/money/Refunds/MoneyRefundTracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Refund Tracker | Burton Pride Admin Portal",
  description:
    "Track refunds separately from normal income and expenses.",
};

export default async function MoneyRefundsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <MoneyRefundTracker />;
}