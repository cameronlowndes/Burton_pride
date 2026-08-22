
import type { Metadata } from "next";

import BudgetTracker from "../../../../components/money/Clients/exports/Logs/ExportLogsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Audit Logs For Export Page",
  description:
    "This Audit Logs For Exports Page",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function BudgetTrackerPage() {
  return <BudgetTracker />;
}