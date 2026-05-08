import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type MoneyAuditAction =
  | "create"
  | "edit"
  | "delete"
  | "delete_year"
  | "delete_all"
  | "restore"
  | "mark_paid_back"
  | "mark_not_paid_back";

type AuditPayload = {
  action: MoneyAuditAction;
  transactionId?: string | null;
  transactionTitle?: string | null;
  beforeData?: any;
  afterData?: any;
  changedFields?: any;
  metadata?: any;
};

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

async function getAuditActor() {
  const authData = await auth();
  const user = await currentUser().catch(() => null);

  const actorEmail =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    null;

  const actorName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    nameFromEmail(actorEmail) ||
    null;

  return {
    actorUserId: authData.userId || user?.id || null,
    actorName,
    actorEmail,
  };
}

export function getChangedFields(beforeData: any, afterData: any) {
  const beforeObj = beforeData || {};
  const afterObj = afterData || {};

  const keys = Array.from(
    new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])
  );

  const changed: Record<string, { before: any; after: any }> = {};

  keys.forEach((key) => {
    const beforeValue = cleanValue(beforeObj[key]);
    const afterValue = cleanValue(afterObj[key]);

    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changed[key] = {
        before: beforeValue,
        after: afterValue,
      };
    }
  });

  return changed;
}

export async function createMoneyAuditLog(payload: AuditPayload) {
  try {
    const actor = await getAuditActor();

    const changedFields =
      payload.changedFields ||
      (payload.beforeData || payload.afterData
        ? getChangedFields(payload.beforeData, payload.afterData)
        : null);

    const { error } = await supabaseAdmin
      .from("admin_money_audit_logs")
      .insert({
        action: payload.action,
        transaction_id: payload.transactionId || null,
        transaction_title: payload.transactionTitle || null,
        actor_user_id: actor.actorUserId,
        actor_name: actor.actorName,
        actor_email: actor.actorEmail,
        before_data: payload.beforeData || null,
        after_data: payload.afterData || null,
        changed_fields: changedFields || null,
        metadata: payload.metadata || null,
      });

    if (error) {
      console.error("Money audit log failed:", error);
    }
  } catch (error) {
    console.error("Money audit log crashed:", error);
  }
}

export async function createBulkMoneyAuditLogs(payloads: AuditPayload[]) {
  try {
    if (!payloads.length) return;

    const actor = await getAuditActor();

    const rows = payloads.map((payload) => {
      const changedFields =
        payload.changedFields ||
        (payload.beforeData || payload.afterData
          ? getChangedFields(payload.beforeData, payload.afterData)
          : null);

      return {
        action: payload.action,
        transaction_id: payload.transactionId || null,
        transaction_title: payload.transactionTitle || null,
        actor_user_id: actor.actorUserId,
        actor_name: actor.actorName,
        actor_email: actor.actorEmail,
        before_data: payload.beforeData || null,
        after_data: payload.afterData || null,
        changed_fields: changedFields || null,
        metadata: payload.metadata || null,
      };
    });

    const { error } = await supabaseAdmin
      .from("admin_money_audit_logs")
      .insert(rows);

    if (error) {
      console.error("Bulk money audit log failed:", error);
    }
  } catch (error) {
    console.error("Bulk money audit log crashed:", error);
  }
}