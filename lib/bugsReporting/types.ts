export const BUG_APPLICATIONS = [
  "admin_portal",
  "money_management",
  "stock_control",
  "event_hub",
  "public_website",
] as const;

export const BUG_PRIORITIES = [
  "minor",
  "normal",
  "senior",
] as const;

export const BUG_STATUSES = [
  "reported",
  "acknowledged",
  "investigating",
  "in_progress",
  "waiting_for_information",
  "fix_ready",
  "testing",
  "resolved",
  "closed",
  "reopened",
  "rejected",
  "duplicate",
] as const;

export const BUG_ACTIVITY_ACTIONS = [
  "bug_reported",
  "bug_acknowledged",
  "priority_changed",
  "status_changed",
  "assigned",
  "comment_added",
  "investigation_started",
  "fix_ready",
  "testing_started",
  "bug_resolved",
  "bug_closed",
  "bug_reopened",
  "bug_rejected",
  "bug_marked_duplicate",
  "screenshot_uploaded",
  "attachment_uploaded",
  "email_notification_sent",
  "email_notification_failed",
  "email_notification_retried",
  "bug_deleted",
] as const;

export type BugApplication = (typeof BUG_APPLICATIONS)[number];
export type BugPriority = (typeof BUG_PRIORITIES)[number];
export type BugStatus = (typeof BUG_STATUSES)[number];
export type BugActivityAction =
  (typeof BUG_ACTIVITY_ACTIONS)[number];

export type BugAttachment = {
  name: string;
  url: string;
  type?: string | null;
  size?: number | null;
};

export type BugReport = {
  id: string;
  reference_number: string;

  title: string;
  description: string;

  application: BugApplication;
  affected_feature: string | null;
  page_url: string | null;

  priority: BugPriority;
  status: BugStatus;

  steps_to_reproduce: string | null;
  expected_result: string | null;
  actual_result: string | null;

  browser_name: string | null;
  device_type: string | null;
  operating_system: string | null;

  screenshot_url: string | null;
  attachment_urls: string[];

  reporter_admin_id: string | null;
  reporter_name: string | null;
  reporter_email: string | null;

  assigned_admin_id: string | null;
  assigned_admin_name: string | null;

  resolution_notes: string | null;
  internal_notes: string | null;

  email_notification_sent: boolean;
  email_notification_error: string | null;
  email_notification_sent_at: string | null;

  first_response_at: string | null;
  investigation_started_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;

  created_at: string;
  updated_at: string;
};

export type BugReportActivity = {
  id: string;
  bug_report_id: string;

  action: BugActivityAction | string;
  description: string;

  previous_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;

  admin_id: string | null;
  admin_name: string | null;
  admin_email: string | null;

  created_at: string;
};

export type BugReportComment = {
  id: string;
  bug_report_id: string;

  comment: string;
  is_internal: boolean;

  admin_id: string | null;
  admin_name: string | null;
  admin_email: string | null;

  created_at: string;
  updated_at: string;
};

export type BugSummary = {
  total: number;
  open: number;
  minor: number;
  normal: number;
  senior: number;
  resolved: number;
};

export type CreateBugReportInput = {
  title: string;
  description: string;

  application: BugApplication;
  priority: BugPriority;

  affected_feature?: string | null;
  page_url?: string | null;

  steps_to_reproduce?: string | null;
  expected_result?: string | null;
  actual_result?: string | null;

  browser_name?: string | null;
  device_type?: string | null;
  operating_system?: string | null;

  screenshot_url?: string | null;
  attachment_urls?: string[];
};

export type UpdateBugReportInput = {
  title?: string;
  description?: string;

  application?: BugApplication;
  affected_feature?: string | null;
  page_url?: string | null;

  priority?: BugPriority;
  status?: BugStatus;

  steps_to_reproduce?: string | null;
  expected_result?: string | null;
  actual_result?: string | null;

  assigned_admin_id?: string | null;
  assigned_admin_name?: string | null;

  resolution_notes?: string | null;
  internal_notes?: string | null;

  screenshot_url?: string | null;
  attachment_urls?: string[];
};

export type BugTrackerListResponse = {
  ok: boolean;
  reports?: BugReport[];
  summary?: BugSummary;

  error?: string;
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;

  requestId?: string;
  request_id?: string;
};

export type BugTrackerCreateResponse = {
  ok: boolean;
  report?: BugReport;

  emailSent?: boolean;
  emailWarning?: string | null;

  message?: string;
  error?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;

  requestId?: string;
  request_id?: string;
};

export type BugTrackerSingleResponse = {
  ok: boolean;
  report?: BugReport;
  activity?: BugReportActivity[];
  comments?: BugReportComment[];

  error?: string;
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;

  requestId?: string;
  request_id?: string;
};

