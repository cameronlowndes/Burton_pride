"use client";

import type { ReactNode } from "react";
import SocialMediaModerationSidebar from "../components/rooting/SocialMediaModerationNavBar";

export default function SocialMediaModerationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full max-w-none overflow-hidden bg-slate-950 text-white">
      <SocialMediaModerationSidebar>
        <main className="min-w-0 flex-1 overflow-x-auto overflow-y-auto">
          <div className="min-h-full w-full max-w-none">
            {children}
          </div>
        </main>
      </SocialMediaModerationSidebar>
    </div>
  );
}