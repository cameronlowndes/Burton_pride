import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import ModerationHomeClient from "../../components/SoicalMediaModeration/client/ModerationHomeClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Social Media Moderation | Burton Pride",
};

export default async function SocialMediaModerationHomePage() {
  const current = await getCurrentAdmin();
  if (!current) redirect("/Admin/Login");

  const admin = current as unknown as Record<string, unknown>;
  const name = [admin.display_name, admin.full_name, admin.name, admin.email]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  let savedPermissions = admin.permissions;
  if (typeof savedPermissions === "string") {
    try { savedPermissions = JSON.parse(savedPermissions); } catch { savedPermissions = []; }
  }
  const permissions = Array.isArray(savedPermissions)
    ? savedPermissions.filter((value): value is string => typeof value === "string")
    : savedPermissions && typeof savedPermissions === "object"
      ? Object.entries(savedPermissions).filter(([, value]) => value === true).map(([key]) => key)
      : [];

  return <ModerationHomeClient
    displayName={name || "Burton Pride team"}
    isMainAdmin={admin.role === "main_admin" || admin.is_main_admin === true}
    permissions={permissions}
  />;
}
