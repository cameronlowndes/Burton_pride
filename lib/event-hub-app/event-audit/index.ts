import "server-only";

import { createHash } from "crypto";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { getCurrentEventAuditActor } from "./auth";
import { actionLabel, defaultRisk } from "./catalogue";
import {
  calculateChangedFields,
  redactAuditObject,
  redactAuditValue,
} from "./redaction";
import {
  hashSessionReference,
  makeRequestId,
  parseUserAgent,
  requestIp,
  requestRoute,
} from "./request";
import type {
  CreateEventAuditLogInput,
  EventAuditActor,
  EventAuditRiskLevel,
} from "./types";

function safeString(value: unknown) {
  return String(value ?? "").trim() || null;
}

function escalateRisk(input: CreateEventAuditLogInput): EventAuditRiskLevel {
  let risk = input.riskLevel || defaultRisk(input.action);

  if (input.isConfidential && ["document.viewed", "document.downloaded"].includes(input.action)) {
    risk = "high";
  }

  if (input.status === "failed" && risk === "low") risk = "medium";
  if (input.status === "blocked" && risk === "low") risk = "medium";
  if (input.requiresReview && risk === "low") risk = "medium";
  if (input.action.includes("permanently_deleted")) risk = "critical";

  return risk;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
    )
    .join(",")}}`;
}

function makeEntryHash(payload: Record<string, unknown>, previousEntryHash: string | null) {
  return createHash("sha256")
    .update(`${previousEntryHash || "GENESIS"}|${canonicalJson(payload)}`)
    .digest("hex");
}

async function resolveActor(input: CreateEventAuditLogInput): Promise<EventAuditActor> {
  if (input.actor) return input.actor;

  try {
    return await getCurrentEventAuditActor();
  } catch (error) {
    if (input.area === "authentication" || input.area === "security" || input.area === "system") {
      return {
        id: null,
        email: null,
        name: "Unknown / unauthenticated",
        role: null,
        permissionKeys: [],
        permissionsSnapshot: [],
      };
    }
    throw error;
  }
}

async function createAlert(input: {
  auditLogId: string;
  eventId: string | null;
  action: string;
  actionLabel: string;
  summary: string | null;
  riskLevel: EventAuditRiskLevel;
}) {
  if (!(["high", "critical"].includes(input.riskLevel))) return;

  const { error } = await supabaseAdmin.from("event_audit_alerts").insert({
    audit_log_id: input.auditLogId,
    event_id: input.eventId,
    alert_type: input.action,
    title: `${input.riskLevel === "critical" ? "Critical" : "High-risk"}: ${input.actionLabel}`,
    description: input.summary,
    severity: input.riskLevel,
    status: "new",
  });

  if (error) {
    console.error("Event audit alert creation failed:", {
      message: error.message,
      code: error.code,
      auditLogId: input.auditLogId,
    });
  }
}

export async function createEventAuditLog(input: CreateEventAuditLogInput) {
  try {
    const actor = await resolveActor(input);
    const userAgent = input.request?.headers.get("user-agent") || null;
    const source = parseUserAgent(userAgent);
    const requestId = makeRequestId(input.request, input.requestId);
    const beforeData = redactAuditObject(input.before);
    const afterData = redactAuditObject(input.after);
    const changedFields = input.changedFields
      ? (redactAuditValue(input.changedFields) as Record<string, unknown>)
      : calculateChangedFields(beforeData, afterData);
    const riskLevel = escalateRisk(input);
    const label = input.actionLabel || actionLabel(input.action);
    const createdAt = new Date().toISOString();

    const { data: previous } = await supabaseAdmin
      .from("event_audit_logs")
      .select("entry_hash")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const hashPayload = {
      event_id: input.eventId || null,
      admin_id: actor.id,
      action: input.action,
      area: input.area,
      status: input.status || "success",
      risk_level: riskLevel,
      record_type: input.record?.type || null,
      record_id: input.record?.id || null,
      changed_fields: changedFields,
      request_id: requestId,
      created_at: createdAt,
    };
    const previousEntryHash = safeString(previous?.entry_hash);
    const entryHash = makeEntryHash(hashPayload, previousEntryHash);

    const row = {
      event_id: input.eventId || null,
      admin_id: actor.id,
      admin_email: actor.email,
      admin_name: actor.name,
      admin_role: actor.role,
      admin_permissions_snapshot: redactAuditValue(actor.permissionsSnapshot) || [],
      action: input.action,
      action_label: label,
      area: input.area,
      category: input.category || null,
      status: input.status || "success",
      risk_level: riskLevel,
      record_type: input.record?.type || null,
      record_id: input.record?.id || null,
      record_title: input.record?.title || null,
      organisation_id: input.record?.organisationId || null,
      contact_id: input.record?.contactId || null,
      application_id: input.record?.applicationId || null,
      document_id: input.record?.documentId || null,
      transaction_id: input.record?.transactionId || null,
      route: requestRoute(input.request),
      api_route: requestRoute(input.request),
      http_method: input.request?.method || null,
      response_status: input.responseStatus || null,
      request_id: requestId,
      ip_address: requestIp(input.request),
      user_agent: userAgent,
      browser: source.browser,
      operating_system: source.operatingSystem,
      device_type: source.deviceType,
      session_reference: hashSessionReference(actor.sessionReference),
      reason: safeString(input.reason),
      summary: safeString(input.summary),
      error_code: safeString(input.errorCode),
      error_message: safeString(input.errorMessage),
      before_data: beforeData,
      after_data: afterData,
      changed_fields: changedFields,
      metadata: redactAuditObject(input.metadata) || {},
      is_confidential: Boolean(input.isConfidential),
      is_security_event: Boolean(input.isSecurityEvent),
      requires_review: Boolean(input.requiresReview),
      parent_audit_log_id: input.parentAuditLogId || null,
      created_at: createdAt,
      previous_entry_hash: previousEntryHash,
      entry_hash: entryHash,
    };

    // The RPC obtains a PostgreSQL advisory lock and creates a single,
    // non-forking integrity chain even when actions finish concurrently.
    const rpcResult = await supabaseAdmin.rpc("insert_event_audit_log", {
      p_payload: row,
    });

    let data: any = rpcResult.data;
    let error: any = rpcResult.error;

    // Backwards-compatible fallback while the migration is being deployed.
    // Once the migration is live, the RPC path is always used.
    if (error && ["42883", "PGRST202"].includes(String(error.code || ""))) {
      const fallback = await supabaseAdmin
        .from("event_audit_logs")
        .insert(row)
        .select("*")
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    if (Array.isArray(data)) data = data[0];
    if (!data?.id) throw new Error("The audit insert did not return an audit event ID.");

    if (
      input.isSecurityEvent ||
      input.requiresReview ||
      ["high", "critical"].includes(riskLevel)
    ) {
      await createAlert({
        auditLogId: data.id,
        eventId: input.eventId || null,
        action: input.action,
        actionLabel: label,
        summary: safeString(input.summary),
        riskLevel,
      });
    }

    return data;
  } catch (error) {
    console.error("createEventAuditLog failed:", {
      action: input.action,
      area: input.area,
      message: error instanceof Error ? error.message : String(error),
    });

    if (input.strict) throw error;
    return null;
  }
}

export * from "./auth";
export * from "./catalogue";
export * from "./redaction";
export * from "./types";
export * from "./http";
export * from "./query";
export * from "./request";
