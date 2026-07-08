
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminRow = {
  id: string;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
  permissions: unknown;
};

type RiskLevel = "low" | "medium" | "high" | "critical";

type QueryResult<T> = {
  data: T[];
  count: number | null;
  table: string | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function lower(value: unknown) {
  return clean(value).toLowerCase();
}

function getIpAddress(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    null
  );
}

function parsePermissions(value: unknown): unknown {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function hasPermission(admin: AdminRow, permission: string) {
  if (admin.role === "main_admin") return true;

  const permissions = parsePermissions(admin.permissions);

  if (Array.isArray(permissions)) return permissions.includes(permission);
  if (!permissions || typeof permissions !== "object") return false;

  const record = permissions as Record<string, unknown>;
  const direct = record[permission];

  if (direct === true || direct === "true" || direct === 1) return true;

  const [area, action] = permission.split(":");
  const nested = record[area];

  if (nested && typeof nested === "object") {
    const nestedValue = (nested as Record<string, unknown>)[action];
    return nestedValue === true || nestedValue === "true" || nestedValue === 1;
  }

  return false;
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function startOfTodayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function thirtyDaysAgoIso() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString();
}

function sevenDaysFromNowIso() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString();
}

function getSupabaseDetails(error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}) {
  return {
    supabase_code: error.code || null,
    supabase_message: error.message || null,
    supabase_details: error.details || null,
    supabase_hint: error.hint || null,
  };
}

function isMissingTableError(error: { code?: string | null; message?: string | null }) {
  return error.code === "42P01" || error.code === "PGRST205" || String(error.message || "").includes("Could not find the table");
}

async function getCurrentAdmin(request: NextRequest) {
  const adminId = clean(request.cookies.get("burton_admin_id")?.value);
  const adminEmail = lower(request.cookies.get("burton_admin_email")?.value);

  if (!adminId && !adminEmail) return null;

  let query = supabaseAdmin
    .from("admin_users")
    .select("id, email, role, is_active, permissions")
    .limit(1);

  if (adminId) query = query.eq("id", adminId);
  else query = query.ilike("email", adminEmail);

  const { data, error } = await query.maybeSingle();

  if (error || !data) return null;

  const admin = data as AdminRow;
  if (admin.is_active === false) return null;

  return admin;
}

async function auditDashboardRead(request: NextRequest, admin: AdminRow, metadata: Record<string, unknown>) {
  try {
    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: admin.id,
      admin_email: admin.email,
      admin_name: admin.email,
      admin_role: admin.role,
      action: "dashboard_api_read",
      area: "dashboard",
      route: "/api/admin/dashboard",
      method: "GET",
      status: "success",
      risk_level: "low",
      target_type: "admin_dashboard",
      target_id: admin.id,
      target_label: admin.email,
      ip_address: getIpAddress(request),
      user_agent: request.headers.get("user-agent"),
      metadata,
    });
  } catch {
    // Never break dashboard load because audit insert failed.
  }
}

async function firstCount(
  tableNames: string[],
  configure?: (query: any) => any,
): Promise<QueryResult<Record<string, unknown>>> {
  for (const table of tableNames) {
    let query = supabaseAdmin.from(table).select("id", { count: "exact", head: true });
    if (configure) query = configure(query);

    const { count, error } = await query;

    if (!error) return { data: [], count: count ?? 0, table };
    if (!isMissingTableError(error)) {
      console.warn(`Dashboard count failed for ${table}:`, getSupabaseDetails(error));
      return { data: [], count: 0, table };
    }
  }

  return { data: [], count: 0, table: null };
}

async function firstRows<T extends Record<string, unknown>>(
  tableNames: string[],
  select: string,
  configure?: (query: any) => any,
  limit = 10,
): Promise<QueryResult<T>> {
  for (const table of tableNames) {
    let query = supabaseAdmin.from(table).select(select).limit(limit);
    if (configure) query = configure(query);

    const { data, count, error } = await query;

    if (!error) {
      return {
        data: Array.isArray(data) ? (data as unknown as T[]) : [],
        count: count ?? null,
        table,
      };
    }

    if (!isMissingTableError(error)) {
      console.warn(`Dashboard rows failed for ${table}:`, getSupabaseDetails(error));
      return { data: [], count: 0, table };
    }
  }

  return { data: [], count: 0, table: null };
}

function makeActionItem(input: {
  id: string;
  title: string;
  desc: string;
  href: string;
  area: string;
  priority: RiskLevel;
  count?: number;
}) {
  return input;
}

