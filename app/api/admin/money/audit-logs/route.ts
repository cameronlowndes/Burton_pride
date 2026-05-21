import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  // Frontend Budget Planning file may send these.
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

type ActorDetails = {
  actor_id: string | null;
  actor_name: string;
  actor_email: string | null;
};

function cleanText(value: unknown) {
  const text = String(value || "").trim();

  if (!text || text === "null" || text === "undefined") {
    return null;
  }

  return text;
}

function cleanValue(value: any) {
  if (value === undefined) return null;
  return value;
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

async function getClerkActorDetails() {
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
    cleanText(log.created_by) ||
    cleanText(metadata.created_by) ||
    cleanText(metadata.actor_name) ||
    cleanText(metadata.user_name) ||
    cleanText(metadata.name) ||
    nameFromEmail(
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
    cleanText(log.created_by_email) ||
    cleanText(metadata.created_by_email) ||
    cleanText(metadata.actor_email) ||
    cleanText(metadata.email) ||
    null
  );
}

function normaliseLogUser(log: any) {
  const metadata = log?.metadata || {};
  const fallbackName = getLogUserName(log);
  const fallbackEmail = getLogUserEmail(log);

  return {
    ...log,
    created_by: fallbackName,
    created_by_email: fallbackEmail,
    metadata: {
      ...metadata,
      actor_name: cleanText(metadata.actor_name) || fallbackName,
      actor_email: cleanText(metadata.actor_email) || fallbackEmail,
      created_by: cleanText(metadata.created_by) || fallbackName,
      created_by_email: cleanText(metadata.created_by_email) || fallbackEmail,
    },
  };
}

function shouldFallbackToMetadataOnly(error: any) {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.code === "PGRST204" &&
    (message.includes("created_by") ||
      message.includes("created_by_email") ||
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

    const transactionId = searchParams.get("transactionId");
    const action = searchParams.get("action");
    const limitRaw = Number(searchParams.get("limit") || 100);

    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 250)
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
