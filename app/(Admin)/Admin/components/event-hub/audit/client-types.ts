/**
 * Shared client-side TypeScript types for the Burton Pride Event Hub audit log.
 *
 * Keep this file beside the Event Audit client components that import:
 *   import type { ... } from "./client-types";
 *
 * This version includes backwards-compatible aliases so older Event Audit
 * components can continue importing names such as AuditEventOption,
 * AuditAdminOption and SavedView while the newer names remain available.
 */

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = Record<string, JsonValue>;

export type Nullable<T> = T | null;
export type OptionalNullable<T> = T | null | undefined;

export type AuditRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "unknown"
  | (string & {});

export type AuditLogStatus =
  | "success"
  | "failed"
  | "partial_success"
  | "warning"
  | "blocked"
  | "pending"
  | "cancelled"
  | "reviewing"
  | "resolved"
  | "dismissed"
  | "unknown"
  | (string & {});

export type AuditAlertStatus =
  | "open"
  | "reviewing"
  | "resolved"
  | "dismissed"
  | (string & {});

export type AuditHttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD"
  | (string & {});

export type AuditDeviceType =
  | "desktop"
  | "mobile"
  | "tablet"
  | "bot"
  | "unknown"
  | (string & {});

export type AuditRecordType =
  | "event"
  | "contact"
  | "stallholder"
  | "business_contact"
  | "checklist"
  | "document"
  | "admin"
  | "security_alert"
  | "investigation_note"
  | (string & {});

/**
 * One changed field recorded by the audit system.
 *
 * Both snake_case and camelCase names are supported so the UI can safely
 * consume either database or API naming conventions.
 */
export type AuditChangedField = {
  field?: string;
  field_name?: string;
  fieldName?: string;
  label?: string;

  old_value?: JsonValue;
  oldValue?: JsonValue;
  before?: JsonValue;

  new_value?: JsonValue;
  newValue?: JsonValue;
  after?: JsonValue;

  is_sensitive?: boolean;
  isSensitive?: boolean;

  [key: string]: unknown;
};

/**
 * The API may return changed fields as a list, keyed object or null.
 */
export type AuditChangedFields =
  | AuditChangedField[]
  | Record<string, unknown>
  | null;

export type AuditLogRow = {
  id: string;
  created_at: string;

  event_id?: Nullable<string>;
  parent_audit_id?: Nullable<string>;
  linked_audit_id?: Nullable<string>;

  admin_id?: Nullable<string>;
  admin_name?: Nullable<string>;
  admin_email?: Nullable<string>;
  admin_role?: Nullable<string>;

  area?: Nullable<string>;
  action: string;
  action_label?: Nullable<string>;
  status: AuditLogStatus;
  risk_level: AuditRiskLevel;
  is_security_event?: boolean;

  summary?: Nullable<string>;
  reason?: Nullable<string>;

  record_type?: Nullable<AuditRecordType>;
  record_id?: Nullable<string>;
  record_title?: Nullable<string>;

  changed_fields?: AuditChangedFields;
  before_data?: Nullable<JsonObject>;
  after_data?: Nullable<JsonObject>;
  metadata?: Nullable<JsonObject>;

  request_id?: Nullable<string>;
  route?: Nullable<string>;
  http_method?: Nullable<AuditHttpMethod>;
  response_status?: Nullable<number>;

  browser?: Nullable<string>;
  operating_system?: Nullable<string>;
  device_type?: Nullable<AuditDeviceType>;
  user_agent?: Nullable<string>;
  ip_address?: Nullable<string>;

  error_code?: Nullable<string>;
  error_message?: Nullable<string>;

  entry_hash?: Nullable<string>;
  previous_entry_hash?: Nullable<string>;

  updated_at?: Nullable<string>;

  /**
   * Allows harmless extra columns returned by Supabase queries and joins.
   */
  [key: string]: unknown;
};

export type AuditAlert = {
  id: string;
  created_at: string;

  audit_log_id?: Nullable<string>;
  event_id?: Nullable<string>;

  title: string;
  description?: Nullable<string>;
  severity: AuditRiskLevel;
  status: AuditAlertStatus;

  alert_type?: Nullable<string>;
  rule_key?: Nullable<string>;
  matched_value?: Nullable<string>;

  assigned_admin_id?: Nullable<string>;
  assigned_admin_name?: Nullable<string>;
  assigned_admin_email?: Nullable<string>;

  resolution_notes?: Nullable<string>;
  resolved_at?: Nullable<string>;
  resolved_by_admin_id?: Nullable<string>;
  resolved_by_admin_name?: Nullable<string>;

  updated_at?: Nullable<string>;

  [key: string]: unknown;
};

