"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Globe2,
  Laptop,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type TrustedDevice = {
  id: string;
  name: string;
  browser: string | null;
  operatingSystem: string | null;
  deviceType: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  trustedAt: string;
  approximateLocation: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  active: boolean;
  currentDevice: boolean;
};

type DevicesResponse = {
  ok: true;
  maxDevices: number;
  activeCount: number;
  slotsRemaining: number;
  atLimit: boolean;
  devices: TrustedDevice[];
};

type ErrorResponse = {
  ok?: false;
  error?: string;
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function deviceIcon(type: string | null) {
  if (type === "mobile") return Smartphone;
  if (type === "tablet") return MonitorSmartphone;
  return Laptop;
}

export default function TrustedDevicesClient() {
  const [data, setData] = useState<DevicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/settings/security/trusted-devices",
        {
          cache: "no-store",
          credentials: "include",
        },
      );

      const json = (await response.json().catch(() => null)) as
        | DevicesResponse
        | ErrorResponse
        | null;

      if (!response.ok || !json || json.ok !== true) {
        throw new Error(
          (json as ErrorResponse | null)?.error ||
            "Unable to load trusted devices.",
        );
      }

      setData(json);
    } catch (err) {
      setData(null);
      setError(
        err instanceof Error ? err.message : "Unable to load trusted devices.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const activeDevices = useMemo(
    () => data?.devices.filter((device) => device.active) || [],
    [data],
  );

  const revokedDevices = useMemo(
    () => data?.devices.filter((device) => !device.active) || [],
    [data],
  );

  async function revokeDevice(device: TrustedDevice) {
    const message = device.currentDevice
      ? "Revoke this current trusted device? You may need to complete two-step verification again on this device."
      : `Revoke ${device.name}? It will need two-step verification before it can become trusted again.`;

    if (!window.confirm(message)) return;

    try {
      setRevokingId(device.id);
      setError("");

      const response = await fetch(
        "/api/admin/settings/security/trusted-devices",
        {
          method: "DELETE",
          cache: "no-store",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deviceId: device.id,
            reason: "Revoked from Trusted Devices security page",
          }),
        },
      );

      const json = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Unable to revoke trusted device.");
      }

      await loadDevices();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to revoke trusted device.",
      );
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <main className="min-h-screen w-full max-w-none text-white">
      <div className="mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl backdrop-blur-xl">
        <div className="relative p-6 lg:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(236,72,153,0.2),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(59,130,246,0.18),transparent_32%)]" />

          <div className="relative">
            <Link
              href="/Admin/Settings"
              className="inline-flex items-center gap-2 text-sm font-black text-white/60 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to settings
            </Link>

            <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-500/15 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-purple-50">
                  <ShieldCheck className="h-4 w-4" />
                  Admin Security Centre
                </div>

                <h1 className="mt-4 text-3xl font-black lg:text-4xl">
                  Trusted Devices
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
                  Each Burton Pride administrator can have a maximum of three
                  active trusted devices. New devices must pass two-step
                  verification before they are trusted.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/Admin/AuditLogs"
                  className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Audit logs
                </Link>

                <button
                  type="button"
                  onClick={() => void loadDevices()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-purple-700 transition hover:bg-white/90 disabled:opacity-60"
                >
                  <RefreshCw
                    className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                  />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="rounded-3xl border border-white/10 bg-white/10 p-8 text-center backdrop-blur-xl">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-3 font-black">Loading trusted devices...</p>
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-3xl border border-red-300/25 bg-red-500/10 p-5 text-red-50">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">Security page error</p>
              <p className="mt-1 text-sm leading-6 text-red-50/85">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      {data ? (
        <>
          <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">
                Trusted devices
              </p>
              <p className="mt-3 text-4xl font-black">
                {data.activeCount}/{data.maxDevices}
              </p>
              <p className="mt-2 text-sm text-white/55">
                Active trusted devices on your account.
              </p>
            </div>

            <div
              className={[
                "rounded-3xl border p-5 backdrop-blur-xl",
                data.atLimit
                  ? "border-amber-300/25 bg-amber-500/10"
                  : "border-emerald-300/20 bg-emerald-500/10",
              ].join(" ")}
            >
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">
                Device slots
              </p>
              <p className="mt-3 text-4xl font-black">{data.slotsRemaining}</p>
              <p className="mt-2 text-sm text-white/55">
                {data.atLimit
                  ? "Limit reached. Revoke a device before trusting another."
                  : "Trusted-device slots still available."}
              </p>
            </div>

            <div className="rounded-3xl border border-sky-300/20 bg-sky-500/10 p-5 backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">
                Security rule
              </p>
              <p className="mt-3 text-2xl font-black">2-step required</p>
              <p className="mt-2 text-sm text-white/55">
                New devices are only trusted after successful MFA.
              </p>
            </div>

            <div className="rounded-3xl border border-purple-300/20 bg-purple-500/10 p-5 backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">
                Device limit
              </p>
              <p className="mt-3 text-4xl font-black">3</p>
              <p className="mt-2 text-sm text-white/55">
                The database also enforces this maximum.
              </p>
            </div>
          </section>

          {data.atLimit ? (
            <div className="mb-6 rounded-3xl border border-amber-300/25 bg-amber-500/10 p-5 text-amber-50">
              <div className="flex gap-3">
                <ShieldX className="mt-0.5 h-6 w-6 shrink-0" />
                <div>
                  <p className="font-black">Three-device limit reached</p>
                  <p className="mt-1 text-sm leading-6 text-amber-50/85">
                    A fourth device cannot be trusted. Revoke one of the devices
                    below before signing in from another new device.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6 rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5 text-emerald-50">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" />
                <div>
                  <p className="font-black">Trusted-device capacity available</p>
                  <p className="mt-1 text-sm leading-6 text-emerald-50/85">
                    You can trust {data.slotsRemaining} more device
                    {data.slotsRemaining === 1 ? "" : "s"} after successful
                    two-step verification.
                  </p>
                </div>
              </div>
            </div>
          )}

          <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-xl lg:p-6">
            <div>
              <h2 className="text-2xl font-black">Active trusted devices</h2>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Revoke any device you no longer recognise, use or control.
              </p>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {activeDevices.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-white/60">
                  No active trusted devices are recorded yet.
                </div>
              ) : (
                activeDevices.map((device) => {
                  const Icon = deviceIcon(device.deviceType);

                  return (
                    <article
                      key={device.id}
                      className={[
                        "rounded-3xl border p-5",
                        device.currentDevice
                          ? "border-emerald-300/25 bg-emerald-500/10"
                          : "border-white/10 bg-black/20",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                            <Icon className="h-6 w-6" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-lg font-black">
                                {device.name}
                              </h3>
                              {device.currentDevice ? (
                                <span className="rounded-full border border-emerald-300/20 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-100">
                                  Current device
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-1 text-sm text-white/50">
                              {device.browser || "Unknown browser"} ·{" "}
                              {device.operatingSystem || "Unknown OS"}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => void revokeDevice(device)}
                          disabled={revokingId === device.id}
                          className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          {revokingId === device.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Revoke
                        </button>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-white/40">
                            <Globe2 className="h-4 w-4" />
                            Approximate location
                          </div>
                          <p className="mt-2 text-sm font-bold text-white/75">
                            {device.approximateLocation || "Not available"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-white/40">
                            <Clock className="h-4 w-4" />
                            Last used
                          </div>
                          <p className="mt-2 text-sm font-bold text-white/75">
                            {formatDate(device.lastSeenAt)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-xs font-black uppercase tracking-wide text-white/40">
                            First seen
                          </p>
                          <p className="mt-2 text-sm font-bold text-white/75">
                            {formatDate(device.firstSeenAt)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-xs font-black uppercase tracking-wide text-white/40">
                            Trusted since
                          </p>
                          <p className="mt-2 text-sm font-bold text-white/75">
                            {formatDate(device.trustedAt)}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          {revokedDevices.length > 0 ? (
            <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.06] p-5 lg:p-6">
              <h2 className="text-xl font-black">Previously revoked devices</h2>
              <div className="mt-4 grid gap-3">
                {revokedDevices.slice(0, 10).map((device) => (
                  <div
                    key={device.id}
                    className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-black text-white/70">{device.name}</p>
                      <p className="mt-1 text-xs text-white/40">
                        Last used {formatDate(device.lastSeenAt)}
                      </p>
                    </div>
                    <span className="text-xs font-black uppercase tracking-wide text-red-200/70">
                      Revoked
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
