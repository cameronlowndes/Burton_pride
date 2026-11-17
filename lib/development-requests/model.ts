export const DEVELOPMENT_REQUESTS_PATH = "/Admin/DevelopmentRequests";
export const requestStatuses = ["submitted", "under_review", "approved", "planned", "in_development", "testing", "completed", "on_hold", "rejected"] as const;
export const requestPriorities = ["low", "normal", "high", "urgent"] as const;
export type RequestStatus = typeof requestStatuses[number];
export type RequestPriority = typeof requestPriorities[number];
export function normalizeStatus(value: unknown): RequestStatus {
  const status = value === "pending" ? "submitted" : value === "in_progress" ? "in_development" : value;
  return (requestStatuses as readonly unknown[]).includes(status) ? status as RequestStatus : "submitted";
}
export function normalizePriority(value: unknown): RequestPriority {
  const priority = value === "critical" ? "urgent" : value;
  return (requestPriorities as readonly unknown[]).includes(priority) ? priority as RequestPriority : "normal";
}
export function normalizeRequest(row: Record<string, unknown>) {
  return { ...row, status: normalizeStatus(row.status), priority: normalizePriority(row.priority),
    reference_number: row.reference_number || `DEV-${row.id}`, assigned_to_name: row.assigned_to_name ?? null };
}
