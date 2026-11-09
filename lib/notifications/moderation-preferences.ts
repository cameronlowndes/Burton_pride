export type ModerationPreferences = {
  enabled: boolean;
  urgentAlerts: boolean;
  highAlerts: boolean;
  routineAlerts: boolean;
  systemAlerts: boolean;
  urgentBypass: boolean;
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  quietDays: number[];
  catchUp: boolean;
  awayUntil: string;
  holidayStart: string;
  holidayEnd: string;
  revision: string | null;
};

export type ModerationPreferenceStatus = {
  mode: "off" | "active" | "quiet" | "away" | "holiday";
  resumesAt: string | null;
};

export const priorityOptions = ["urgentAlerts", "highAlerts", "routineAlerts", "systemAlerts", "urgentBypass"] as const;

type OptionalPreference = typeof priorityOptions[number] | "quietDays" | "catchUp";
export type ModerationPreferenceUpdate = Omit<ModerationPreferences, OptionalPreference> &
  Partial<Pick<ModerationPreferences, OptionalPreference>> & { expectedAdminId?: string };

export type NotificationAdmin = {
  id: string;
  name: string;
  role: string;
  canReview: boolean;
  canControl: boolean;
};

export type SavedModerationPreferences = {
  admin?: NotificationAdmin;
  preferences: ModerationPreferences;
  status: ModerationPreferenceStatus;
};

export const moderationPreferencesApi = "/api/admin/notifications/moderation-preferences";
export const moderationNotificationsPath = "/Admin/SocialMediaModeration/Notifications";
export const moderationInboxPath = "/Admin/Notifications?source=moderation";
