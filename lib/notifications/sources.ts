import { stockNotificationSettingsPath } from "./stock";
import { moneyNotificationSettingsPath } from "./money";
import { lotteryNotificationSettingsPath } from "./lottery";
import { eventHubNotificationSettingsPath } from "./event-hub";
import { bugNotificationSettingsPath } from "./bug-tracker";
import { emailNotificationSettingsPath } from "./email";

export const notificationSources = {
  dashboard: {
    label: "Admin Dashboard",
    connected: true,
    settingsHref:
      "/Admin/Dashboard/Notifications?source=dashboard#dashboard-notification-settings",
  },
  bug_tracker: {
    label: "Bug Tracker",
    connected: true,
    settingsHref: bugNotificationSettingsPath,
  },
  email: {
    label: "Email Centre",
    connected: true,
    settingsHref: emailNotificationSettingsPath,
  },
  event_hub: {
    label: "Event Hub",
    connected: true,
    settingsHref: eventHubNotificationSettingsPath,
  },
  lottery: {
    label: "Lottery Management",
    connected: true,
    settingsHref: lotteryNotificationSettingsPath,
  },
  money: {
    label: "Money Management",
    connected: true,
    settingsHref: moneyNotificationSettingsPath,
  },
  moderation: {
    label: "Social Media Moderation",
    connected: true,
    settingsHref: "/Admin/SocialMediaModeration/Notifications",
  },
  stock: {
    label: "Stock Control",
    connected: true,
    settingsHref: stockNotificationSettingsPath,
  },
} as const;

export type NotificationSource = keyof typeof notificationSources;

export function isNotificationSource(
  value: unknown,
): value is NotificationSource {
  return typeof value === "string" && Object.hasOwn(notificationSources, value);
}
