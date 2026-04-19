"use client";

import type { ReactNode } from "react";
import MoneyManagementSidebar from "../components/rooting/MoneyManagement";

export default function MoneySidebar({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full max-w-full overflow-hidden bg-slate-950 text-white">
      <MoneyManagementSidebar>
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="min-h-full w-full max-w-full">
            {children}
          </div>
        </main>
      </MoneyManagementSidebar>
    </div>
  );
}