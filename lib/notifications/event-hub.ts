export const eventHubNotificationCategories = {
  event_changed: "Events created and key details changed",
  application_created: "New stallholder and vendor applications",
  application_status: "Application decisions and status changes",
  payment_status: "Application payment status changes",
  contact_changed: "Contacts created and key details changed",
  checklist_changed: "Checklist confirmations and arrival updates",
  document_uploaded: "Documents uploaded for the event",
  document_review: "Document reviews and status changes",
  terms_published: "Application terms published",
  audit_alert: "Audit alerts requiring attention",
} as const;
export const eventHubNotificationSettingsApi =
  "/api/admin/notifications/event-hub-preferences";
export const eventHubNotificationSettingsPath =
  "/Admin/Dashboard/Notifications/EventHub";
