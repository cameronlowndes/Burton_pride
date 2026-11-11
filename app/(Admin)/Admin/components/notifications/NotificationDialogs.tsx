"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { notifyNotificationsChanged } from "./useNotifications";
import styles from "./notifications.module.css";

type Operation = {
  title: string;
  description: string;
  execute: () => Promise<string>;
};
type Request =
  | Operation
  | { title: string; description: string; prepare: () => Promise<Operation> };
type State = {
  phase: "preparing" | "confirm" | "working" | "result" | "error";
  title: string;
  message: string;
  operation?: Operation;
};
const Context = createContext<((request: Request) => void) | null>(null);
export function useNotificationDialogs() {
  const value = useContext(Context);
  if (!value)
    throw new Error("Notification actions require NotificationDialogs.");
  return value;
}

export default function NotificationDialogs({
  children,
}: {
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const decline = useRef<HTMLButtonElement>(null);
  const accept = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<State | null>(null);
  const generation = useRef(0);
  const working = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const id = useId();
  const close = useCallback(() => {
    if (working.current) return;
    generation.current++;
    dialog.current?.close();
    setState(null);
    if (returnFocus.current?.isConnected) returnFocus.current.focus();
  }, []);
  const request = useCallback((input: Request) => {
    if (working.current || dialog.current?.open) return;
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const version = ++generation.current;
    if ("prepare" in input) {
      setState({
        phase: "preparing",
        title: input.title,
        message: input.description,
      });
      void input
        .prepare()
        .then((operation) => {
          if (version === generation.current)
            setState({
              phase: "confirm",
              title: operation.title,
              message: operation.description,
              operation,
            });
        })
        .catch((error) => {
          if (version === generation.current)
            setState({
              phase: "error",
              title: "Action unavailable",
              message:
                error instanceof Error
                  ? error.message
                  : "Could not prepare this action.",
            });
        });
    } else
      setState({
        phase: "confirm",
        title: input.title,
        message: input.description,
        operation: input,
      });
  }, []);
  useEffect(() => {
    if (state && !dialog.current?.open) {
      dialog.current?.showModal();
      decline.current?.focus();
    }
    if (state?.phase === "result" || state?.phase === "error")
      accept.current?.focus();
  }, [state]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  async function execute() {
    if (!state?.operation || working.current) return;
    working.current = true;
    const operation = state.operation;
    setState({
      phase: "working",
      title: operation.title,
      message: "Applying your choice…",
    });
    try {
      const message = await operation.execute();
      setState({ phase: "result", title: "Action completed", message });
    } catch (error) {
      setState({
        phase: "error",
        title: "Action could not be completed",
        message:
          error instanceof Error
            ? error.message
            : "Refresh notifications and try again.",
      });
    } finally {
      working.current = false;
    }
  }
  return (
    <Context.Provider value={request}>
      {children}
      <dialog
        ref={dialog}
        className={styles.modal}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <h2 id={`${id}-title`} className={styles.title}>
          {state?.title}
        </h2>
        <p
          id={`${id}-description`}
          className={styles.muted}
          role={state?.phase === "error" ? "alert" : "status"}
        >
          {state?.message}
        </p>
        <div className={styles.actions}>
          {state?.phase === "result" || state?.phase === "error" ? (
            <button
              ref={accept}
              type="button"
              className={styles.button}
              onClick={close}
            >
              Close
            </button>
          ) : (
            <>
              <button
                ref={decline}
                type="button"
                className={styles.button}
                disabled={state?.phase === "working"}
                onClick={close}
              >
                Decline
              </button>
              <button
                type="button"
                className={styles.button}
                disabled={state?.phase !== "confirm"}
                onClick={() => void execute()}
              >
                {state?.phase === "working" ? "Working…" : "Accept"}
              </button>
            </>
          )}
        </div>
      </dialog>
    </Context.Provider>
  );
}

export async function notificationControl(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/notifications/controls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result)
    throw new Error(
      result?.error ||
        "The result could not be confirmed. Refresh notifications before trying again.",
    );
  return result as { token?: string; count?: number; enabled?: boolean };
}

export function DeleteNotificationButton({
  adminId,
  scope,
  id,
  title,
  disabled = false,
}: {
  adminId: string;
  scope: "one" | "read" | "all";
  id?: string;
  title?: string;
  disabled?: boolean;
}) {
  const request = useNotificationDialogs();
  const label =
    scope === "one"
      ? "Delete"
      : scope === "read"
        ? "Delete all read notifications"
        : "Delete all my notifications";
  return (
    <button
      type="button"
      className={`${styles.button} ${styles.danger}`}
      disabled={disabled}
      aria-label={
        scope === "one"
          ? `Delete notification: ${title ?? "notification"}`
          : label
      }
      onClick={() =>
        request({
          title: label,
          description: "Checking which of your notifications this will remove…",
          prepare: async () => {
            const preview = await notificationControl({
              action: "preview-delete",
              expectedAdminId: adminId,
              scope,
              id,
            });
            const count = preview.count ?? 0;
            if (count === 0)
              throw new Error(
                scope === "read"
                  ? "You have no read notifications to delete."
                  : "There are no matching notifications to delete. Refresh your inbox.",
              );
            return {
              title:
                scope === "one"
                  ? "Delete this notification?"
                  : scope === "read"
                    ? "Delete all your read notifications?"
                    : "Delete all your notifications?",
              description: `This will remove ${count} notification${count === 1 ? "" : "s"} from your inbox${scope === "one" ? ` (${title ?? "selected notification"})` : " across all available sources, including other pages"}. It does not delete tasks, moderation jobs or anyone else’s notifications. New arrivals after this confirmation was prepared will stay in your inbox.`,
              execute: async () => {
                const result = await notificationControl({
                  action: "delete",
                  expectedAdminId: adminId,
                  token: preview.token,
                });
                notifyNotificationsChanged();
                const removed = result.count ?? 0;
                return `${removed} notification${removed === 1 ? "" : "s"} removed from your inbox.`;
              },
            };
          },
        })
      }
    >
      {label}
    </button>
  );
}

export function AutoRefreshButton({
  adminId,
  enabled,
}: {
  adminId: string;
  enabled: boolean;
}) {
  const request = useNotificationDialogs();
  return (
    <button
      type="button"
      className={styles.button}
      aria-pressed={enabled}
      onClick={() =>
        request({
          title: enabled
            ? "Turn off automatic refresh?"
            : "Turn on automatic refresh?",
          description: enabled
            ? "Stop background notification API polling and refreshes when returning to the page for your account. Manual refresh, changing filters and updates after your own actions will still work. Phone push and security checks continue."
            : "Automatically refresh your notification inbox every 30 seconds while visible, and when you return to it.",
          execute: async () => {
            const result = await notificationControl({
              action: "refresh",
              expectedAdminId: adminId,
              enabled: !enabled,
            });
            notifyNotificationsChanged();
            return result.enabled
              ? "Automatic notification refresh is on."
              : "Automatic notification refresh is off. Use Refresh notifications when you want an update.";
          },
        })
      }
    >
      Auto-refresh: {enabled ? "On" : "Off"}
    </button>
  );
}
