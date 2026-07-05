"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import BurtonPrideEventHubSidebar from "../components/rooting/BurtonPrideEventHubSideBar";

export default function BurtonPrideEventHub({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = "Burton Pride Event Hub";
  }, []);

  return (
    <div className="flex min-h-dvh w-full max-w-none overflow-hidden bg-slate-950 text-white">
      <BurtonPrideEventHubSidebar>
        <main className="min-w-0 flex-1 overflow-x-auto overflow-y-auto">
          <div className="min-h-full w-full max-w-none">{children}</div>
        </main>
      </BurtonPrideEventHubSidebar>
    </div>
  );
}