export const BUG_APPLICATION_LABELS: Record<
  BugApplication,
  string
> = {
  admin_portal: "Admin Portal",
  money_management: "Money Management",
  stock_control: "Stock Control",
  event_hub: "Event Hub",
  public_website: "Public Website",
};

export const BUG_PRIORITY_LABELS: Record<
  BugPriority,
  string
> = {
  minor: "Minor Bug",
  normal: "Normal Issue",
  senior: "Senior Bug — Critical",
};

export const BUG_STATUS_LABELS: Record<
  BugStatus,
  string
> = {
  reported: "Reported",
  acknowledged: "Acknowledged",
  investigating: "Investigating",
  in_progress: "Fix in progress",
  waiting_for_information: "Waiting for information",
  fix_ready: "Fix ready",
  testing: "Testing",
  resolved: "Resolved",
  closed: "Closed",
  reopened: "Reopened",
  rejected: "Rejected",
  duplicate: "Duplicate",
};

export const BUG_PRIORITY_CONFIG = {
  minor: {
    label: "Minor Bug",
    shortLabel: "Minor",
    icon: "🟢",
    description:
      "A small cosmetic, spelling, layout or usability issue with little or no impact on the system.",
    target: "Fixed when development time allows",
    targetHours: null,
    urgent: false,
  },

  normal: {
    label: "Normal Issue",
    shortLabel: "Normal",
    icon: "🟡",
    description:
      "An issue that affects how a feature works but does not completely prevent the system from being used.",
    target: "Scheduled within the normal development cycle",
    targetHours: null,
    urgent: false,
  },

  senior: {
    label: "Senior Bug — Critical",
    shortLabel: "Senior",
    icon: "🔴",
    description:
      "A serious issue involving broken features, data, security or an important task that cannot be completed.",
    target: "Normally investigated and fixed within 1–2 days",
    targetHours: 48,
    urgent: true,
  },
} satisfies Record<
  BugPriority,
  {
    label: string;
    shortLabel: string;
    icon: string;
    description: string;
    target: string;
    targetHours: number | null;
    urgent: boolean;
  }
>;

export const BUG_STATUS_CONFIG = {
  reported: {
    label: "Reported",
    isClosed: false,
  },
  acknowledged: {
    label: "Acknowledged",
    isClosed: false,
  },
  investigating: {
    label: "Investigating",
    isClosed: false,
  },
  in_progress: {
    label: "Fix in progress",
    isClosed: false,
  },
  waiting_for_information: {
    label: "Waiting for information",
    isClosed: false,
  },
  fix_ready: {
    label: "Fix ready",
    isClosed: false,
  },
  testing: {
    label: "Testing",
    isClosed: false,
  },
  resolved: {
    label: "Resolved",
    isClosed: true,
  },
  closed: {
    label: "Closed",
    isClosed: true,
  },
  reopened: {
    label: "Reopened",
    isClosed: false,
  },
  rejected: {
    label: "Rejected",
    isClosed: true,
  },
  duplicate: {
    label: "Duplicate",
    isClosed: true,
  },
} satisfies Record<
  BugStatus,
  {
    label: string;
    isClosed: boolean;
  }
>;

export function isBugApplication(
  value: unknown,
): value is BugApplication {
  return BUG_APPLICATIONS.includes(value as BugApplication);
}

export function isBugPriority(
  value: unknown,
): value is BugPriority {
  return BUG_PRIORITIES.includes(value as BugPriority);
}

export function isBugStatus(
  value: unknown,
): value is BugStatus {
  return BUG_STATUSES.includes(value as BugStatus);
}

export function isClosedBugStatus(status: BugStatus) {
  return BUG_STATUS_CONFIG[status].isClosed;
}

export function isOpenBugReport(report: Pick<BugReport, "status">) {
  return !isClosedBugStatus(report.status);
}

export function getBugApplicationLabel(
  application: BugApplication,
) {
  return BUG_APPLICATION_LABELS[application];
}

export function getBugPriorityLabel(priority: BugPriority) {
  return BUG_PRIORITY_LABELS[priority];
}

export function getBugStatusLabel(status: BugStatus) {
  return BUG_STATUS_LABELS[status];
}

export function getBugPrioritySortValue(
  priority: BugPriority,
) {
  switch (priority) {
    case "senior":
      return 3;
    case "normal":
      return 2;
    case "minor":
      return 1;
  }
}

export function isSeniorBugOverdue(
  report: Pick<BugReport, "priority" | "status" | "created_at">,
  now = new Date(),
) {
  if (report.priority !== "senior") return false;
  if (isClosedBugStatus(report.status)) return false;

  const createdAt = new Date(report.created_at);

  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  const ageInMilliseconds =
    now.getTime() - createdAt.getTime();

  return ageInMilliseconds >= 48 * 60 * 60 * 1000;
}
