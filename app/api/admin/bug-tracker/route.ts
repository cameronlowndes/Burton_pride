import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminPermissions";
import { sendBugReportEmail } from "@/lib/bugsReporting/sendBugReportEmail";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUG_REPORTS_TABLE = "admin_bug_reports";
const BUG_ACTIVITY_TABLE = "admin_bug_report_activity";

const VALID_APPLICATIONS = [
  "admin_portal",
  "money_management",
  "stock_control",
  "event_hub",
  "public_website",
] as const;

const VALID_PRIORITIES = ["minor", "normal", "senior"] as const;

const VALID_STATUSES = [
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

type BugApplication = (typeof VALID_APPLICATIONS)[number];
type BugPriority = (typeof VALID_PRIORITIES)[number];
type BugStatus = (typeof VALID_STATUSES)[number];

type JsonRecord = Record<string, unknown>;

type AuthenticatedAdmin = {
  id: string;
  name?: string | null;
  email: string;
};

type BugReportRow = {
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

type ApiErrorOptions = {
  status: number;
  code: string;
  error: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
  requestId: string;
  metadata?: JsonRecord;
};

function createRequestId() {
  return `bug_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

function responseHeaders(requestId: string) {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Request-Id": requestId,
  };
}

function json(
  body: JsonRecord,
  status: number,
  requestId: string,
) {
  return NextResponse.json(body, {
    status,
    headers: responseHeaders(requestId),
  });
}

function apiError(options: ApiErrorOptions) {
  return json(
    {
      ok: false,
      code: options.code,
      error: options.error,
      message: options.message || options.error,
      details: options.details || null,
      hint: options.hint || null,
      requestId: options.requestId,
      ...(options.metadata ? { metadata: options.metadata } : {}),
    },
    options.status,
    options.requestId,
  );
}

function cleanText(
  value: unknown,
  maxLength: number,
): string | null {
  if (typeof value !== "string") return null;

  const text = value.trim();

  if (!text) return null;

  return text.slice(0, maxLength);
}

function cleanStringArray(
  value: unknown,
  maximumItems = 5,
): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maximumItems);
}

function isApplication(value: unknown): value is BugApplication {
  return VALID_APPLICATIONS.includes(value as BugApplication);
}

function isPriority(value: unknown): value is BugPriority {
  return VALID_PRIORITIES.includes(value as BugPriority);
}

function isStatus(value: unknown): value is BugStatus {
  return VALID_STATUSES.includes(value as BugStatus);
}

function createBugReference() {
  const now = new Date();

  const datePart = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");

  const randomPart = crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 6)
    .toUpperCase();

  return `BUG-${datePart}-${randomPart}`;
}

function normaliseSearch(value: string | null) {
  return String(value || "")
    .trim()
    .replaceAll(",", " ")
    .replaceAll("%", "")
    .slice(0, 200);
}

function getSupabaseErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return {
      message: "Unknown database error.",
      code: null,
      details: null,
      hint: null,
    };
  }

  const record = error as {
    message?: unknown;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  return {
    message:
      typeof record.message === "string"
        ? record.message
        : "Unknown database error.",
    code:
      typeof record.code === "string"
        ? record.code
        : null,
    details:
      typeof record.details === "string"
        ? record.details
        : null,
    hint:
      typeof record.hint === "string"
        ? record.hint
        : null,
  };
}

async function writeBugActivity(input: {
  bugReportId: string;
  action: string;
  description: string;
  admin: AuthenticatedAdmin;
  previousData?: unknown;
  newData?: unknown;
}) {
  const { error } = await supabaseAdmin
    .from(BUG_ACTIVITY_TABLE)
    .insert({
      bug_report_id: input.bugReportId,
      action: input.action,
      description: input.description,
      admin_id: input.admin.id,
      admin_name: input.admin.name || input.admin.email,
      admin_email: input.admin.email,
      previous_data: input.previousData || null,
      new_data: input.newData || null,
    });

  if (error) {
    console.error("Bug Tracker activity insert failed", {
      action: input.action,
      bugReportId: input.bugReportId,
      error,
    });
  }
}

function getSummary(reports: BugReportRow[]) {
  const closedStatuses = new Set<BugStatus>([
    "resolved",
    "closed",
    "rejected",
    "duplicate",
  ]);

  return {
    total: reports.length,
    open: reports.filter(
      (report) => !closedStatuses.has(report.status),
    ).length,
    minor: reports.filter(
      (report) => report.priority === "minor",
    ).length,
    normal: reports.filter(
      (report) => report.priority === "normal",
    ).length,
    senior: reports.filter(
      (report) => report.priority === "senior",
    ).length,
    resolved: reports.filter(
      (report) => report.status === "resolved",
    ).length,
  };
}

export async function GET(request: NextRequest) {
  const requestId = createRequestId();

  try {
    await requireAdmin();

    const searchParams = request.nextUrl.searchParams;

    const search = normaliseSearch(searchParams.get("search"));
    const application = searchParams.get("application");
    const priority = searchParams.get("priority");
    const status = searchParams.get("status");

    let query = supabaseAdmin
      .from(BUG_REPORTS_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (application && application !== "all") {
      if (!isApplication(application)) {
        return apiError({
          status: 400,
          code: "BUG-TRACKER-INVALID-APPLICATION",
          error: "The application filter is invalid.",
          details: `Received application value: ${application}`,
          hint:
            "Use admin_portal, money_management, stock_control, event_hub or public_website.",
          requestId,
        });
      }

      query = query.eq("application", application);
    }

    if (priority && priority !== "all") {
      if (!isPriority(priority)) {
        return apiError({
          status: 400,
          code: "BUG-TRACKER-INVALID-PRIORITY",
          error: "The priority filter is invalid.",
          details: `Received priority value: ${priority}`,
          hint: "Use minor, normal or senior.",
          requestId,
        });
      }

      query = query.eq("priority", priority);
    }

    if (status && status !== "all") {
      if (!isStatus(status)) {
        return apiError({
          status: 400,
          code: "BUG-TRACKER-INVALID-STATUS",
          error: "The status filter is invalid.",
          details: `Received status value: ${status}`,
          hint:
            "Use one of the supported Bug Tracker status values.",
          requestId,
        });
      }

      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(
        [
          `reference_number.ilike.%${search}%`,
          `title.ilike.%${search}%`,
          `description.ilike.%${search}%`,
          `affected_feature.ilike.%${search}%`,
          `reporter_name.ilike.%${search}%`,
          `reporter_email.ilike.%${search}%`,
          `assigned_admin_name.ilike.%${search}%`,
        ].join(","),
      );
    }

    const { data, error } = await query;

    if (error) {
      const databaseError = getSupabaseErrorDetails(error);

      console.error("Bug Tracker GET database failure", {
        requestId,
        databaseError,
      });

      return apiError({
        status: 500,
        code: "BUG-TRACKER-DATABASE-READ-FAILED",
        error: "Bug reports could not be loaded.",
        details: [
          databaseError.message,
          databaseError.code
            ? `Database code: ${databaseError.code}`
            : null,
          databaseError.details,
        ]
          .filter(Boolean)
          .join(" | "),
        hint:
          databaseError.hint ||
          `Check that the ${BUG_REPORTS_TABLE} table exists and that the server role can read it.`,
        requestId,
      });
    }

    const reports = (data || []) as BugReportRow[];

    return json(
      {
        ok: true,
        reports,
        summary: getSummary(reports),
        requestId,
      },
      200,
      requestId,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown authentication error.";

    console.error("Bug Tracker GET authentication failure", {
      requestId,
      error,
    });

    return apiError({
      status: 401,
      code: "BUG-TRACKER-AUTH-REQUIRED",
      error: "You must be signed in as an administrator.",
      details: message,
      hint:
        "Sign in to the Admin Portal again and then reload the Bug Tracker.",
      requestId,
    });
  }
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();

  try {
    const admin = (await requireAdmin()) as AuthenticatedAdmin;

    let body: JsonRecord;

    try {
      body = (await request.json()) as JsonRecord;
    } catch (error) {
      return apiError({
        status: 400,
        code: "BUG-TRACKER-INVALID-JSON",
        error: "The bug report request body is not valid JSON.",
        details:
          error instanceof Error ? error.message : null,
        hint:
          "Send the request with Content-Type application/json and a valid JSON body.",
        requestId,
      });
    }

    const title = cleanText(body.title, 200);
    const description = cleanText(body.description, 10_000);
    const application = body.application;
    const priority = body.priority;

    if (!title) {
      return apiError({
        status: 422,
        code: "BUG-TRACKER-TITLE-REQUIRED",
        error: "Enter a title for the bug.",
        details:
          "The title field is empty or was not supplied.",
        hint:
          "Add a short title that clearly identifies the problem.",
        requestId,
      });
    }

    if (!description) {
      return apiError({
        status: 422,
        code: "BUG-TRACKER-DESCRIPTION-REQUIRED",
        error: "Enter a description of the bug.",
        details:
          "The description field is empty or was not supplied.",
        hint:
          "Explain what happened, where it happened and what the user was trying to do.",
        requestId,
      });
    }

    if (!isApplication(application)) {
      return apiError({
        status: 422,
        code: "BUG-TRACKER-APPLICATION-REQUIRED",
        error: "Select which application has the bug.",
        details: `Received application value: ${String(
          application ?? "missing",
        )}`,
        hint:
          "Select Admin Portal, Money Management, Stock Control, Event Hub or Public Website.",
        requestId,
      });
    }

    if (!isPriority(priority)) {
      return apiError({
        status: 422,
        code: "BUG-TRACKER-PRIORITY-REQUIRED",
        error: "Select a valid bug priority.",
        details: `Received priority value: ${String(
          priority ?? "missing",
        )}`,
        hint:
          "Choose minor, normal or senior based on the impact of the problem.",
        requestId,
      });
    }

    const insertPayload = {
      reference_number: createBugReference(),
      title,
      description,
      application,
      affected_feature: cleanText(body.affected_feature, 200),
      page_url: cleanText(body.page_url, 2_000),
      priority,
      status: "reported" satisfies BugStatus,
      steps_to_reproduce: cleanText(
        body.steps_to_reproduce,
        10_000,
      ),
      expected_result: cleanText(
        body.expected_result,
        10_000,
      ),
      actual_result: cleanText(
        body.actual_result,
        10_000,
      ),
      browser_name: cleanText(body.browser_name, 200),
      device_type: cleanText(body.device_type, 200),
      operating_system: cleanText(
        body.operating_system,
        200,
      ),
      screenshot_url: cleanText(
        body.screenshot_url,
        2_000,
      ),
      attachment_urls: cleanStringArray(
        body.attachment_urls,
        5,
      ),
      reporter_admin_id: admin.id,
      reporter_name: admin.name || admin.email,
      reporter_email: admin.email,
      email_notification_sent: false,
      email_notification_error: null,
      email_notification_sent_at: null,
    };

    const { data, error } = await supabaseAdmin
      .from(BUG_REPORTS_TABLE)
      .insert(insertPayload)
      .select("*")
      .single();

    if (error || !data) {
      const databaseError = getSupabaseErrorDetails(error);

      console.error("Bug Tracker POST database failure", {
        requestId,
        databaseError,
        insertPayload: {
          ...insertPayload,
          description: "[redacted from log]",
          steps_to_reproduce: insertPayload.steps_to_reproduce
            ? "[redacted from log]"
            : null,
        },
      });

      return apiError({
        status: 500,
        code: "BUG-TRACKER-DATABASE-CREATE-FAILED",
        error: "The bug report could not be saved.",
        details: [
          databaseError.message,
          databaseError.code
            ? `Database code: ${databaseError.code}`
            : null,
          databaseError.details,
        ]
          .filter(Boolean)
          .join(" | "),
        hint:
          databaseError.hint ||
          `Check the ${BUG_REPORTS_TABLE} table columns and constraints in Supabase.`,
        requestId,
      });
    }

    const report = data as BugReportRow;

    await writeBugActivity({
      bugReportId: report.id,
      action: "bug_reported",
      description:
        `${admin.name || admin.email} reported ` +
        `${report.reference_number}.`,
      admin,
      newData: report,
    });

    let emailSent = false;
    let emailWarning: string | null = null;

    try {
      await sendBugReportEmail(report);

      emailSent = true;

      const sentAt = new Date().toISOString();

      const { error: emailUpdateError } = await supabaseAdmin
        .from(BUG_REPORTS_TABLE)
        .update({
          email_notification_sent: true,
          email_notification_error: null,
          email_notification_sent_at: sentAt,
        })
        .eq("id", report.id);

      if (emailUpdateError) {
        console.error(
          "Bug Tracker email status update failed",
          {
            requestId,
            bugReportId: report.id,
            error: emailUpdateError,
          },
        );
      }

      report.email_notification_sent = true;
      report.email_notification_error = null;
      report.email_notification_sent_at = sentAt;

      await writeBugActivity({
        bugReportId: report.id,
        action: "email_notification_sent",
        description:
          "The bug notification email was sent to Cameron Lowndes.",
        admin,
        newData: {
          recipient:
            process.env.BUG_REPORT_NOTIFICATION_EMAIL ||
            "cameronlowndes@burtonpride.co.uk",
          sent_at: sentAt,
        },
      });
    } catch (emailError) {
      emailWarning =
        emailError instanceof Error
          ? emailError.message
          : "Unknown email provider error.";

      console.error("Bug Tracker notification email failed", {
        requestId,
        bugReportId: report.id,
        error: emailError,
      });

      const { error: emailFailureUpdateError } =
        await supabaseAdmin
          .from(BUG_REPORTS_TABLE)
          .update({
            email_notification_sent: false,
            email_notification_error: emailWarning,
            email_notification_sent_at: null,
          })
          .eq("id", report.id);

      if (emailFailureUpdateError) {
        console.error(
          "Bug Tracker email failure status update failed",
          {
            requestId,
            bugReportId: report.id,
            error: emailFailureUpdateError,
          },
        );
      }

      report.email_notification_sent = false;
      report.email_notification_error = emailWarning;
      report.email_notification_sent_at = null;

      await writeBugActivity({
        bugReportId: report.id,
        action: "email_notification_failed",
        description:
          "The bug report was saved, but the notification email failed.",
        admin,
        newData: {
          error: emailWarning,
        },
      });
    }

    return json(
      {
        ok: true,
        report,
        emailSent,
        emailWarning,
        message: emailSent
          ? "Bug report submitted. Cameron has received an email notification."
          : "Bug report submitted, but the email notification could not be sent.",
        requestId,
      },
      201,
      requestId,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown authentication error.";

    console.error("Bug Tracker POST authentication failure", {
      requestId,
      error,
    });

    return apiError({
      status: 401,
      code: "BUG-TRACKER-AUTH-REQUIRED",
      error: "You must be signed in as an administrator.",
      details: message,
      hint:
        "Sign in to the Admin Portal again before submitting a bug report.",
      requestId,
    });
  }
}
