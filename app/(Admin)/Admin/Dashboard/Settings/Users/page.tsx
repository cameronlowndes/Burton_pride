import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import AdminUsersClient from "./AdminUsersClient";

export const dynamic = "force-dynamic";

const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";
const SESSION_COOKIE = "burton_admin_session";

async function requireCurrentMainAdmin() {
  const cookieStore = await cookies();

  const adminId = cookieStore.get(ADMIN_ID_COOKIE)?.value || "";
  const adminEmail = cookieStore.get(ADMIN_EMAIL_COOKIE)?.value || "";
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value || "";

  if (!adminId || !adminEmail || !sessionToken) {
    return null;
  }

  const { data: admin, error } = await supabaseAdmin
    .from("admin_users")
    .select("id, email, role, is_active")
    .eq("id", adminId)
    .eq("email", adminEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !admin) return null;

  if (admin.role !== "main_admin") return null;

  return admin;
}

export default async function AdminUsersPage() {
  const admin = await requireCurrentMainAdmin();

  if (!admin) {
    redirect("/Admin/Dashboard");
  }

  return <AdminUsersClient />;
}