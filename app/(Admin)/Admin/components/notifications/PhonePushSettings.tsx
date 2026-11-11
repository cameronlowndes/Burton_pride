"use client";

import { Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

const endpoint = "/api/admin/notifications/push";
const workerPath = "/admin-notifications-sw.js";
const workerScope = "/Admin/Notifications";

type Device = {
  registration: ServiceWorkerRegistration;
  publicKey: string;
  subscription: PushSubscription | null;
  enabled: boolean;
};

async function send(body: object) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new Error(data?.error ?? "Could not update phone notifications.");
  return data.result as "enabled" | "disabled" | "queued" | "sent";
}

function keyBytes(key: string) {
  const base64 = key.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export default function PhonePushSettings({
  buttonClass,
}: {
  buttonClass: string;
}) {
  const [device, setDevice] = useState<Device | null>(null);
  const [setupMessage, setSetupMessage] = useState(
    "Checking phone notification support…",
  );
  const [reload, setReload] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function setup() {
      if (
        !window.isSecureContext ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled)
          setSetupMessage(
            "Open the portal in a browser that supports Web Push over HTTPS. On iPhone, add the portal to your Home Screen and open it from there.",
          );
        return;
      }

      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        const config = await response.json().catch(() => null);
        if (response.status === 401 || response.redirected) {
          throw new Error(
            "Your admin session expired. Sign in again to manage phone notifications.",
          );
        }
        if (response.status === 404) {
          throw new Error(
            "The phone notification endpoint is missing from this deployment.",
          );
        }
        if (!response.ok || !config) {
          throw new Error(
            config?.error ??
              `Could not load phone notification setup (HTTP ${response.status}).`,
          );
        }
        if (!config.available) {
          if (!cancelled)
            setSetupMessage("Phone push is awaiting server setup.");
          return;
        }
        const scope = new URL(workerScope, window.location.origin).href;
        const existing = await navigator.serviceWorker.getRegistration(scope);
        const existingWorker =
          existing?.active ?? existing?.waiting ?? existing?.installing;
        if (
          existing?.scope === scope &&
          existingWorker &&
          new URL(existingWorker.scriptURL).pathname !== workerPath
        ) {
          throw new Error(
            "Another service worker is already using the Notification Centre.",
          );
        }
        const registration = await navigator.serviceWorker.register(
          workerPath,
          { scope: workerScope },
        );
        const subscription = await registration.pushManager.getSubscription();
        const enabled = subscription
          ? (await send({
              action: "status",
              endpoint: subscription.endpoint,
            })) === "enabled"
          : false;
        if (!cancelled)
          setDevice({
            registration,
            subscription,
            enabled,
            publicKey: config.publicKey,
          });
      } catch (failure) {
        if (!cancelled)
          setSetupMessage(
            failure instanceof Error
              ? failure.message
              : "Could not set up phone notifications.",
          );
      }
    }
    void setup();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function update(action: "enable" | "test" | "disable") {
    if (!device || working) return;
    setError("");
    setStatus("");
    setWorking(true);
    try {
      if (action === "enable") {
        if ((await Notification.requestPermission()) !== "granted") {
          throw new Error(
            "Allow notifications for this app in your device settings, then try again.",
          );
        }
        if (!device.registration.active) {
          throw new Error(
            "Phone notifications are still starting. Wait a moment and try again.",
          );
        }
        if (device.subscription) await device.subscription.unsubscribe();
        const subscription = await device.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(device.publicKey),
        });
        // Keep the local subscription available for retry even if saving to the server fails.
        setDevice({ ...device, subscription });
        await send({ action: "enable", subscription: subscription.toJSON() });
        setDevice({ ...device, subscription, enabled: true });
        setStatus("Phone notifications are enabled on this device.");
      } else if (device.subscription) {
        const result = await send({
          action,
          endpoint: device.subscription.endpoint,
        });
        if (action === "test") {
          if (result === "disabled") {
            setDevice({ ...device, enabled: false });
            throw new Error(
              "This device is no longer registered. Enable phone notifications again.",
            );
          }
          setStatus(
            result === "sent"
              ? "Test sent. Check your phone."
              : "The push service is temporarily unavailable. The test will retry automatically.",
          );
        } else {
          setDevice({ ...device, enabled: false });
          const removed = await device.subscription.unsubscribe();
          const subscription = removed
            ? null
            : await device.registration.pushManager.getSubscription();
          setDevice({ ...device, subscription, enabled: false });
          setStatus("Phone notifications are disabled on this device.");
        }
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not update phone notifications.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="mt-5 border-t border-white/15 pt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Smartphone aria-hidden="true" size={16} className="text-purple-200" />
        Phone notifications
      </h3>
      {device ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            {device.enabled
              ? "Enabled on this device."
              : "Open this page on the phone you want to use."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {device.enabled ? (
              <>
                <button
                  type="button"
                  className={buttonClass}
                  disabled={working}
                  onClick={() => void update("test")}
                >
                  Send test notification
                </button>
                <button
                  type="button"
                  className={buttonClass}
                  disabled={working}
                  onClick={() => void update("disable")}
                >
                  Disable on this device
                </button>
              </>
            ) : (
              <button
                type="button"
                className={buttonClass}
                disabled={working}
                onClick={() => void update("enable")}
              >
                Enable phone notifications
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p
            role="status"
            className="mt-2 text-sm leading-relaxed text-slate-300"
          >
            {setupMessage}
          </p>
          {setupMessage !== "Checking phone notification support…" &&
            !setupMessage.startsWith("Open the portal in a browser") && (
              <button
                type="button"
                className={`mt-3 ${buttonClass}`}
                onClick={() => {
                  setSetupMessage("Checking phone notification support…");
                  setReload((value) => value + 1);
                }}
              >
                Try again
              </button>
            )}
        </>
      )}
      {status && (
        <p role="status" className="mt-3 text-sm text-slate-200">
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-200">
          {error}
        </p>
      )}
    </div>
  );
}
