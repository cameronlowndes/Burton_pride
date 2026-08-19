
import type { Metadata } from "next";

import DirectDebit from "../../../components/money/Clients/DirectDebits/DirectDebitClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Direct Debit Page",
  description:
    "The Direct Debit Page",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function DirectDebitPage() {
  return <DirectDebit />;
}