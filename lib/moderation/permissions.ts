/** Shared, dependency-free catalog for server checks and client permission editors. */
export const MODERATION_PERMISSION_KEYS = ["moderation:view", "moderation:review", "moderation:control", "moderation:export"] as const;
export type ModerationPermission = typeof MODERATION_PERMISSION_KEYS[number];
export const MODERATION_PERMISSION_DEFINITIONS = [
  { key: "moderation:view", label: "View moderation", description: "Read moderation screens, captured comments, evidence and service status." },
  { key: "moderation:review", label: "Review moderation", description: "Record standard human reviews and attach screenshots. Requires View moderation." },
  { key: "moderation:control", label: "Control moderation", description: "Run service commands and connection tests. Requires View moderation; protected commands also require Authenticator and the verification password.", dangerous: true },
  { key: "moderation:export", label: "Export evidence", description: "Download text, Word and image evidence. Requires View moderation." },
] as const;

export const MODERATION_OPERATIONS = {
  view: { permission: "moderation:view", mainOnly: false },
  reviewComment: { permission: "moderation:review", mainOnly: false },
  attachEvidence: { permission: "moderation:review", mainOnly: false },
  serviceControl: { permission: "moderation:control", mainOnly: false },
  verifyControl: { permission: "moderation:control", mainOnly: false },
  checkConnection: { permission: "moderation:control", mainOnly: false },
  exportEvidence: { permission: "moderation:export", mainOnly: false },
  managePolicy: { permission: "moderation:view", mainOnly: true },
  createManual: { permission: "moderation:view", mainOnly: true },
  reviewManual: { permission: "moderation:view", mainOnly: true },
  viewManual: { permission: "moderation:view", mainOnly: true },
  manageMenu: { permission: "moderation:view", mainOnly: false, additionalPermission: "site_pages:manage" },
  viewAudit: { permission: "moderation:view", mainOnly: false, additionalPermission: "audit_logs:view" },
} as const;
export type ModerationOperation = keyof typeof MODERATION_OPERATIONS;
export type PermissionActor = { role: string; permissionKeys: readonly string[]; is_active?: boolean };

export function canModerationPermission(actor: PermissionActor, permission: ModerationPermission): boolean {
  if (actor.is_active === false || !["main_admin", "admin", "editor"].includes(actor.role) ||
    !(MODERATION_PERMISSION_KEYS as readonly string[]).includes(permission)) return false;
  return actor.role === "main_admin" || (actor.permissionKeys.includes("moderation:view") && actor.permissionKeys.includes(permission));
}
export function canModerationOperation(actor: PermissionActor, operation: ModerationOperation): boolean {
  if (!Object.prototype.hasOwnProperty.call(MODERATION_OPERATIONS, operation)) return false;
  const rule = MODERATION_OPERATIONS[operation];
  if (!canModerationPermission(actor, rule.permission)) return false;
  if (actor.role === "main_admin") return true;
  return !rule.mainOnly && (!("additionalPermission" in rule) || actor.permissionKeys.includes(rule.additionalPermission));
}

/** Action grants never work without viewing. Reading existing grants does not silently add it. */
export function moderationPermissionProblem(keys: readonly string[]): string | null {
  return keys.some((key) => key === "moderation:review" || key === "moderation:control" || key === "moderation:export") && !keys.includes("moderation:view")
    ? "Select View moderation before granting review, control or export access." : null;
}
/** UI convenience: grant viewing alongside an action; removing viewing removes dependent grants. */
export function toggleModerationSelection(keys: readonly string[], key: string): string[] {
  if (keys.includes(key)) return key === "moderation:view"
    ? keys.filter((value) => !(MODERATION_PERMISSION_KEYS as readonly string[]).includes(value))
    : keys.filter((value) => value !== key);
  const next = [...keys, key];
  if ((MODERATION_PERMISSION_KEYS as readonly string[]).includes(key) && key !== "moderation:view" && !next.includes("moderation:view")) next.push("moderation:view");
  return [...new Set(next)];
}
