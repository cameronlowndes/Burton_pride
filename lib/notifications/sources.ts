export const notificationSources = {
  dashboard: {
    label: "Admin Dashboard",
    connected: true,
    settingsHref:
      "/Admin/Dashboard/Notifications?source=dashboard#dashboard-notification-settings",
  },
  bug_tracker: { label: "Bug Tracker", connected: true, settingsHref: "/Admin/Dashboard/Notifications/BugTracker" },
  email: { label: "Email Centre", connected: false, settingsHref: null },
  event_hub: { label: "Event Hub", connected: false, settingsHref: null },
  lottery: {
    label: "Lottery Management",
    connected: false,
    settingsHref: null,
  },
  money: { label: "Money Management", connected: false, settingsHref: null },
  moderation: {
    label: "Social Media Moderation",
    connected: true,
    settingsHref: "/Admin/SocialMediaModeration/Notifications",
  },
  stock: { label: "Stock Management", connected: false, settingsHref: null },
} as const;

export type NotificationSource = keyof typeof notificationSources;

export function isNotificationSource(
  value: unknown,
): value is NotificationSource {
  return typeof value === "string" && Object.hasOwn(notificationSources, value);
}
