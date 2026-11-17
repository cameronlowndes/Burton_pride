import { requireModerationScreen } from "@/lib/moderation/access";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getNavigationViewer } from "@/lib/moderation/navigation-server";
import ModerationHomeClient from "../../components/SocialMediaModeration/client/ModerationHomeClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Social Media Moderation | Burton Pride" };
export default async function SocialMediaModerationHomePage() {
  await requireModerationScreen();
  const viewer = await getNavigationViewer();
  if (!viewer) redirect("/Admin/Login");
  return <ModerationHomeClient displayName={viewer.displayName} isMainAdmin={viewer.isMainAdmin} permissions={viewer.permissionKeys} />;
}
