import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentAdminLookup } from "@/lib/adminPermissions";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { adminDisplayName, permissionKeys } from "./navigation";

import { MODERATION_PERMISSION_KEYS, MODERATION_OPERATIONS, canModerationPermission, canModerationOperation, type ModerationPermission, type ModerationOperation } from "./permissions";
export const MODERATION_PERMISSIONS = MODERATION_PERMISSION_KEYS;
export type { ModerationPermission, ModerationOperation } from "./permissions";
export type ModerationActor = {
  id: string;
  supabase_user_id: string;
  security_session_id: string;
  trusted_device_id: string;
  mfa_assurance: "aal2";
  role: "main_admin" | "admin" | "editor";
  is_active: true;
  displayName: string;
  permissionKeys: string[];
};
export class ModerationAccessError extends Error {
  constructor(public status: 401 | 403 | 503, public reason: string) {
    super(status === 401 ? "Your secure admin session expired. Sign in again."
      : status === 403 ? "Your account, device or session does not have access to this moderation operation."
      : "Moderation access checks are unavailable. Refresh and try again.");
  }
}
async function denied(status: 401 | 403 | 503, reason: string, actor?: { id: string; security_session_id?: string | null }): Promise<never> {
  // No tokens, passwords, email addresses or comment text are logged.
  try {
    await supabaseAdmin.from("moderation_security_events").insert({
      admin_id: actor?.id ?? null, session_id: actor?.security_session_id ?? null,
      action: "moderation_access", outcome: "denied:" + reason,
    });
  } catch { /* A failed audit write never permits the denied operation. */ }
  throw new ModerationAccessError(status, reason);
}

/** Uncached: every read/action must recheck current identity and security state. */
export async function requireSecureAdmin(): Promise<ModerationActor> {
  const lookup = await getCurrentAdminLookup();
  if (!lookup.ok) {
    if (["admin_users_query_failed", "security_session_query_failed"].includes(lookup.reason)) return denied(503, "security_store_unavailable");
    return denied(401, "session_required");
  }
  const admin = lookup.admin;
  if (!admin.security_session_id) return denied(401, "session_required");
  const client = await createClient();
  let identity;
  try { identity = await client.auth.getUser(); }
  catch { return denied(503, "identity_unavailable", admin); }
  if (identity.error || !identity.data.user) return denied(401, "identity_required", admin);
  let assurance;
  try { assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel(); }
  catch { return denied(503, "mfa_unavailable", admin); }
  if (assurance.error) return denied(503, "mfa_unavailable", admin);
  if (assurance.data?.currentLevel !== "aal2") return denied(403, "aal2_required", admin);
  const pepper = process.env.ADMIN_2FA_PEPPER;
  if (!pepper || pepper.length < 32) return denied(503, "security_configuration", admin);
  const cookieStore = await cookies();
  const token = cookieStore.get("burton_admin_trusted_device")?.value;
  if (!token || token.length > 4096) return denied(403, "trusted_device_required", admin);
  const deviceHash = createHash("sha256").update(`${pepper}:${token}`).digest("hex");
  const result = await supabaseAdmin.rpc("moderation_access_context", {
    p_admin: admin.id, p_session: admin.security_session_id,
    p_auth_user: identity.data.user.id, p_device_hash: deviceHash,
  });
  if (result.error || !result.data) return denied(503, "security_store_unavailable", admin);
  const context = result.data as Record<string, unknown>;
  if (context.result !== "ok") return denied(403, "security_binding_denied", admin);
  if (context.admin_id !== admin.id || context.session_id !== admin.security_session_id ||
    context.auth_user_id !== identity.data.user.id || typeof context.device_id !== "string" ||
    !["main_admin", "admin", "editor"].includes(String(context.role))) return denied(503, "invalid_security_context", admin);
  return {
    id: admin.id, supabase_user_id: identity.data.user.id, security_session_id: admin.security_session_id,
    trusted_device_id: context.device_id, mfa_assurance: "aal2", role: context.role as ModerationActor["role"],
    is_active: true, displayName: adminDisplayName(context), permissionKeys: permissionKeys(context.permissions),
  };
}
export function moderationCan(actor: ModerationActor, permission: ModerationPermission): boolean {
  return canModerationPermission(actor, permission);
}
export { canModerationOperation } from "./permissions";
export async function requireModerationOperation(operation: ModerationOperation): Promise<ModerationActor> {
  if (!Object.prototype.hasOwnProperty.call(MODERATION_OPERATIONS, operation)) throw new ModerationAccessError(403, "unknown_operation");
  const rule = MODERATION_OPERATIONS[operation];
  const actor = await requireModeration(rule.permission, rule.mainOnly);
  if (!canModerationOperation(actor, operation)) return denied(403, "operation_permission_required", actor);
  return actor;
}
export async function optionalModerationOperation(operation: ModerationOperation): Promise<ModerationActor | null> {
  try { return await requireModerationOperation(operation); }
  catch (error) { if (error instanceof ModerationAccessError && error.status !== 503) return null; throw error; }
}
export async function requireModerationOperationScreen(operation: ModerationOperation) {
  try { return await requireModerationOperation(operation); }
  catch (error) {
    if (error instanceof ModerationAccessError) {
      if (error.status === 401) redirect("/Admin/Login?next=%2FAdmin%2FSocialMediaModeration%2FHome");
      if (error.status === 403) redirect("/Admin/ModerationAccessDenied");
    }
    throw error;
  }
}
export async function requireModeration(permission: ModerationPermission = "moderation:view", mainOnly = false): Promise<ModerationActor> {
  if (!(MODERATION_PERMISSIONS as readonly string[]).includes(permission)) throw new ModerationAccessError(403, "unknown_permission");
  const actor = await requireSecureAdmin();
  if (!moderationCan(actor, permission) || (mainOnly && actor.role !== "main_admin")) return denied(403, "permission_required", actor);
  return actor;
}
export async function optionalModeration(permission: ModerationPermission = "moderation:view", mainOnly = false): Promise<ModerationActor | null> {
  try { return await requireModeration(permission, mainOnly); }
  catch (error) {
    if (error instanceof ModerationAccessError && error.status !== 503) return null;
    throw error;
  }
}
export async function requireModerationScreen(permission: ModerationPermission = "moderation:view", mainOnly = false) {
  try { return await requireModeration(permission, mainOnly); }
  catch (error) {
    if (error instanceof ModerationAccessError) {
      if (error.status === 401) redirect("/Admin/Login?next=%2FAdmin%2FSocialMediaModeration%2FHome");
      if (error.status === 403) redirect("/Admin/ModerationAccessDenied");
    }
    throw error;
  }
}
