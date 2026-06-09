"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import MoneyManagementSidebar from "../components/rooting/MoneyManagement";
import Watermark from "../components/money/watermark/Watermark";

export default function MoneySidebar({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = "Burton Pride Money Management APP";
  }, []);

  return (
    <div className="flex min-h-dvh w-full max-w-none overflow-hidden bg-slate-950 text-white">
      <MoneyManagementSidebar>
        <main className="min-w-0 flex-1 overflow-x-auto overflow-y-auto">
          <div className="min-h-full w-full max-w-none">
            {children}
          </div>
          <Watermark />
        </main>
      </MoneyManagementSidebar>
    </div>
  );
}