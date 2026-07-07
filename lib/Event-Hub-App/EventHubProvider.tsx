"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { BurtonPrideEvent, CurrentEventResponse } from "./types";

type EventHubContextValue = {
  currentEvent: BurtonPrideEvent | null;
  eventId: string | null;
  eventYear: number | null;
  isEventLocked: boolean;
  loadingEvent: boolean;
  eventError: string | null;
  refreshEvent: () => Promise<void>;
  requireUnlockedEvent: () => boolean;
};

const EventHubContext = createContext<EventHubContextValue | null>(null);

async function readJson(res: Response): Promise<CurrentEventResponse> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : { ok: false, error: "Server returned an empty response." };
  } catch {
    return { ok: false, error: text || "Server returned invalid JSON." };
  }
}

export function EventHubProvider({ children }: { children: React.ReactNode }) {
  const [currentEvent, setCurrentEvent] = useState<BurtonPrideEvent | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);

  const refreshEvent = useCallback(async () => {
    try {
      setLoadingEvent(true);
      setEventError(null);

      const res = await fetch("/api/admin/event-hub/current-event", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load the active Burton Pride event.");
      }

      setCurrentEvent(data.event || null);
    } catch (error) {
      setCurrentEvent(null);
      setEventError(error instanceof Error ? error.message : "Failed to load the active Burton Pride event.");
    } finally {
      setLoadingEvent(false);
    }
  }, []);

  useEffect(() => {
    refreshEvent();
  }, [refreshEvent]);

  const value = useMemo<EventHubContextValue>(() => {
    return {
      currentEvent,
      eventId: currentEvent?.id || null,
      eventYear: currentEvent?.event_year || null,
      isEventLocked: Boolean(currentEvent?.is_locked),
      loadingEvent,
      eventError,
      refreshEvent,
      requireUnlockedEvent: () => Boolean(currentEvent?.is_locked),
    };
  }, [currentEvent, eventError, loadingEvent, refreshEvent]);

  return <EventHubContext.Provider value={value}>{children}</EventHubContext.Provider>;
}

export function useEventHub() {
  const context = useContext(EventHubContext);
  if (!context) {
    throw new Error("useEventHub must be used inside EventHubProvider.");
  }
  return context;
}
