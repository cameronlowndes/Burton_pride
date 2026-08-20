
import type { Metadata } from "next";

import CashTracking from "../../../components/money/Clients/BankReconciliation/BankReconciliationClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bank Reconciliation",
  description:
    "This Page to do your Bank Reconciliation",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function CashTrackingPage() {
  return <CashTracking />;
}