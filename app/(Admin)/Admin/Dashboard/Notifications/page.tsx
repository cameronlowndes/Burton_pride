import type { Metadata } from "next";
import NotificationInbox from "../../components/notifications/NotificationInbox";

export const metadata: Metadata = {
  title: "Notifications",
  manifest: "/admin-notifications.webmanifest",
  icons: { apple: "/image/AdminLogo.png" },
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string | string[] }>;
}) {
  const { source } = await searchParams;
  const initialSource = source === "moderation" ? source : "";
  return <NotificationInbox key={initialSource} initialSource={initialSource} />;
}
