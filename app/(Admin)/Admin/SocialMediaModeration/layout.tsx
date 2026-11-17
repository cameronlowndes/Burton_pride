import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import SocialMediaModerationSidebar from "../components/rooting/SocialMediaModerationNavBar";
import { requireModerationScreen } from "@/lib/moderation/access";
import ModerationSessionBoundary from "../components/SocialMediaModeration/client/ModerationSessionBoundary";

export const dynamic = "force-dynamic";
export default async function SocialMediaModerationLayout({ children }: { children: ReactNode }) {
  const actor = await requireModerationScreen();
  const viewer = { displayName: actor.displayName, permissionKeys: actor.permissionKeys, role: actor.role };
  return (
    <ModerationSessionBoundary initialFingerprint={JSON.stringify([actor.id, actor.role, actor.displayName, [...actor.permissionKeys].sort()])}>
    <div className="flex min-h-dvh w-full max-w-none overflow-hidden bg-slate-950 text-white">
      <SocialMediaModerationSidebar permissions={viewer.permissionKeys} adminRole={viewer.role}
        adminName={viewer.displayName}>
        <main className="min-w-0 flex-1 overflow-x-auto overflow-y-auto">
          <div className="min-h-full w-full max-w-none">{children}</div>
        </main>
      </SocialMediaModerationSidebar>
    </div>
    </ModerationSessionBoundary>
  );
}
