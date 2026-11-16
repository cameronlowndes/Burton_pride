export const emailNotificationCategories = {
  new_message: "New inbox messages",
  important_message: "New messages Gmail marks important",
  email_sent: "Successful sends in shared history (Main Admins)",
  email_failed: "Failed sends in shared history (Main Admins)",
  connection_problem: "Gmail connection problems",
  connection_restored: "Gmail connection restored",
} as const;
export const emailNotificationSettingsApi =
  "/api/admin/notifications/email-preferences";
export const emailNotificationSettingsPath =
  "/Admin/Dashboard/Notifications/Email";

export function inboxEvents(
  messages: { id?: string | null; labelIds?: string[] | null }[],
) {
  return messages
    .filter(
      (m) =>
        m.id &&
        m.labelIds?.includes("INBOX") &&
        !m.labelIds.includes("SPAM") &&
        !m.labelIds.includes("TRASH") &&
        !m.labelIds.includes("SENT") &&
        !m.labelIds.includes("DRAFT"),
    )
    .map((m) => ({
      id: m.id!,
      category: m.labelIds!.includes("IMPORTANT")
        ? "important_message"
        : "new_message",
    }));
}
