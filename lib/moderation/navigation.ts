import { canModerationOperation } from "./permissions";
/** Shared navigation rules. Safe to import in server and client components. */
export const MODERATION_ROUTES = {
  welcome: "/Admin/SocialMediaModeration",
  home: "/Admin/SocialMediaModeration/Home",
  developmentRequests: "/Admin/DevelopmentRequests",
  editor: "/Admin/Dashboard/Settings/PageEditor/SocialMediaModerationSidebar",
} as const;

export type NavigationViewer = {
  displayName: string;
  role: "main_admin" | "admin" | "editor";
  isMainAdmin: boolean;
  permissionKeys: string[];
};

export type NavigationItem = {
  id: string;
  label: string;
  href: string | null;
  item_type: "link" | "group";
  parent_id: string | null;
  sort_order: number;
  is_enabled: boolean;
  icon?: string | null;
  description?: string | null;
  permission_key?: string | null;
  open_in_new_tab: boolean;
  is_coming_soon?: boolean;
  disabled?: boolean;
  disabled_reason?: string | null;
  created_at?: string;
  updated_at?: string;
};

const PERMISSION = /^[a-z][a-z0-9_]*(?::[a-z0-9_]+)+$/;
export function permissionKeys(value: unknown): string[] {
  if (typeof value === "string") {
    try { return permissionKeys(JSON.parse(value)); }
    catch { return permissionKeys(value.split(",")); }
  }
  const values = Array.isArray(value) ? value : value && typeof value === "object"
    ? Object.entries(value).filter(([, allowed]) => allowed === true).map(([key]) => key) : [];
  return [...new Set(values.filter((key): key is string => typeof key === "string")
    .map((key) => key.trim()).filter((key) => PERMISSION.test(key)))];
}

export function adminDisplayName(account: Record<string, unknown>): string {
  for (const field of ["username", "name", "full_name", "display_name"]) {
    const value = account[field];
    if (typeof value === "string" && value.trim() && !value.includes("@")) return value.trim();
  }
  return "Social media moderator";
}

/** Repair known old routes while retaining filters and anchors. */
export function safeNavigationHref(value: unknown): string {
  if (typeof value !== "string") return "";
  const href = value.trim();
  if (!/^\/Admin(?:\/|$)/i.test(href) || /[\\\u0000-\u0020]/.test(href)) return "";
  try {
    const url = new URL(href, "https://moderation.invalid");
    if (url.origin !== "https://moderation.invalid" || !/^\/Admin(?:\/|$)/i.test(url.pathname)) return "";
    // Encoded separators/dot segments must not escape the admin area in a later decode.
    const decoded = decodeURIComponent(url.pathname);
    if (/[\\\u0000-\u0020]/.test(decoded) || /%[0-9a-f]{2}/i.test(decoded) ||
      decoded.split("/").some((part) => part === "." || part === "..")) return "";
    const legacy = "/Admin/Dashboard/SocialMediaModeration";
    if (url.pathname.toLowerCase() === legacy.toLowerCase() || url.pathname.toLowerCase() === legacy.toLowerCase() + "/") {
      url.pathname = MODERATION_ROUTES.home;
    } else if (url.pathname.toLowerCase().startsWith(legacy.toLowerCase() + "/")) {
      url.pathname = MODERATION_ROUTES.welcome + url.pathname.slice(legacy.length);
    } else if (/^\/Admin\/Dashboard\/Settings\/DevelopmentRequests(?:\/|$)/i.test(url.pathname)) {
      url.pathname = url.pathname.replace(/^\/Admin\/Dashboard\/Settings\/DevelopmentRequests/i, MODERATION_ROUTES.developmentRequests);
    }
    return url.pathname + url.search + url.hash;
  } catch { return ""; }
}

/** Saved permission keys are authoritative; labels never grant or remove access. */
export function visibleNavigationItems(items: NavigationItem[], viewer: NavigationViewer): NavigationItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  function allowed(item: NavigationItem, seen = new Set<string>()): boolean {
    if (seen.has(item.id) || !item.is_enabled) return false;
    const path = safeNavigationHref(item.href).split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase();
    if ((path === "/admin/socialmediamoderation/jobsid/manual" || path.startsWith("/admin/socialmediamoderation/jobsid/manual/")) && !canModerationOperation(viewer, "createManual")) return false;
    if (path === "/admin/dashboard/settings/pageeditor/socialmediamoderationsidebar" && !canModerationOperation(viewer, "manageMenu")) return false;

    if (!viewer.isMainAdmin && item.permission_key && !viewer.permissionKeys.includes(item.permission_key)) return false;
    if (item.parent_id) {
      seen.add(item.id);
      const parent = byId.get(item.parent_id);
      if (!parent || parent.disabled || parent.is_coming_soon || !allowed(parent, seen)) return false;
    }
    return true;
  }
  const permitted = items.filter((item) => allowed(item)).map((item) => ({ ...item, href: safeNavigationHref(item.href) || null }));
  return permitted.filter((item) => item.item_type === "group"
    ? Boolean(item.href || item.is_coming_soon || item.disabled || permitted.some((child) => child.parent_id === item.id))
    : Boolean(item.href)).sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
}
