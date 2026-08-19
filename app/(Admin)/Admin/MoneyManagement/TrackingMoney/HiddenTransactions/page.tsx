
import type { Metadata } from "next";

import TransactionsHidden from "../../../components/money/Clients/DeleteTransactions/DeleteTransactionsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hidden Transactions ",
  description:
    "This is Page to Delete Tranasaction inside Money Management",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function TransactionsHiddenPage() {
  return <TransactionsHidden />;
}