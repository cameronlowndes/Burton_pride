import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import BankBalanceCheckPageClient from "../../../components/money/BankBalanceCheckPageClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Manual Bank Balance Check | Burton Pride Admin Portal",
  description:
    "Compare the real bank statement balance with Burton Pride Money In.",
};

export default async function BankBalanceCheckPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <BankBalanceCheckPageClient />;
}
