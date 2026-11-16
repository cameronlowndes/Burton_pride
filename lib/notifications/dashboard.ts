export const dashboardCategories = {
  task_assigned: "Tasks assigned to you",
  task_reminder: "Task reminders",
  task_overdue: "Overdue tasks",
  approval_requested: "Approval requests",
  approval_completed: "Approval outcomes",
  account_changed: "Account and permission changes",
  security_alert: "Security alerts",
  announcement: "Portal announcements",
  service_alert: "Maintenance and service issues",
  export_ready: "Reports and exports",
} as const;

export type DashboardCategory = keyof typeof dashboardCategories;
export type Priority = "routine" | "action" | "urgent";
export const priorityLabels: Record<Priority, string> = {
  routine: "Information",
  action: "Action required",
  urgent: "Urgent",
};
export const defaultCategories: Record<DashboardCategory, boolean> = {
  task_assigned: true,
  task_reminder: true,
  task_overdue: true,
  approval_requested: true,
  approval_completed: false,
  account_changed: true,
  security_alert: true,
  announcement: false,
  service_alert: true,
  export_ready: false,
};
export type DashboardPreferences = {
  revision: string;
  enabled: boolean;
  categories: Record<DashboardCategory, boolean>;
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  awayUntil: string;
  holidayStart: string;
  holidayEnd: string;
  urgentBypass: boolean;
};
export const NOTIFICATION_API = "/api/admin/notifications";
export const NOTIFICATIONS_CHANGED = "admin-notifications-changed";
export const preferencesApi = "/api/admin/notifications/dashboard-preferences";

export function safeAdminPath(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 1000 ||
    !/^\/Admin(?:\/|\?|$)/.test(value) ||
    /[\\\s\x00-\x1f\x7f]/.test(value)
  )
    return null;
  try {
    const url = new URL(value, "https://portal.invalid");
    if (
      url.origin !== "https://portal.invalid" ||
      !/^\/Admin(?:\/|$)/.test(url.pathname)
    )
      return null;
    if (/^\/Admin\/(?:Login|Logout)(?:\/|$)/i.test(url.pathname)) return null;
    return value;
  } catch {
    return null;
  }
}

export type NotificationItem = {
  id: string;
  source_app: string;
  event_type: string;
  occurred_at: string;
  read_at: string | null;
  job_id?: string | null;
  platform?: string | null;
  reviewed_at?: string | null;
  is_open?: boolean;
  title?: string;
  message?: string;
  destination?: string;
  priority?: Priority;
  resolved_at?: string | null;
};
export type NotificationFeed = {
  enabled: boolean;
  autoRefresh?: boolean;
  items: NotificationItem[];
  unreadCount: number;
  hasNext: boolean;
  adminId: string;
  canDashboard: boolean;
  canModeration: boolean;
  canBugTracker?: boolean;
  canEmail?: boolean;
  canEventHub?: boolean;
  canLottery?: boolean;
  canMoney?: boolean;
  canStock?: boolean;
};
export function itemTitle(item: NotificationItem) {
  if (
    item.source_app === "dashboard" ||
    item.source_app === "bug_tracker" ||
    item.source_app === "email" ||
    item.source_app === "event_hub" ||
    item.source_app === "lottery" ||
    item.source_app === "money" ||
    item.source_app === "stock"
  )
    return (
      item.title ||
      (item.source_app === "stock"
        ? "Stock Control update"
        : item.source_app === "money"
          ? "Money Management update"
          : item.source_app === "lottery"
            ? "Lottery Management update"
            : item.source_app === "event_hub"
              ? "Event Hub update"
              : item.source_app === "email"
                ? "Email Centre update"
                : item.source_app === "bug_tracker"
                  ? "Bug Tracker update"
                  : "Admin Dashboard update")
    );
  if (item.event_type === "system_alert")
    return item.is_open
      ? "Moderation system needs attention"
      : "Moderation system recovered";
  if (item.reviewed_at) return "Comment reviewed";
  return item.event_type === "urgent_review"
    ? "Urgent safety review"
    : item.event_type === "high_review"
      ? "High-priority comment review"
      : "Comment needs review";
}
export function itemDestination(item: NotificationItem) {
  if (
    item.source_app === "dashboard" ||
    item.source_app === "bug_tracker" ||
    item.source_app === "email" ||
    item.source_app === "event_hub" ||
    item.source_app === "lottery" ||
    item.source_app === "money" ||
    item.source_app === "stock"
  )
    return (
      safeAdminPath(item.destination) ||
      (item.source_app === "stock"
        ? "/Admin/StockManagement/Inventory"
        : item.source_app === "money"
          ? "/Admin/MoneyManagement/TrackingMoney"
          : item.source_app === "lottery"
            ? "/Admin/LotteryManagement"
            : item.source_app === "event_hub"
              ? "/Admin/EventHub"
              : item.source_app === "email"
                ? "/Admin/Email"
                : item.source_app === "bug_tracker"
                  ? "/Admin/BugTracker"
                  : "/Admin/Dashboard")
    );
  return item.job_id
    ? `/Admin/SocialMediaModeration/JobsID?job=${encodeURIComponent(item.job_id)}`
    : "/Admin/SocialMediaModeration/Connections";
}
