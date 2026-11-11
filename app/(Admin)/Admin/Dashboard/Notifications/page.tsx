import type { Metadata } from "next";

import { isNotificationSource } from "@/lib/notifications/sources";
import NotificationInbox from "../../components/notifications/NotificationInbox";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string | string[] }>;
}) {
  const { source } = await searchParams;
  const initialSource = isNotificationSource(source) ? source : "";
  return <NotificationInbox initialSource={initialSource} />;
}
