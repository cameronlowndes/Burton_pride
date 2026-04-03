import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type CurrentAdmin = {
  id: string;
  clerk_user_id: string;
  role: "main_admin" | "admin" | "editor";
  is_active: boolean;
};

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from("admin_users")
    .select("id, clerk_user_id, role, is_active")
    .eq("clerk_user_id", userId)
    .single();

  if (error || !data || !data.is_active) return null;

  return data as CurrentAdmin;
}

export async function hasPermission(permissionKey: string): Promise<boolean> {
  const admin = await getCurrentAdmin();
  if (!admin) return false;

  if (admin.role === "main_admin") return true;

  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from("admin_user_permissions")
    .select(`
      is_allowed,
      admin_permissions!inner (
        permission_key
      )
    `)
    .eq("admin_user_id", admin.id)
    .eq("admin_permissions.permission_key", permissionKey)
    .single();

  if (error || !data) return false;

  return !!data.is_allowed;
}