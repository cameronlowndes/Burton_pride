import type { Metadata } from "next";

import AdminAuditLogsClient from "../../../../components/Dashboard/Settings/security/AdminAuditLogsClient";

export const metadata: Metadata = {
  title: "Admin Portal Audit Logs",
  description:
    "Restricted Burton Pride Admin Portal page for reviewing security records, administrator activity and audit events.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      nositelinkssearchbox: true,
      "max-image-preview": "none",
      "max-snippet": 0,
      "max-video-preview": 0,
    },
  },
  referrer: "no-referrer",
};

export default function AdminAuditLogsPage() {
  return <AdminAuditLogsClient />;
}