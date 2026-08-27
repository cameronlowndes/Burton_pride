export type LotteryAuditActionGroup =
  | "lottery"
  | "ticket"
  | "payment"
  | "prize"
  | "draw"
  | "winner"
  | "compliance"
  | "security"
  | "export";

export type LotteryAuditRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type LotteryAuditEntityType =
  | "lottery"
  | "ticket"
  | "order"
  | "payment"
  | "refund"
  | "prize"
  | "draw"
  | "winner"
  | "compliance_profile"
  | "terms"
  | "export"
  | "admin"
  | "security"
  | "audit_log"
  | "audit_logs"
  | "audit_export"
  | "other";

export interface LotteryAuditDeviceContext {
  browser?: string | null;
  browserVersion?: string | null;
  os?: string | null;
  osVersion?: string | null;
  deviceType?: string | null;
  deviceName?: string | null;
  userAgent?: string | null;
  platform?: string | null;
}

export interface LotteryAuditLog {
  id: string;

  lottery_id: string | null;
  lottery_title: string | null;

  entity_type: LotteryAuditEntityType | string | null;
  entity_id: string | null;

  admin_id: string | null;
  admin_email: string | null;
  admin_name: string | null;

  action_group: LotteryAuditActionGroup;
  action_code: string;
  action_label: string;

  risk_level: LotteryAuditRiskLevel;

  reason: string | null;

  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;

  ip_address: string | null;
  device_context: LotteryAuditDeviceContext | null;

  metadata: Record<string, unknown> | null;

  created_at: string;
}

export interface LotteryAuditLogFilters {
  search?: string;

  lotteryId?: string;
  adminId?: string;

  actionGroup?: LotteryAuditActionGroup | "all";
  riskLevel?: LotteryAuditRiskLevel | "all";

  entityType?: string;
  actionCode?: string;

  dateFrom?: string;
  dateTo?: string;
}

export interface LotteryAuditSummary {
  total: number;
  highRisk: number;
  denied: number;
  exports: number;
  draws: number;
}

/**
 * Response shape used by:
 * GET /api/admin/lottery/audit-logs
 */
export interface LotteryAuditResponse {
  logs: LotteryAuditLog[];

  total: number;
  page: number;
  pageSize: number;

  summary: LotteryAuditSummary;
}

/**
 * Alternative paginated response type.
 * Kept here in case another part of the Lottery app already uses it.
 */
export interface LotteryAuditLogsResponse {
  success: boolean;

  data: LotteryAuditLog[];

  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Response shape used when loading one audit record.
 */
export interface LotteryAuditLogResponse {
  success: boolean;
  data: LotteryAuditLog;
}

export interface CreateLotteryAuditLogInput {
  lotteryId?: string | null;
  lotteryTitle?: string | null;

  entityType?: LotteryAuditEntityType | string | null;
  entityId?: string | null;

  adminId?: string | null;
  adminEmail?: string | null;
  adminName?: string | null;

  actionGroup: LotteryAuditActionGroup;
  actionCode: string;
  actionLabel: string;

  riskLevel?: LotteryAuditRiskLevel;

  reason?: string | null;

  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;

  ipAddress?: string | null;
  deviceContext?: LotteryAuditDeviceContext | null;

  metadata?: Record<string, unknown> | null;
}

export interface LotteryAuditExportFilters
  extends LotteryAuditLogFilters {
  format?: "csv";
}

export interface LotteryAuditQueryParams {
  page?: number;
  pageSize?: number;

  search?: string;

  group?: LotteryAuditActionGroup | "";
  risk?: LotteryAuditRiskLevel | "";

  from?: string;
  to?: string;

  sort?:
    | "created_at"
    | "action_group"
    | "action_label"
    | "risk_level";

