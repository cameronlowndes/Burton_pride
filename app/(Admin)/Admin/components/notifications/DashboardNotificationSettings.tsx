"use client";
import {
  dashboardCategories,
  preferencesApi,
} from "@/lib/notifications/dashboard";
import NotificationPreferenceEditor from "./NotificationPreferenceEditor";
export default function DashboardNotificationSettings() {
  return (
    <NotificationPreferenceEditor
      api={preferencesApi}
      title="Dashboard phone preferences"
      enabledLabel="Enable dashboard phone alerts"
      saveLabel="Save dashboard settings"
      savedMessage="Dashboard notification settings saved."
      categoryOptions={dashboardCategories}
      introduction="These settings affect your dashboard phone alerts. Your authorised inbox entries remain available. Register each receiving device using Phone notifications."
    />
  );
}
