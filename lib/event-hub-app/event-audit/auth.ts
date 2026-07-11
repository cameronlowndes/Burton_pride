import "server-only";

import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import type { EventAuditActor, EventAuditPermission } from "./types";

const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";
const SESSION_COOKIE = "burton_admin_session";

const LEGACY_PERMISSION_ALIASES: Partial<Record<EventAuditPermission, string[]>> = {
  "event_audit:view": ["audit_logs:view"],
  "event_audit:export": ["audit_logs:export", "money:export_reports"],
};

export class EventAuditAuthError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "EventAuditAuthError";
    this.status = status;
    this.code = code;
  }
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function nameFromEmail(email: string | null) {
  if (!email || !email.includes("@")) return "Admin";

  return email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function collectPermissionKeys(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        const key = clean(row.permission_key || row.key || row.permission);
        const allowed = row.is_allowed ?? row.allowed ?? row.enabled ?? true;
        return key && allowed !== false ? [key] : [];
      }
      return [];
    });
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, allowed]) => allowed === true)
      .map(([key]) => key);
  }

  return [];
}

async function loadRelatedPermissionKeys(adminId: string) {
  const { data, error } = await supabaseAdmin
    .from("admin_user_permissions")
    .select(
      `
        is_allowed,
        admin_permissions:admin_permission_id(permission_key)
      `,
    )
    .eq("admin_user_id", adminId)
    .eq("is_allowed", true);

  if (error) {
    // Some older installations use permission_id rather than admin_permission_id.
    const fallback = await supabaseAdmin
      .from("admin_user_permissions")
      .select(
        `
          is_allowed,
          admin_permissions:permission_id(permission_key)
        `,
      )
      .eq("admin_user_id", adminId)
      .eq("is_allowed", true);

    if (fallback.error) return [];
    return collectPermissionKeys(
      (fallback.data || []).map((row: any) => ({
        permission_key: row.admin_permissions?.permission_key,
        is_allowed: row.is_allowed,
      })),
    );
  }

  return collectPermissionKeys(
    (data || []).map((row: any) => ({
      permission_key: row.admin_permissions?.permission_key,
      is_allowed: row.is_allowed,
    })),
  );
}

export async function getCurrentEventAuditActor(): Promise<EventAuditActor> {
  const cookieStore = await cookies();
  const adminId = clean(cookieStore.get(ADMIN_ID_COOKIE)?.value);
  const adminEmail = clean(cookieStore.get(ADMIN_EMAIL_COOKIE)?.value).toLowerCase();
  const sessionReference = clean(cookieStore.get(SESSION_COOKIE)?.value);

  if (!adminId || !adminEmail || !sessionReference) {
    throw new EventAuditAuthError(
      "You must be signed in to use the Event Hub Audit Log.",
      401,
      "not_authenticated",
    );
  }

  const { data: admin, error } = await supabaseAdmin
    .from("admin_users")
    .select("*")
    .eq("id", adminId)
    .eq("email", adminEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new EventAuditAuthError(
      error.message || "The admin account could not be loaded.",
      500,
      "admin_lookup_failed",
    );
  }

  if (!admin) {
    throw new EventAuditAuthError(
      "No active admin account is linked to this session.",
      401,
      "admin_not_found",
    );
  }

  const inlineKeys = collectPermissionKeys(admin.permissions);
  const relatedKeys = await loadRelatedPermissionKeys(String(admin.id));
  const permissionKeys = Array.from(new Set([...inlineKeys, ...relatedKeys]));
  const email = clean(admin.email || adminEmail).toLowerCase() || null;
  const name =
    clean(admin.name) || clean(admin.full_name) || nameFromEmail(email);

  return {
    id: String(admin.id),
    email,
    name,
    role: clean(admin.role) || null,
    permissionKeys,
    permissionsSnapshot: permissionKeys,
    // Do not store the raw session token. A short one-way reference is added by the logger.
    sessionReference,
  };
}

export function actorHasPermission(
  actor: EventAuditActor,
  permission: EventAuditPermission,
) {
  if (actor.role === "main_admin") return true;
  if (actor.permissionKeys.includes(permission)) return true;

  return (LEGACY_PERMISSION_ALIASES[permission] || []).some((key) =>
    actor.permissionKeys.includes(key),
  );
}

export async function requireEventAuditPermission(
  permission: EventAuditPermission,
) {
  const actor = await getCurrentEventAuditActor();

  if (!actorHasPermission(actor, permission)) {
    throw new EventAuditAuthError(
      `You do not have the required permission: ${permission}.`,
      403,
      "permission_denied",
    );
  }

  return actor;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof EventAuditAuthError) {
    return {
      status: error.status,
      body: { ok: false, error: error.message, code: error.code },
    };
  }

  return {
    status: 500,
    body: {
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected server error.",
      code: "server_error",
    },
  };
}
