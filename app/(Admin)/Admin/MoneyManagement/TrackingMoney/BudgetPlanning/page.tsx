
import type { Metadata } from "next";

import BudgetTracker from "../../../components/money/Clients/BudgetTracker/BudgetTrackerClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Budget Tracker",
  description:
    "The Budget Tracker Page",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function BudgetTrackerPage() {
  return <BudgetTracker />;
}