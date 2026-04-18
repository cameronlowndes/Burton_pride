"use client";

import type { ReactNode } from "react";
import MoneyManagementSidebar from "../components/rooting/MoneyManagement";

export default function MoneySidebar({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white">
      <MoneyManagementSidebar>
        <main className="flex-1 overflow-y-auto">
          <div className="min-h-screen w-full">
            {children}
          </div>
        </main>
      </MoneyManagementSidebar>
    </div>
  );
}