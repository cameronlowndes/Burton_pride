
import type { Metadata } from "next";

import CashTracking from "../../../components/money/Clients/CVSImport/CVSImportClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CVS Import",
  description:
    "This Page to import CVS file into Money Management App",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function CashTrackingPage() {
  return <CashTracking />;
}