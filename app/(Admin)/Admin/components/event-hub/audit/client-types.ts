export type AuditLogRow = {
  id: string;
  created_at: string;
  event_id: string | null;
  admin_id: string | null;
  admin_email: string | null;
  admin_name: string | null;
  admin_role: string | null;
  action: string;
  action_label: string;
  area: string;
  category?: string | null;
  status: string;
  risk_level: string;
  record_type: string | null;
  record_id: string | null;
  record_title: string | null;
  route: string | null;
  http_method: string | null;
  response_status: number | null;
  request_id: string;
  browser: string | null;
  operating_system: string | null;
  device_type: string | null;
  ip_address: string | null;
  is_confidential: boolean;
  is_security_event: boolean;
  requires_review: boolean;
  summary: string | null;
  reason?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  changed_fields?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  entry_hash?: string | null;
  previous_entry_hash?: string | null;
};

export type AuditSummary = {
  total: number;
  successful: number;
  failed: number;
  highRisk: number;
  activeAdmins: number;
  securityAlerts: number | null;
  documentsChanged: number;
  changesToday: number;
};

export type AuditPermissions = {
  viewSecurity: boolean;
  viewIpAddresses: boolean;
  viewSensitiveChanges: boolean;
  export: boolean;
  manageAlerts: boolean;
  addNotes: boolean;
  restoreRecords?: boolean;
};

export type AuditEventOption = {
  id: string;
  event_name: string;
  event_year: number;
  event_date: string | null;
  is_active: boolean;
  is_archived: boolean;
};

export type AuditAdminOption = {
  admin_id: string;
  admin_name: string | null;
  admin_email: string | null;
  admin_role: string | null;
};

export type SavedView = {
  id: string;
  admin_id: string;
  name: string;
  filters: Record<string, unknown>;
  visible_columns: string[];
  sort_field: string;
  sort_direction: string;
  is_shared: boolean;
  is_default: boolean;
};

export type AuditAlert = {
  id: string;
  audit_log_id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  assigned_to: string | null;
  investigation_notes: string | null;
  resolution_notes: string | null;
  created_at: string;
};

export type InvestigationNote = {
  id: string;
  admin_name: string | null;
  admin_email: string | null;
  note: string;
  is_confidential: boolean;
  created_at: string;
};
