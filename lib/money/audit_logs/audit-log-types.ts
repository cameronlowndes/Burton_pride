export type AuditRiskLevel = "High" | "Medium" | "Low";

export type AuditRiskMatchType =
  | "action"
  | "area"
  | "source"
  | "route"
  | "title"
  | "metadata";

export type MoneyAuditRiskRule = {
  id: string;
  label: string;
  risk_level: AuditRiskLevel;
  match_type: AuditRiskMatchType;
  match_value: string;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
};

export type MoneyAuditLog = {
  id: string;
  created_at: string;
  action: string;
  transaction_id: string | null;
  transaction_title: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  created_by?: string | null;
  created_by_email?: string | null;
  created_by_user_id?: string | null;
  before_data: any;
  after_data: any;
  changed_fields: any;
  metadata: any;
  admin_comment?: string | null;
  admin_comment_updated_at?: string | null;
  admin_comment_updated_by?: string | null;
  admin_comment_updated_by_email?: string | null;
};

export type SortMode = "newest" | "oldest" | "action" | "transaction";
export type YearFilter = "all" | string;
export type RiskFilter = "all" | AuditRiskLevel;
export type AreaFilter = "all" | string;