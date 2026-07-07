"use client";

import { AlertTriangle, CalendarDays, Lock } from "lucide-react";
import { useEventHub } from "@/lib/Event-Hub-App/EventHubProvider";

export default function EventHubShell({ children }: { children: React.ReactNode }) {
  const { currentEvent, loadingEvent, eventError, isEventLocked } = useEventHub();

  if (loadingEvent) {
    return <div className="min-h-screen bg-[#12091f] p-6 text-white">Loading Burton Pride event...</div>;
  }

  if (eventError || !currentEvent) {
    return (
      <div className="min-h-screen bg-[#12091f] p-6 text-white">
        <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-6 text-red-100">
          <div className="flex items-center gap-3 font-black">
            <AlertTriangle className="h-5 w-5" /> No active Burton Pride event found
          </div>
          <p className="mt-2 text-sm text-red-100/80">
            {eventError || "Create or select an active event before using the Event Hub."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#12091f] text-white">
      <div className="border-b border-white/10 bg-black/20 px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-pink-500/20 p-2 text-pink-100">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">Active Event</p>
              <h1 className="text-lg font-black">
                {currentEvent.event_name} · {currentEvent.event_year}
              </h1>
              <p className="text-xs text-white/60">
                {currentEvent.event_date} · {currentEvent.venue_name || "Venue not set"}
              </p>
            </div>
          </div>

          {isEventLocked && (
            <div className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-100">
              <Lock className="h-4 w-4" /> Event locked
            </div>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}
