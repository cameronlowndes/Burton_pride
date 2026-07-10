import EventAuditPage from "@/components/admin/event-hub/audit/EventAuditPage";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Event Hub Audit Log | Burton Pride Admin",
  robots: { index: false, follow: false },
};

export default function EventHubAuditLogPage() {
  return <EventAuditPage />;
}
