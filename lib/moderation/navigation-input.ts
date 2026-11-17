import { safeNavigationHref } from "./navigation";
export const NAVIGATION_COLUMNS = "id,label,href,item_type,parent_id,sort_order,is_enabled,icon,open_in_new_tab,is_coming_soon,disabled,disabled_reason,permission_key,description,created_at,updated_at";
export class MenuInputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function menuId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new MenuInputError("A valid menu item ID is required.");
  }
  return value.toLowerCase();
}
export function menuFields(body: Record<string, unknown>, create = false) {
  const result: Record<string, string | number | boolean | null> = {};
  for (const field of ["label", "href", "icon", "description", "permission_key", "disabled_reason"] as const) {
    if (!(field in body) && !create) continue;
    const optional = ["description", "permission_key", "disabled_reason"].includes(field);
    const value = body[field] ?? (optional ? "" : undefined);
    if (typeof value !== "string" || (!optional && !value.trim())) throw new MenuInputError(`Enter a valid ${field}.`);
    const cleaned = value.trim();
    const max = field === "href" || field === "description" ? 2048 : 200;
    if (cleaned.length > max) throw new MenuInputError(`The ${field} is too long (maximum ${max} characters).`);
    if (field === "href") {
      const href = safeNavigationHref(cleaned);
      if (!href) throw new MenuInputError("Use a valid internal path beginning with /Admin/.");
      result.href = href;
    } else {
      if (field === "permission_key" && cleaned && !/^[a-z][a-z0-9_]*(?::[a-z0-9_]+)+$/.test(cleaned)) {
        throw new MenuInputError("Use a permission key such as site_pages:manage, or leave it blank.");
      }
      result[field] = cleaned || null;
    }
  }
  for (const field of ["is_enabled", "open_in_new_tab", "is_coming_soon", "disabled"] as const) {
    if (!(field in body) && !create) continue;
    const value = field in body ? body[field] : field === "is_enabled";
    if (typeof value !== "boolean") throw new MenuInputError(`${field} must be true or false.`);
    result[field] = value;
  }
  if (create || "sort_order" in body) {
    const value = "sort_order" in body ? body.sort_order : 0;
    if (typeof value !== "number" || !Number.isInteger(value) || Math.abs(value) > 1000000) throw new MenuInputError("Sort order must be a whole number between -1000000 and 1000000.");
    result.sort_order = value;
  }
  if (!Object.keys(result).length) throw new MenuInputError("No supported menu fields were supplied.");
  return result;
}
export function reorderIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 500) throw new MenuInputError("Provide up to 500 menu item IDs.");
  const ids = value.map(menuId);
  if (new Set(ids).size !== ids.length) throw new MenuInputError("The menu order contains duplicate IDs.");
  return ids;
}
