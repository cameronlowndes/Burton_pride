export const bugNotificationCategories = {
  report_created: "New bug reports",
  assignment_changed: "Assignment changes",
  status_changed: "Status changes",
  priority_changed: "Priority changes",
  comment_added: "New comments",
  internal_note: "Internal notes",
} as const;
export const bugNotificationSettingsApi =
  "/api/admin/notifications/bug-tracker-preferences";
export const bugNotificationSettingsPath =
  "/Admin/Dashboard/Notifications/BugTracker";
