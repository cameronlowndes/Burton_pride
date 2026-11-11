"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  NOTIFICATION_API,
  NOTIFICATIONS_CHANGED,
  type NotificationFeed,
} from "@/lib/notifications/dashboard";

export function notifyNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(NOTIFICATIONS_CHANGED);
    channel.postMessage("refresh");
    channel.close();
  }
}
export function useNotifications(query = "page=1") {
  const [state, setState] = useState<{
    key: string;
    data: NotificationFeed | null;
    error: string;
  }>({ key: query, data: null, error: "" });
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const automatic = state.data?.autoRefresh !== false;
  const mounted = useRef(true);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    let request: AbortController | undefined;
    const load = async () => {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      setLoading(true);
      const timeout = window.setTimeout(
        () => controller.abort("timeout"),
        15000,
      );
      try {
        const response = await fetch(`${NOTIFICATION_API}?${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            response.status === 401
              ? "Your session expired. Sign in again."
              : response.status === 403
                ? "Your account cannot access these notifications."
                : "Could not load notifications. Try again.",
          );
        const data = (await response.json()) as NotificationFeed;
        if (!controller.signal.aborted && mounted.current)
          setState({ key: query, data, error: "" });
      } catch (error) {
        if (
          (!controller.signal.aborted ||
            controller.signal.reason === "timeout") &&
          mounted.current
        ) {
          setState({
            key: query,
            data: null,
            error:
              error instanceof Error && !controller.signal.aborted
                ? error.message
                : "The request timed out. Try again.",
          });
        }
      } finally {
        window.clearTimeout(timeout);
        if (active && request === controller && mounted.current)
          setLoading(false);
      }
    };
    void load();
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = automatic ? window.setInterval(refreshVisible, 30000) : null;
    const refreshAfterAction = () => void load();
    window.addEventListener(NOTIFICATIONS_CHANGED, refreshAfterAction);
    if (automatic) window.addEventListener("focus", refreshVisible);
    if (automatic)
      document.addEventListener("visibilitychange", refreshVisible);
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(NOTIFICATIONS_CHANGED)
        : null;
    if (channel) channel.onmessage = refreshAfterAction;
    return () => {
      active = false;
      request?.abort();
      if (timer !== null) window.clearInterval(timer);
      channel?.close();
      window.removeEventListener(NOTIFICATIONS_CHANGED, refreshAfterAction);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [query, revision, automatic]);
  return {
    data: state.key === query ? state.data : null,
    access: state.data,
    error: state.key === query ? state.error : "",
    loading,
    refresh,
  };
}

export async function markNotificationRead(id: string, adminId: string) {
  const response = await fetch(
    `${NOTIFICATION_API}?id=${encodeURIComponent(id)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedAdminId: adminId }),
    },
  );
  if (!response.ok)
    throw new Error(
      response.status === 409
        ? "The signed-in account changed. Reload this page."
        : "Could not mark the notification as read. Try again.",
    );
  notifyNotificationsChanged();
}
