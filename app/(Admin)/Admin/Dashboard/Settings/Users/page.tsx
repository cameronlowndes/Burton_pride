import { redirect } from "next/navigation";
import { requireMainAdmin } from "@/lib/adminPermissions";
import AdminUsersClient from "./AdminUsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  try {
    await requireMainAdmin();
  } catch {
    redirect("/Admin/Dashboard");
  }

  return <AdminUsersClient />;
}
