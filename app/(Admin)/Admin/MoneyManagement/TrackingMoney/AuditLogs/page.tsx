
import type { Metadata } from "next";

import AuditLogs from "../../../components/money/Clients/AuditLogs/AuditLogsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Audit Logs For Money Managment",
  description:
    "The Page for Audit Logs on the Money Management App ",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AuditLogsPage() {
  return <AuditLogs />;
}