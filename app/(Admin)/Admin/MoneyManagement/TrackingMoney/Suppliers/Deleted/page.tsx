
import type { Metadata } from "next";

import TransactionsHidden from "../../../../components/money/Clients/Suppliers/Delete/SuppliersDeleteClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Delete Suppliers For Money Management",
  description:
    "This page to Delete Suppliers Connect to Burton Pride",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function TransactionsHiddenPage() {
  return <TransactionsHidden />;
}