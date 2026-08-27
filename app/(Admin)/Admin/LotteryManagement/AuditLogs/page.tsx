import type { Metadata } from "next";
import AuditLogs from "../../components/LotteryManagement/AuditLogs/AuditLogsClient";

export const metadata: Metadata = {
  title: "Audit Logs | Burton Pride Lottery Management",
  robots: {
    index: false,
    follow: false,
  },
  referrer: "no-referrer",
};

export default function AuditLogsPage() {
  return <AuditLogs />;
}
