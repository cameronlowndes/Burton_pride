import "server-only";
import { redirect } from "next/navigation";
import { requireSecureAdmin, ModerationAccessError } from "@/lib/moderation/access";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { createClient } from "@/lib/supabase/server";
export { supabaseAdmin as developmentDb };
export async function developmentAccess() {
  const actor = await requireSecureAdmin();
  if (actor.role !== "main_admin" && !actor.permissionKeys.includes("admin:dashboard:view")) throw new ModerationAccessError(403, "portal_access_required");
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || user.id !== actor.supabase_user_id) throw new ModerationAccessError(401, "identity_required");
  const profile = await supabaseAdmin.from("admin_users").select("id,email,role,is_active").eq("id", actor.id).eq("is_active", true).maybeSingle();
  if (profile.error) throw new ModerationAccessError(503, "account_unavailable");
  if (!profile.data) throw new ModerationAccessError(403, "account_unavailable");
  return { supabase: supabaseAdmin, user, admin: { ...profile.data, name: actor.displayName, full_name: actor.displayName, display_name: actor.displayName }, error: null };
}
export async function developmentScreen() {
  try { return await developmentAccess(); }
  catch (error) {
    if (error instanceof ModerationAccessError && error.status === 401) redirect("/Admin/Login?next=%2FAdmin%2FDevelopmentRequests");
    if (error instanceof ModerationAccessError && error.status === 403) redirect("/Admin/Dashboard?development_access=denied");
    throw error;
  }
}
export function validRequestId(value: unknown): value is string { return typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value); }
