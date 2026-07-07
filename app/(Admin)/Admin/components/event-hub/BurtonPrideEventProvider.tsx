"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type BurtonPrideEvent = {
  id: string;
  event_name: string;
  event_year: number;
  event_date: string | null;
  event_start_time: string | null;
  event_end_time: string | null;
  setup_start_time: string | null;
  venue_name: string | null;
  venue_address: string | null;
  theme: string | null;
  status: "planning" | "open" | "live" | "finished" | "archived";
  is_active: boolean;
  is_locked: boolean;
  is_archived: boolean;
  created_at?: string;
  updated_at?: string;
};

type EventsResponse = {
  ok: boolean;
  error?: string;
  events?: BurtonPrideEvent[];
};

type BurtonPrideEventContextValue = {
  currentEvent: BurtonPrideEvent | null;
  eventId: string | null;
  eventYear: number | null;
  isEventLocked: boolean;
  loading: boolean;
  error: string | null;
  refreshEvent: () => Promise<void>;
};

const BurtonPrideEventContext =
  createContext<BurtonPrideEventContextValue | null>(null);

async function readJson(res: Response): Promise<EventsResponse> {
  const text = await res.text();

  try {
    return text
      ? JSON.parse(text)
      : { ok: false, error: "Server returned an empty response." };
  } catch {
    return {
      ok: false,
      error: text
        ? `Server returned invalid JSON. Raw response: ${text.slice(0, 300)}`
        : "Server returned invalid JSON.",
    };
  }
}

export function BurtonPrideEventProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [currentEvent, setCurrentEvent] = useState<BurtonPrideEvent | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshEvent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/burton-pride-event-hub/events", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load Burton Pride events.");
      }

      const events = data.events || [];

      const activeEvent =
        events.find(
          (event) => event.is_active === true && event.is_archived !== true,
        ) ||
        events.find((event) => event.is_active === true) ||
        null;

      setCurrentEvent(activeEvent);
    } catch (err) {
      setCurrentEvent(null);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load active Burton Pride event.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshEvent();
  }, [refreshEvent]);

  const value = useMemo<BurtonPrideEventContextValue>(
    () => ({
      currentEvent,
      eventId: currentEvent?.id || null,
      eventYear: currentEvent?.event_year || null,
      isEventLocked: Boolean(currentEvent?.is_locked),
      loading,
      error,
      refreshEvent,
    }),
    [currentEvent, loading, error, refreshEvent],
  );

  return (
    <BurtonPrideEventContext.Provider value={value}>
      {children}
    </BurtonPrideEventContext.Provider>
  );
}

export function useBurtonPrideEvent() {
  const context = useContext(BurtonPrideEventContext);

  if (!context) {
    throw new Error(
      "useBurtonPrideEvent must be used inside BurtonPrideEventProvider.",
    );
  }

  return context;
}