export async function GET(request: NextRequest) {
  const admin = await getCurrentAdmin(request);

  if (!admin) {
    return NextResponse.json(
      { error: "You are not logged in or your admin account is inactive." },
      { status: 401 },
    );
  }

  const canDashboard = hasPermission(admin, "admin:dashboard:view");
  if (!canDashboard) {
    return NextResponse.json(
      { error: "You do not have permission to view the dashboard." },
      { status: 403 },
    );
  }

  const canEmail = hasPermission(admin, "email:view");
  const canForms = hasPermission(admin, "contacts:view");
  const canMoney = hasPermission(admin, "money:view");
  const canDonations = hasPermission(admin, "donations:view");
  const canRaffle = hasPermission(admin, "raffle:view");
  const canPages = hasPermission(admin, "site_pages:view") || hasPermission(admin, "site_pages:manage");
  const canAudit = hasPermission(admin, "audit_logs:view");

  const nowIso = new Date().toISOString();

  const eventsCount = await firstCount(["events", "admin_events", "burton_pride_events"], (query) =>
    query.gte("start_at", nowIso),
  );

  const eventsRows = await firstRows<{
    id: string;
    title: string;
    start_at: string;
    location: string | null;
    is_published: boolean;
  }>(
    ["events", "admin_events", "burton_pride_events"],
    "id, title, start_at, location, is_published",
    (query) => query.gte("start_at", nowIso).order("start_at", { ascending: true }),
    5,
  );

  const emailsSent30d = canEmail
    ? await firstCount(["admin_email_logs", "email_logs", "sent_emails"], (query) =>
        query.gte("created_at", thirtyDaysAgoIso()),
      )
    : { count: null };

  const websiteMessages = canForms
    ? await firstCount(["contact_messages", "website_messages", "form_submissions"])
    : { count: null };

  const competitionEntries = canPages
    ? await firstCount(["competition_entries", "windows_of_hope", "window_showcase_entries"])
    : { count: null };

  const unreadEmails = canEmail
    ? await firstCount(["admin_email_messages", "gmail_messages", "email_messages"], (query) =>
        query.eq("is_read", false),
      )
    : { count: 0 };

  const unreadForms = canForms
    ? await firstCount(["contact_messages", "website_messages", "form_submissions"], (query) =>
        query.eq("is_read", false),
      )
    : { count: 0 };

  const oldForms = canForms
    ? await firstCount(["contact_messages", "website_messages", "form_submissions"], (query) =>
        query.lte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()).eq("is_read", false),
      )
    : { count: 0 };

  const upcomingEvents7d = await firstCount(["events", "admin_events", "burton_pride_events"], (query) =>
    query.gte("start_at", nowIso).lte("start_at", sevenDaysFromNowIso()),
  );

  const auditRows = canAudit
    ? await firstRows<{
        id: string;
        created_at: string;
        admin_email: string | null;
        action: string;
        area: string;
        risk_level: RiskLevel;
        status: string;
      }>(
        ["admin_audit_logs"],
        "id, created_at, admin_email, action, area, risk_level, status",
        (query) => query.gte("created_at", startOfTodayIso()).order("created_at", { ascending: false }),
        10,
      )
    : { data: [], count: 0, table: null };

  const failedLoginsToday = auditRows.data.filter((row) => String(row.action).includes("login") && row.status === "failed").length;
  const permissionDeniedToday = auditRows.data.filter((row) => String(row.action).includes("permission_denied") || row.status === "blocked").length;
  const highRiskEventsToday = auditRows.data.filter((row) => row.risk_level === "high").length;
  const criticalEventsToday = auditRows.data.filter((row) => row.risk_level === "critical").length;
  const activeAdminsToday = new Set(auditRows.data.map((row) => row.admin_email).filter(Boolean)).size;

  const moneyRows = canMoney
    ? await firstRows<Record<string, unknown>>(
        ["money_transactions"],
        "id, amount, type, direction, receipt_url, receipt_path, checked, is_checked, status, created_at",
        (query) => query.order("created_at", { ascending: false }),
        500,
      )
    : { data: [], count: 0, table: null };

  const moneyTotalIn = moneyRows.data.reduce((sum, row) => {
    const direction = lower(row.direction || row.type || row.status);
    const amount = safeNumber(row.amount);
    return direction.includes("in") || direction.includes("income") || direction.includes("donation") ? sum + amount : sum;
  }, 0);

  const moneyTotalOut = moneyRows.data.reduce((sum, row) => {
    const direction = lower(row.direction || row.type || row.status);
    const amount = safeNumber(row.amount);
    return direction.includes("out") || direction.includes("expense") || direction.includes("spending") ? sum + amount : sum;
  }, 0);

  const missingReceipts = moneyRows.data.filter((row) => {
    const hasReceipt = Boolean(row.receipt_url || row.receipt_path);
    const amount = safeNumber(row.amount);
    return amount > 0 && !hasReceipt;
  }).length;

  const uncheckedTransactions = moneyRows.data.filter((row) => row.checked === false || row.is_checked === false).length;

  const readinessRows = await firstRows<Record<string, unknown>>(
    ["admin_event_readiness_checks"],
    "id, event_name, event_date, label, area, href, complete, sort_order",
    (query) => query.order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    20,
  );

  const readinessItems = readinessRows.data.map((row) => ({
    id: clean(row.id),
    label: clean(row.label),
    complete: row.complete === true,
    href: clean(row.href) || "/Admin/Dashboard/Events",
    area: clean(row.area) || "event",
  }));

  const announcementsRows = await firstRows<Record<string, unknown>>(
    ["admin_announcements"],
    "id, title, body, priority, created_at, expires_at, is_active",
    (query) => query.eq("is_active", true).order("created_at", { ascending: false }),
    5,
  );

  const actionItems = [];

  if ((unreadForms.count || 0) > 0) {
    actionItems.push(makeActionItem({
      id: "unread-forms",
      title: "Review public messages",
      desc: `${unreadForms.count} website messages are unread.`,
      href: "/Admin/Dashboard/Forms",
      area: "forms",
      priority: (oldForms.count || 0) > 0 ? "high" : "medium",
      count: unreadForms.count || 0,
    }));
  }

  if (missingReceipts > 0) {
    actionItems.push(makeActionItem({
      id: "missing-receipts",
      title: "Attach missing receipts",
      desc: `${missingReceipts} finance records are missing receipts.`,
      href: "/Admin/MoneyManagement",
      area: "money",
      priority: "high",
      count: missingReceipts,
    }));
  }

  if (highRiskEventsToday + criticalEventsToday > 0) {
    actionItems.push(makeActionItem({
      id: "security-watch",
      title: "Review high-risk audit logs",
      desc: `${criticalEventsToday} critical and ${highRiskEventsToday} high-risk audit records today.`,
      href: "/Admin/Dashboard/Logs",
      area: "audit",
      priority: criticalEventsToday > 0 ? "critical" : "high",
      count: highRiskEventsToday + criticalEventsToday,
    }));
  }

  const response = {
    stats: {
      upcomingEvents: eventsCount.count || 0,
      emailsSent30d: canEmail ? emailsSent30d.count ?? 0 : null,
      competitionEntries: canPages ? competitionEntries.count ?? 0 : null,
      websiteMessages: canForms ? websiteMessages.count ?? 0 : null,
    },
    nextEvents: eventsRows.data.map((row) => ({
      id: clean(row.id),
      title: clean(row.title) || "Untitled event",
      start_at: clean(row.start_at),
      location: row.location ? clean(row.location) : null,
      is_published: row.is_published === true,
    })),
    commandCentre: {
      urgentMessages: unreadForms.count || 0,
      unreadEmails: unreadEmails.count || 0,
      unpaidBalances: 0,
      missingReceipts,
      highRiskAuditLogs: highRiskEventsToday + criticalEventsToday,
      upcomingEvents7d: upcomingEvents7d.count || 0,
      draftPages: 0,
      failedSyncs: 0,
    },
    actionItems,
    securityWatch: {
      failedLoginsToday,
      permissionDeniedToday,
      highRiskEventsToday,
      criticalEventsToday,
      activeAdminsToday,
      lastAdminActivityAt: auditRows.data[0]?.created_at || null,
    },
    moneyHealth: {
      totalIn: canMoney ? moneyTotalIn : null,
      totalOut: canMoney ? moneyTotalOut : null,
      balance: canMoney ? moneyTotalIn - moneyTotalOut : null,
      missingReceipts: canMoney ? missingReceipts : 0,
      uncheckedTransactions: canMoney ? uncheckedTransactions : 0,
      unpaidPersonalFunds: 0,
      pendingRefunds: 0,
    },
    eventReadiness: {
      eventName: clean(readinessRows.data[0]?.event_name) || "Burton Pride 2026",
      eventDate: clean(readinessRows.data[0]?.event_date) || "2026-06-27T12:00:00",
      completed: readinessItems.filter((item) => item.complete).length,
      total: readinessItems.length,
      items: readinessItems,
    },
    recentActivity: auditRows.data.slice(0, 8),
    announcements: announcementsRows.data.map((row) => ({
      id: clean(row.id),
      title: clean(row.title),
      body: clean(row.body),
      priority: clean(row.priority) || "normal",
      created_at: clean(row.created_at),
      expires_at: row.expires_at ? clean(row.expires_at) : null,
    })),
    emailHealth: {
      unread: unreadEmails.count || 0,
      needsReply: unreadEmails.count || 0,
      drafts: 0,
      failedSends: 0,
      lastReceivedAt: null,
    },
    formsInbox: {
      unread: unreadForms.count || 0,
      stallEnquiries: 0,
      volunteerApplications: 0,
      complaints: 0,
      sponsorEnquiries: 0,
      olderThan7Days: oldForms.count || 0,
    },
    sponsorHealth: {
      donationsThisMonth: null,
      monthlySupporters: 0,
      sponsorApplicationsPending: 0,
      sponsorPaymentsOutstanding: 0,
      thankYouEmailsPending: 0,
    },
  };

  await auditDashboardRead(request, admin, {
    returned_sections: Object.keys(response),
    permissions: {
      canEmail,
      canForms,
      canMoney,
      canDonations,
      canRaffle,
      canPages,
      canAudit,
    },
  });

  return NextResponse.json(response);
}
