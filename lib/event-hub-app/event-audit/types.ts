export const EVENT_AUDIT_STATUSES = [
  "success",
  "failed",
  "blocked",
  "warning",
  "pending",
  "partial_success",
  "cancelled",
] as const;

export const EVENT_AUDIT_RISK_LEVELS = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const EVENT_AUDIT_AREAS = [
  "authentication",
  "security",
  "events",
  "contacts",
  "organisations",
  "applications",
  "documents",
  "compliance",
  "checklist",
  "pitches",
  "site_map",
  "email",
  "money",
  "sponsorship",
  "users",
  "permissions",
  "exports",
  "system",
] as const;

export type EventAuditStatus = (typeof EVENT_AUDIT_STATUSES)[number];
export type EventAuditRiskLevel = (typeof EVENT_AUDIT_RISK_LEVELS)[number];
export type EventAuditArea = (typeof EVENT_AUDIT_AREAS)[number] | string;

export type EventAuditPermission =
  | "event_audit:view"
  | "event_audit:view_all_events"
  | "event_audit:view_security"
  | "event_audit:view_ip_addresses"
  | "event_audit:view_sensitive_changes"
  | "event_audit:export"
  | "event_audit:manage_alerts"
  | "event_audit:add_investigation_notes"
  | "event_audit:restore_records"
  | "event_audit:manage_retention"
  | "event_audit:delete";

export type EventAuditActor = {
  id: string | null;
  email: string | null;
  name: string;
  role: string | null;
  permissionKeys: string[];
  permissionsSnapshot: unknown;
  sessionReference?: string | null;
};

export type EventAuditRecord = {
  type?: string | null;
  id?: string | null;
  title?: string | null;
  organisationId?: string | null;
  contactId?: string | null;
  applicationId?: string | null;
  documentId?: string | null;
  transactionId?: string | null;
};

export type CreateEventAuditLogInput = {
  eventId?: string | null;
  actor?: EventAuditActor | null;
  action: string;
  actionLabel?: string;
  area: EventAuditArea;
  category?: string | null;
  status?: EventAuditStatus;
  riskLevel?: EventAuditRiskLevel;
  record?: EventAuditRecord | null;
  before?: unknown;
  after?: unknown;
  changedFields?: Record<string, unknown> | null;
  reason?: string | null;
  summary?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
  request?: Request | null;
  requestId?: string | null;
  responseStatus?: number | null;
  isConfidential?: boolean;
  isSecurityEvent?: boolean;
  requiresReview?: boolean;
  parentAuditLogId?: string | null;
  strict?: boolean;
};

export type EventAuditFilters = {
  q: string;
  eventId: string;
  adminId: string;
  area: string;
  status: string[];
  risk: string[];
  recordType: string;
  recordId: string;
  action: string;
  dateFrom: string;
  dateTo: string;
  securityOnly: boolean;
  reviewOnly: boolean;
  page: number;
  pageSize: number;
  sortField: "created_at" | "admin_name" | "area" | "status" | "risk_level";
  sortDirection: "asc" | "desc";
};