export type InvestigationNote = {
  id: string;
  created_at: string;

  audit_log_id?: Nullable<string>;
  alert_id?: Nullable<string>;
  event_id?: Nullable<string>;

  admin_id?: Nullable<string>;
  admin_name?: Nullable<string>;
  admin_email?: Nullable<string>;
  admin_role?: Nullable<string>;

  note: string;
  is_confidential: boolean;
  updated_at?: Nullable<string>;

  [key: string]: unknown;
};

export type AuditPermissions = {
  viewAuditLog: boolean;
  viewAllEvents: boolean;
  viewSecurityEvents: boolean;
  viewSensitiveChanges: boolean;
  addNotes: boolean;
  manageAlerts: boolean;
  restoreRecords: boolean;
  exportAuditLog: boolean;

  /** Optional permissions used by wider Event Audit screens. */
  manageSavedViews?: boolean;
  deleteSavedViews?: boolean;
  viewConfidentialNotes?: boolean;
  manageAuditSettings?: boolean;

  /**
   * Backwards-compatible permission property names used by older components.
   * These are optional so newer API responses do not need to include them.
   */
  viewSecurity?: boolean;
  viewIpAddresses?: boolean;
  export?: boolean;
};

export type EventAuditOption = {
  value: string;
  label: string;
};

export type EventAuditEventOption = EventAuditOption & {
  year?: Nullable<number>;
  date?: Nullable<string>;
  is_active?: boolean;
  is_archived?: boolean;

  /**
   * Optional legacy API fields.
   */
  id?: string;
  event_name?: string;
  event_year?: Nullable<number>;
  event_date?: Nullable<string>;
};

export type EventAuditAdminOption = EventAuditOption & {
  email?: Nullable<string>;
  role?: Nullable<string>;

  /**
   * Optional legacy API fields.
   */
  admin_id?: string;
  admin_name?: Nullable<string>;
  admin_email?: Nullable<string>;
  admin_role?: Nullable<string>;
};

export type AuditDateRange = {
  from: string;
  to: string;
};

export type AuditFilters = {
  search: string;
  eventId: string;
  adminId: string;
  area: string;
  action: string;
  status: string;
  riskLevel: string;
  recordType: string;
  httpMethod: string;
  securityOnly: boolean;
  hasChangesOnly: boolean;
  hasErrorsOnly: boolean;
  dateFrom: string;
  dateTo: string;
};

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  search: "",
  eventId: "",
  adminId: "",
  area: "",
  action: "",
  status: "",
  riskLevel: "",
  recordType: "",
  httpMethod: "",
  securityOnly: false,
  hasChangesOnly: false,
  hasErrorsOnly: false,
  dateFrom: "",
  dateTo: "",
};

export type AuditSortField =
  | "created_at"
  | "action"
  | "area"
  | "admin_name"
  | "status"
  | "risk_level";

export type AuditSortDirection = "asc" | "desc";

export type AuditPagination = {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;

  /**
   * Legacy pagination property used by some page components.
   */
  total?: number;
};

export type AuditSummary = {
  total: number;
  successful: number;
  failed: number;
  warnings: number;
  securityEvents: number;
  openAlerts: number;
  highRisk: number;
  criticalRisk: number;

  /**
   * Optional legacy summary values retained for compatibility with older
   * dashboard cards and earlier API responses.
   */
  activeAdmins?: number;
  securityAlerts?: number;
  documentsChanged?: number;
  changesToday?: number;
};

export type AuditSavedView = {
  id: string;
  name: string;
  admin_id?: Nullable<string>;
  is_shared: boolean;
  is_default: boolean;
  filters: Partial<AuditFilters>;
  sort_field?: Nullable<AuditSortField>;
  sort_direction?: Nullable<AuditSortDirection>;
  created_at: string;
  updated_at?: Nullable<string>;
};

export type AuditListResponse = {
  ok: boolean;
  error?: string;

  logs: AuditLogRow[];

  summary?: Partial<AuditSummary>;
  pagination?: Partial<AuditPagination>;
  permissions?: Partial<AuditPermissions>;

  events?: EventAuditEventOption[];
  admins?: EventAuditAdminOption[];
  savedViews?: AuditSavedView[];

  refreshedAt?: string;
};

export type AuditDetailsResponse = {
  ok: boolean;
  error?: string;
  log?: AuditLogRow;
  alerts?: AuditAlert[];
  notes?: InvestigationNote[];
};

export type AuditMutationResponse<T = undefined> = {
  ok: boolean;
  error?: string;
  message?: string;
  data?: T;
};

export type CreateInvestigationNotePayload = {
  note: string;
  is_confidential: boolean;
  alert_id?: Nullable<string>;
};

export type UpdateAuditAlertPayload = {
  status: AuditAlertStatus;
  resolution_notes?: string;
  reason: string;
};

export type RestoreAuditRecordPayload = {
  reason: string;
};



export type AuditEventOption = EventAuditEventOption;
export type AuditAdminOption = EventAuditAdminOption;
export type SavedView = AuditSavedView;