  direction?: "asc" | "desc";
}

export const LOTTERY_AUDIT_ACTION_GROUPS: {
  value: LotteryAuditActionGroup;
  label: string;
}[] = [
  {
    value: "lottery",
    label: "Lottery",
  },
  {
    value: "ticket",
    label: "Tickets",
  },
  {
    value: "payment",
    label: "Payments",
  },
  {
    value: "prize",
    label: "Prizes",
  },
  {
    value: "draw",
    label: "Draws",
  },
  {
    value: "winner",
    label: "Winners",
  },
  {
    value: "compliance",
    label: "Compliance",
  },
  {
    value: "security",
    label: "Security",
  },
  {
    value: "export",
    label: "Exports",
  },
];

export const LOTTERY_AUDIT_RISK_LEVELS: {
  value: LotteryAuditRiskLevel;
  label: string;
}[] = [
  {
    value: "low",
    label: "Low",
  },
  {
    value: "medium",
    label: "Medium",
  },
  {
    value: "high",
    label: "High",
  },
  {
    value: "critical",
    label: "Critical",
  },
];

export const LOTTERY_AUDIT_ENTITY_TYPES: {
  value: LotteryAuditEntityType;
  label: string;
}[] = [
  {
    value: "lottery",
    label: "Lottery",
  },
  {
    value: "ticket",
    label: "Ticket",
  },
  {
    value: "order",
    label: "Order",
  },
  {
    value: "payment",
    label: "Payment",
  },
  {
    value: "refund",
    label: "Refund",
  },
  {
    value: "prize",
    label: "Prize",
  },
  {
    value: "draw",
    label: "Draw",
  },
  {
    value: "winner",
    label: "Winner",
  },
  {
    value: "compliance_profile",
    label: "Compliance Profile",
  },
  {
    value: "terms",
    label: "Terms",
  },
  {
    value: "export",
    label: "Export",
  },
  {
    value: "admin",
    label: "Admin",
  },
  {
    value: "security",
    label: "Security",
  },
  {
    value: "audit_log",
    label: "Audit Log",
  },
  {
    value: "audit_logs",
    label: "Audit Logs",
  },
  {
    value: "audit_export",
    label: "Audit Export",
  },
  {
    value: "other",
    label: "Other",
  },
];

export const LOTTERY_AUDIT_SORT_FIELDS = [
  "created_at",
  "action_group",
  "action_label",
  "risk_level",
] as const;

export type LotteryAuditSortField =
  (typeof LOTTERY_AUDIT_SORT_FIELDS)[number];

export function isLotteryAuditActionGroup(
  value: unknown,
): value is LotteryAuditActionGroup {
  return (
    typeof value === "string" &&
    [
      "lottery",
      "ticket",
      "payment",
      "prize",
      "draw",
      "winner",
      "compliance",
      "security",
      "export",
    ].includes(value)
  );
}

export function isLotteryAuditRiskLevel(
  value: unknown,
): value is LotteryAuditRiskLevel {
  return (
    typeof value === "string" &&
    [
      "low",
      "medium",
      "high",
      "critical",
    ].includes(value)
  );
}

export function isLotteryAuditEntityType(
  value: unknown,
): value is LotteryAuditEntityType {
  return (
    typeof value === "string" &&
    [
      "lottery",
      "ticket",
      "order",
      "payment",
      "refund",
      "prize",
      "draw",
      "winner",
      "compliance_profile",
      "terms",
      "export",
      "admin",
      "security",
      "audit_log",
      "audit_logs",
      "audit_export",
      "other",
    ].includes(value)
  );
}

export function isLotteryAuditSortField(
  value: unknown,
): value is LotteryAuditSortField {
  return (
    typeof value === "string" &&
    LOTTERY_AUDIT_SORT_FIELDS.includes(
      value as LotteryAuditSortField,
    )
  );
}

export function getLotteryAuditActionGroupLabel(
  group: LotteryAuditActionGroup,
): string {
  return (
    LOTTERY_AUDIT_ACTION_GROUPS.find(
      (item) => item.value === group,
    )?.label ?? group
  );
}

export function getLotteryAuditRiskLabel(
  risk: LotteryAuditRiskLevel,
): string {
  return (
    LOTTERY_AUDIT_RISK_LEVELS.find(
      (item) => item.value === risk,
    )?.label ?? risk
  );
}

export function getLotteryAuditEntityLabel(
  entityType: LotteryAuditEntityType,
): string {
  return (
    LOTTERY_AUDIT_ENTITY_TYPES.find(
      (item) => item.value === entityType,
    )?.label ?? entityType
  );
}

export function isHighRiskLotteryAudit(
  log: Pick<LotteryAuditLog, "risk_level">,
): boolean {
  return (
    log.risk_level === "high" ||
    log.risk_level === "critical"
  );
}

export function isSecurityLotteryAudit(
  log: Pick<LotteryAuditLog, "action_group">,
): boolean {
  return log.action_group === "security";
}

export function isDrawLotteryAudit(
  log: Pick<LotteryAuditLog, "action_group">,
): boolean {
  return log.action_group === "draw";
}

export function isExportLotteryAudit(
  log: Pick<LotteryAuditLog, "action_group">,
): boolean {
  return log.action_group === "export";
}