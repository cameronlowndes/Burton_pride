import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUDIT_LOGS = 2000;
const MAX_COMMENT_LENGTH = 2000;
const MAX_COMMENT_HISTORY_ITEMS = 50;

type AuditLogBody = {
  action?: string | null;

  transactionId?: string | null;
  transaction_id?: string | null;

  transactionTitle?: string | null;
  transaction_title?: string | null;

  beforeData?: any;
  before_data?: any;

  afterData?: any;
  after_data?: any;

  changedFields?: any;
  changed_fields?: any;

  metadata?: any;

  // Frontend Budget Planning files may send these.
  createdBy?: string | null;
  created_by?: string | null;
  createdByEmail?: string | null;
  created_by_email?: string | null;

  actorName?: string | null;
  actor_name?: string | null;
  actorEmail?: string | null;
  actor_email?: string | null;
  actorId?: string | null;
  actor_id?: string | null;
};

type AuditLogCommentBody = {
  logId?: string | null;
  log_id?: string | null;
  id?: string | null;
  comment?: string | null;
  adminComment?: string | null;
  admin_comment?: string | null;
};

type ActorDetails = {
  actor_id: string | null;
  actor_name: string;
  actor_email: string | null;
};

type MainAdminCheck = {
  allowed: boolean;
  reason: string;
};

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();

  if (!text || text === "null" || text === "undefined") {
    return null;
  }

  return text;
}

function cleanValue(value: any) {
  if (value === undefined) return null;
  return value;
}

function cleanComment(value: unknown) {
  return String(value ?? "").trim();
}

function nameFromEmail(email: string | null | undefined) {
  if (!email) return null;

  const username = email.split("@")[0] || "";

  const cleaned = username
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();

  return cleaned || null;
}

