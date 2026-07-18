"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import StockManagementProvider from "../components/stock-management/StockManagementProvider";
import StockManagementSidebar from "../components/rooting/StockManagement";

export default function StockManagerLayout({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    const previousTitle = document.title;

    document.title = "Burton Pride Stock Management App";

    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <StockManagementProvider>
      <div className="flex min-h-dvh w-full max-w-none overflow-hidden bg-slate-950 text-white">
        <StockManagementSidebar>
          <main className="min-w-0 flex-1 overflow-x-auto overflow-y-auto">
            <div className="min-h-full w-full max-w-none">{children}</div>
          </main>
        </StockManagementSidebar>
      </div>
    </StockManagementProvider>
  );
}