
import type { Metadata } from "next";

import TransactionsHidden from "../../../components/money/Clients/Suppliers/SuppliersClients";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Suppliers For Money Management",
  description:
    "This is the page to keep track with Suppliers connect to Burton Pride",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function TransactionsHiddenPage() {
  return <TransactionsHidden />;
}