function splitEnvironmentList(value: string | undefined) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getClaimValue(claims: any, keys: string[]) {
  for (const key of keys) {
    const value = cleanText(claims?.[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function getBodyActorDetails(body: AuditLogBody | null): Partial<ActorDetails> {
  if (!body) return {};

  const metadata = body.metadata || {};

  const actorEmail =
    cleanText(body.createdByEmail) ||
    cleanText(body.created_by_email) ||
    cleanText(body.actorEmail) ||
    cleanText(body.actor_email) ||
    cleanText(metadata.created_by_email) ||
    cleanText(metadata.actor_email) ||
    null;

  const actorName =
    cleanText(body.createdBy) ||
    cleanText(body.created_by) ||
    cleanText(body.actorName) ||
    cleanText(body.actor_name) ||
    cleanText(metadata.created_by) ||
    cleanText(metadata.actor_name) ||
    nameFromEmail(actorEmail) ||
    null;

  const actorId =
    cleanText(body.actorId) ||
    cleanText(body.actor_id) ||
    cleanText(metadata.actor_id) ||
    null;

  return {
    actor_id: actorId,
    actor_name: actorName || undefined,
    actor_email: actorEmail,
  };
}

async function getClerkActorDetails(): Promise<ActorDetails> {
  const authData = await auth();
  const user = await currentUser();

  const claims: any = authData.sessionClaims || {};

  const clerkEmail =
    user?.emailAddresses?.[0]?.emailAddress ||
    getClaimValue(claims, ["email", "email_address"]) ||
    null;

  const firstName =
    cleanText(user?.firstName) ||
    getClaimValue(claims, ["first_name", "given_name"]) ||
    "";

  const lastName =
    cleanText(user?.lastName) ||
    getClaimValue(claims, ["last_name", "family_name"]) ||
    "";

  const fullName = `${firstName || ""} ${lastName || ""}`
    .replace(/\s+/g, " ")
    .trim();

  const claimName =
    getClaimValue(claims, ["name", "full_name", "username"]) || null;

  const actorName =
    cleanText(fullName) ||
    claimName ||
    nameFromEmail(clerkEmail) ||
    authData.userId ||
    "Unknown user";

  return {
    actor_id: authData.userId || user?.id || null,
    actor_name: actorName,
    actor_email: clerkEmail,
  };
}

async function getActorDetails(body: AuditLogBody | null): Promise<ActorDetails> {
  const authData = await auth();

  const bodyActor = getBodyActorDetails(body);
  const clerkActor = await getClerkActorDetails();

  const actorEmail =
    cleanText(bodyActor.actor_email) || cleanText(clerkActor.actor_email);

  const actorName =
    cleanText(bodyActor.actor_name) ||
    cleanText(clerkActor.actor_name) ||
    nameFromEmail(actorEmail) ||
    authData.userId ||
    "Unknown user";

  const actorId =
    cleanText(bodyActor.actor_id) ||
    cleanText(clerkActor.actor_id) ||
    authData.userId ||
    null;

  return {
    actor_id: actorId,
    actor_name: actorName,
    actor_email: actorEmail,
  };
}

function getRoleCandidates(user: any, claims: any) {
  const values = [
    user?.publicMetadata?.role,
    user?.privateMetadata?.role,
    user?.unsafeMetadata?.role,
    user?.publicMetadata?.roles,
    user?.privateMetadata?.roles,
    user?.unsafeMetadata?.roles,
    claims?.role,
    claims?.roles,
    claims?.metadata?.role,
    claims?.metadata?.roles,
    claims?.public_metadata?.role,
    claims?.public_metadata?.roles,
  ];

  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
}

function hasMainAdminFlag(user: any, claims: any) {
  const values = [
    user?.publicMetadata?.is_main_admin,
    user?.publicMetadata?.main_admin,
    user?.privateMetadata?.is_main_admin,
    user?.privateMetadata?.main_admin,
    user?.unsafeMetadata?.is_main_admin,
    user?.unsafeMetadata?.main_admin,
    claims?.is_main_admin,
    claims?.main_admin,
    claims?.metadata?.is_main_admin,
    claims?.metadata?.main_admin,
    claims?.public_metadata?.is_main_admin,
    claims?.public_metadata?.main_admin,
  ];

  return values.some(
    (value) =>
      value === true ||
      String(value || "").trim().toLowerCase() === "true" ||
      String(value || "").trim() === "1",
  );
}

function checkMainAdminAccess(authData: any, user: any): MainAdminCheck {
  const userId = cleanText(authData?.userId || user?.id);
  const email = cleanText(user?.emailAddresses?.[0]?.emailAddress)?.toLowerCase();
  const claims: any = authData?.sessionClaims || {};

  const allowedIds = splitEnvironmentList(
    process.env.MAIN_ADMIN_USER_IDS || process.env.NEXT_PUBLIC_MAIN_ADMIN_USER_IDS,
  );

  const allowedEmails = splitEnvironmentList(
    process.env.MAIN_ADMIN_EMAILS || process.env.NEXT_PUBLIC_MAIN_ADMIN_EMAILS,
  );

  if (userId && allowedIds.includes(userId.toLowerCase())) {
    return {
      allowed: true,
      reason: "Matched MAIN_ADMIN_USER_IDS",
    };
  }

  if (email && allowedEmails.includes(email)) {
    return {
      allowed: true,
      reason: "Matched MAIN_ADMIN_EMAILS",
    };
  }

  if (hasMainAdminFlag(user, claims)) {
    return {
      allowed: true,
      reason: "Matched Clerk main-admin metadata flag",
    };
  }

  const roles = getRoleCandidates(user, claims);

  if (
    roles.some((role) =>
      ["main_admin", "main-admin", "mainadmin", "super_admin", "super-admin"].includes(
        role,
      ),
    )
  ) {
    return {
      allowed: true,
      reason: "Matched Clerk main-admin role",
    };
  }

  return {
    allowed: false,
    reason:
      "Only the main admin can add or remove audit-log comments. Add the user to MAIN_ADMIN_EMAILS / MAIN_ADMIN_USER_IDS or set Clerk metadata role to main_admin.",
  };
}

function getChangedFields(body: AuditLogBody) {
  return cleanValue(body.changedFields ?? body.changed_fields ?? null);
}

function getBeforeData(body: AuditLogBody) {
  return cleanValue(body.beforeData ?? body.before_data ?? null);
}

function getAfterData(body: AuditLogBody) {
  return cleanValue(body.afterData ?? body.after_data ?? null);
}

function getTransactionId(body: AuditLogBody) {
  return cleanValue(body.transactionId ?? body.transaction_id ?? null);
}

function getTransactionTitle(body: AuditLogBody) {
  return cleanValue(
    body.transactionTitle ??
      body.transaction_title ??
      body.metadata?.transaction_title ??
      body.metadata?.title ??
      null,
  );
}

function getLogUserName(log: any) {
  const metadata = log?.metadata || {};

  return (
    cleanText(log.actor_name) ||
    cleanText(log.created_by) ||
    cleanText(metadata.created_by) ||
    cleanText(metadata.actor_name) ||
    cleanText(metadata.user_name) ||
    cleanText(metadata.name) ||
    nameFromEmail(
      cleanText(log.actor_email) ||
        cleanText(log.created_by_email) ||
        cleanText(metadata.created_by_email) ||
        cleanText(metadata.actor_email),
    ) ||
    "Unknown user"
  );
}

function getLogUserEmail(log: any) {
  const metadata = log?.metadata || {};

  return (
    cleanText(log.actor_email) ||
    cleanText(log.created_by_email) ||
    cleanText(metadata.created_by_email) ||
    cleanText(metadata.actor_email) ||
    cleanText(metadata.email) ||
    null
  );
}

function getLogUserId(log: any) {
  const metadata = log?.metadata || {};

  return (
    cleanText(log.actor_user_id) ||
    cleanText(log.created_by_user_id) ||
    cleanText(metadata.actor_id) ||
    cleanText(metadata.created_by_user_id) ||
    cleanText(metadata.user_id) ||
    null
  );
}

function normaliseLogUser(log: any) {
  const metadata = log?.metadata || {};
  const fallbackName = getLogUserName(log);
  const fallbackEmail = getLogUserEmail(log);
  const fallbackUserId = getLogUserId(log);

  const adminComment =
    cleanText(log.admin_comment) || cleanText(metadata.admin_comment) || null;

  const adminCommentUpdatedAt =
    cleanText(log.admin_comment_updated_at) ||
    cleanText(metadata.admin_comment_updated_at) ||
    null;

  const adminCommentUpdatedBy =
    cleanText(log.admin_comment_updated_by) ||
    cleanText(metadata.admin_comment_updated_by) ||
    null;

  const adminCommentUpdatedByEmail =
    cleanText(log.admin_comment_updated_by_email) ||
    cleanText(metadata.admin_comment_updated_by_email) ||
    null;

  return {
    ...log,
    actor_user_id: cleanText(log.actor_user_id) || fallbackUserId,
    actor_name: cleanText(log.actor_name) || fallbackName,
    actor_email: cleanText(log.actor_email) || fallbackEmail,
    created_by: fallbackName,
    created_by_email: fallbackEmail,
    admin_comment: adminComment,
    admin_comment_updated_at: adminCommentUpdatedAt,
    admin_comment_updated_by: adminCommentUpdatedBy,
    admin_comment_updated_by_email: adminCommentUpdatedByEmail,
    metadata: {
      ...metadata,
      actor_id: cleanText(metadata.actor_id) || fallbackUserId,
      actor_name: cleanText(metadata.actor_name) || fallbackName,
      actor_email: cleanText(metadata.actor_email) || fallbackEmail,
      created_by: cleanText(metadata.created_by) || fallbackName,
      created_by_email: cleanText(metadata.created_by_email) || fallbackEmail,
      admin_comment: adminComment,
      admin_comment_updated_at: adminCommentUpdatedAt,
      admin_comment_updated_by: adminCommentUpdatedBy,
      admin_comment_updated_by_email: adminCommentUpdatedByEmail,
    },
  };
}

function shouldFallbackToMetadataOnly(error: any) {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.code === "PGRST204" &&
    (message.includes("created_by") ||
      message.includes("created_by_email") ||
      message.includes("admin_comment") ||
      message.includes("schema cache"))
  );
}

async function insertAuditLog(insertRow: any) {
  const firstInsert = await supabaseAdmin
    .from("admin_money_audit_logs")
    .insert(insertRow)
    .select("*")
    .single();

  if (!firstInsert.error || !shouldFallbackToMetadataOnly(firstInsert.error)) {
    return firstInsert;
  }

  const fallbackRow = { ...insertRow };
  delete fallbackRow.created_by;
  delete fallbackRow.created_by_email;

  return supabaseAdmin
    .from("admin_money_audit_logs")
    .insert(fallbackRow)
    .select("*")
    .single();
}

async function updateAuditLogComment(logId: string, updateRow: any) {
  const firstUpdate = await supabaseAdmin
    .from("admin_money_audit_logs")
    .update(updateRow)
    .eq("id", logId)
    .select("*")
    .single();

  if (!firstUpdate.error || !shouldFallbackToMetadataOnly(firstUpdate.error)) {
    return firstUpdate;
  }

  const fallbackRow = { ...updateRow };
  delete fallbackRow.admin_comment;
  delete fallbackRow.admin_comment_updated_at;
  delete fallbackRow.admin_comment_updated_by;
  delete fallbackRow.admin_comment_updated_by_email;

  return supabaseAdmin
    .from("admin_money_audit_logs")
    .update(fallbackRow)
    .eq("id", logId)
    .select("*")
    .single();
}

export async function GET(req: Request) {
  try {
    const authData = await auth();

    if (!authData.userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Not authenticated",
        },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);

    const transactionId =
      searchParams.get("transactionId") || searchParams.get("transaction_id");

    const action = searchParams.get("action");
    const year = searchParams.get("year");
    const limitRaw = Number(searchParams.get("limit") || 100);

    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), MAX_AUDIT_LOGS)
      : 100;

    let query = supabaseAdmin
      .from("admin_money_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (transactionId) {
      query = query.eq("transaction_id", transactionId);
    }

    if (action && action !== "all") {
      query = query.eq("action", action);
    }

    if (year && year !== "all" && /^\d{4}$/.test(year)) {
      query = query
        .gte("created_at", `${year}-01-01T00:00:00.000Z`)
        .lt("created_at", `${Number(year) + 1}-01-01T00:00:00.000Z`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      logs: (data || []).map(normaliseLogUser),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load money audit logs",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const authData = await auth();

    if (!authData.userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Not authenticated",
        },
        { status: 401 },
      );
    }

    const body = (await req.json().catch(() => null)) as AuditLogBody | null;

    if (!body) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing audit log body",
        },
        { status: 400 },
      );
    }

    const action = String(body.action || "").trim();

    if (!action) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing audit log action",
        },
        { status: 400 },
      );
    }

    const actor = await getActorDetails(body);

    const transactionId = getTransactionId(body);
    const transactionTitle = getTransactionTitle(body);
    const beforeData = getBeforeData(body);
    const afterData = getAfterData(body);
    const changedFields = getChangedFields(body);

    const metadata = {
      ...(body.metadata || {}),
      actor_id: actor.actor_id,
      actor_name: actor.actor_name,
      actor_email: actor.actor_email,
      created_by: actor.actor_name,
      created_by_email: actor.actor_email,
      source: body.metadata?.source || "money_admin",
      created_from: "app/api/admin/money/audit-logs",
    };

    const insertRow = {
      action,
      transaction_id: transactionId,
      transaction_title: transactionTitle,
      before_data: beforeData,
      after_data: afterData,
      changed_fields: changedFields,
      metadata,
      created_by: actor.actor_name,
      created_by_email: actor.actor_email,
    };

    const { data, error } = await insertAuditLog(insertRow);

    if (error) {
      console.error("Create money audit log error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        insertRow,
      });

      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to create money audit log",
          details: error.details || null,
          hint: error.hint || null,
          code: error.code || null,
          insertRow,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      log: normaliseLogUser(data),
    });
  } catch (error: any) {
    console.error("POST /api/admin/money/audit-logs error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to create money audit log",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const authData = await auth();

    if (!authData.userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Not authenticated",
        },
        { status: 401 },
      );
    }

    const user = await currentUser();
    const access = checkMainAdminAccess(authData, user);

    if (!access.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: access.reason,
        },
        { status: 403 },
      );
    }

    const body = (await req.json().catch(() => null)) as
      | AuditLogCommentBody
      | null;

    if (!body) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing comment update body",
        },
        { status: 400 },
      );
    }

    const logId = cleanText(body.logId || body.log_id || body.id);
    const comment = cleanComment(
      body.comment ?? body.adminComment ?? body.admin_comment ?? "",
    );

    if (!logId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing audit log ID",
        },
        { status: 400 },
      );
    }

    if (comment.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json(
        {
          ok: false,
          error: `Audit-log comments must be ${MAX_COMMENT_LENGTH} characters or fewer.`,
        },
        { status: 400 },
      );
    }

    const { data: existingLog, error: existingLogError } = await supabaseAdmin
      .from("admin_money_audit_logs")
      .select("*")
      .eq("id", logId)
      .single();

    if (existingLogError || !existingLog) {
      return NextResponse.json(
        {
          ok: false,
          error: existingLogError?.message || "Audit log entry not found",
          details: existingLogError || null,
        },
        { status: existingLogError?.code === "PGRST116" ? 404 : 500 },
      );
    }

    const actor = await getClerkActorDetails();
    const updatedAt = new Date().toISOString();
    const previousMetadata = existingLog.metadata || {};

    const oldHistory = Array.isArray(previousMetadata.admin_comment_history)
      ? previousMetadata.admin_comment_history
      : [];

    const newHistoryItem = {
      action: comment ? "comment_saved" : "comment_cleared",
      comment: comment || null,
      updated_at: updatedAt,
      updated_by: actor.actor_name,
      updated_by_email: actor.actor_email,
      updated_by_user_id: actor.actor_id,
    };

    const metadata = {
      ...previousMetadata,
      admin_comment: comment || null,
      admin_comment_updated_at: updatedAt,
      admin_comment_updated_by: actor.actor_name,
      admin_comment_updated_by_email: actor.actor_email,
      admin_comment_updated_by_user_id: actor.actor_id,
      admin_comment_history: [...oldHistory, newHistoryItem].slice(
        -MAX_COMMENT_HISTORY_ITEMS,
      ),
    };

    const updateRow = {
      admin_comment: comment || null,
      admin_comment_updated_at: updatedAt,
      admin_comment_updated_by: actor.actor_name,
      admin_comment_updated_by_email: actor.actor_email,
      metadata,
    };

    const { data, error } = await updateAuditLogComment(logId, updateRow);

    if (error) {
      console.error("Update money audit-log comment error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        logId,
        updateRow,
      });

      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to update audit-log comment",
          details: error.details || null,
          hint: error.hint || null,
          code: error.code || null,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: comment
        ? "Audit-log comment saved."
        : "Audit-log comment removed.",
      log: normaliseLogUser(data),
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/money/audit-logs error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update audit-log comment",
      },
      { status: 500 },
    );
  }
}
