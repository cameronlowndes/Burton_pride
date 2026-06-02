import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import AdminUsersClient from "./AdminUsersClient";

export const dynamic = "force-dynamic";

async function requireSupabaseMainAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: admin, error } = await supabaseAdmin
    .from("admin_users")
    .select("id, role, is_active")
    .eq("supabase_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !admin) {
    return null;
  }

  if (admin.role !== "main_admin") {
    return null;
  }

  return admin;
}

export default async function AdminUsersPage() {
  const admin = await requireSupabaseMainAdmin();

  if (!admin) {
    redirect("/Admin/Dashboard");
  }

  return <AdminUsersClient />;
}