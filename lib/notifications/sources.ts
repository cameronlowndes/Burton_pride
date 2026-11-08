export const notificationSources = {
  dashboard: { label: "Admin Dashboard", connected: false },
  bug_tracker: { label: "Bug Tracker", connected: false },
  email: { label: "Email Centre", connected: false },
  event_hub: { label: "Event Hub", connected: false },
  lottery: { label: "Lottery Management", connected: false },
  money: { label: "Money Management", connected: false },
  moderation: { label: "Social Media Moderation", connected: true },
  stock: { label: "Stock Management", connected: false },
} as const;

export type NotificationSource = keyof typeof notificationSources;

export function isNotificationSource(value: unknown): value is NotificationSource {
  return typeof value === "string" && Object.hasOwn(notificationSources, value);
}
