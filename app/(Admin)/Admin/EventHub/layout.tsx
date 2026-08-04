"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { CalendarDays, Lock, Unlock } from "lucide-react";
import BurtonPrideEventHubSidebar from "../components/rooting/BurtonPrideEventHubSideBar";
import {
  BurtonPrideEventProvider,
  useBurtonPrideEvent,
} from "../components/event-hub/BurtonPrideEventProvider";

export default function BurtonPrideEventHub({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = "Burton Pride Event Hub";
  }, []);

  return (
    <BurtonPrideEventProvider>
      <div className="flex min-h-dvh w-full max-w-none overflow-hidden bg-slate-950 text-white">
        <BurtonPrideEventHubSidebar>
          <main className="min-w-0 flex-1 overflow-x-auto overflow-y-auto">
            <EventHubActiveEventBar />
            <div className="min-h-full w-full max-w-none">{children}</div>
          </main>
        </BurtonPrideEventHubSidebar>
      </div>
    </BurtonPrideEventProvider>
  );
}

function EventHubActiveEventBar() {
  const { currentEvent, loading, error } = useBurtonPrideEvent();

  if (loading) {
    return (
      <div className="border-b border-white/10 bg-slate-900 px-4 py-3 text-sm text-white/60">
        Loading active Burton Pride event...
      </div>
    );
  }

  if (error || !currentEvent) {
    return (
      <div className="border-b border-red-400/20 bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-100">
        No active Burton Pride event is set. Please set one in Event Management.
      </div>
    );
  }

  return (
    <div className="border-b border-white/10 bg-gradient-to-r from-pink-950/60 via-purple-950/60 to-slate-900 px-4 py-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full border border-pink-400/30 bg-pink-500/10 px-3 py-1 font-black text-pink-100">
            <CalendarDays className="h-4 w-4" />
            Active Event
          </span>

          <span className="font-extrabold text-white">
            {currentEvent.event_name} {currentEvent.event_year}
          </span>

          <span className="text-white/70">
            {currentEvent.event_date || "No date set"}
          </span>

          <span className="text-white/50">·</span>

          <span className="text-white/70">
            {currentEvent.event_start_time || "No start"} -{" "}
            {currentEvent.event_end_time || "No end"}
          </span>

          {currentEvent.venue_name && (
            <>
              <span className="text-white/50">·</span>
              <span className="text-white/70">{currentEvent.venue_name}</span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentEvent.is_locked ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-100">
              <Lock className="h-3.5 w-3.5" />
              Locked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-100">
              <Unlock className="h-3.5 w-3.5" />
              Open
            </span>
          )}

          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold capitalize text-white/80">
            {currentEvent.status}
          </span>
        </div>
      </div>
    </div>
  );
}