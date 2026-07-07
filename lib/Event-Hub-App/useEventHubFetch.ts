"use client";

import { useCallback } from "react";
import { useEventHub } from "./EventHubProvider";

export function useEventHubFetch() {
  const { currentEvent } = useEventHub();

  return useCallback(
    async (input: string, init: RequestInit = {}) => {
      if (!currentEvent?.id) {
        throw new Error("No active Burton Pride event is selected.");
      }

      const headers = new Headers(init.headers || {});
      headers.set("x-burton-pride-event-id", currentEvent.id);
      headers.set("x-burton-pride-event-year", String(currentEvent.event_year));

      return fetch(input, {
        ...init,
        credentials: init.credentials || "include",
        headers,
      });
    },
    [currentEvent]
  );
}
