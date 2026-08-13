"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Fingerprint,
  KeyRound,
  Laptop2,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  TimerReset,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const ADMIN_ME_API = "/api/admin/me";
const SESSION_STATUS_API =
  "/api/admin/settings/security/session/status";
const TRUSTED_DEVICES_API =
  "/api/admin/settings/security/trusted-devices";

const SECURITY_CENTRE_ROUTE =
  "/Admin/Dashboard/Settings/SecurityCentre";
const TRUSTED_DEVICES_ROUTE =
  "/Admin/Dashboard/Settings/SecurityCentre/TrustedDevices";
const TWO_FACTOR_ROUTE =
  "/Admin/Dashboard/Settings/SecurityCentre/TwoFactor";

type AdminMeResponse = {
  authenticated?: boolean;
  authorized?: boolean;
  admin?: {
    id?: string;
    email?: string | null;
    full_name?: string | null;
    name?: string | null;
    role?: string | null;
    is_main_admin?: boolean;
  } | null;
  user?: {
    id?: string;
    email?: string | null;
    full_name?: string | null;
    name?: string | null;
    role?: string | null;
    is_main_admin?: boolean;
  } | null;
  security?: {
    aal?: string | null;
    mfa_verified?: boolean;
  } | null;
};

type SessionStatusResponse = {
  ok?: boolean;
  authenticated?: boolean;
  requires_reauthentication?: boolean;
  last_mfa_at?: string | null;
  last_presence_at?: string | null;
  next_presence_check_at?: string | null;
  expires_at?: string | null;
  aal?: string | null;
  reason?: string | null;
};

type TrustedDevice = {
  id: string;
  name?: string | null;
  browser?: string | null;
  operatingSystem?: string | null;
  deviceType?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  trustedAt?: string | null;
  approximateLocation?: string | null;
  active?: boolean;
  currentDevice?: boolean;
};

type TrustedDevicesResponse = {
  ok?: boolean;
  activeCount?: number;
  maxDevices?: number;
  currentApproximateLocation?: string | null;
  devices?: TrustedDevice[];
};

type SessionsSnapshot = {
  admin: AdminMeResponse | null;
  session: SessionStatusResponse | null;
  devices: TrustedDevicesResponse | null;
};

function formatDate(value?: string | null): string {
  if (!value) return "Not available";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function getAdmin(
  response: AdminMeResponse | null,
) {
  return response?.admin ?? response?.user ?? null;
}

function getDeviceLabel(device: TrustedDevice) {
  const name = device.name?.trim();

  if (name) return name;

  const parts = [
    device.browser,
    device.operatingSystem,
  ].filter(Boolean);

  return parts.length > 0
    ? parts.join(" on ")
    : "Trusted device";
}

function StatusBadge({
  good,
  children,
}: {
  good: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black",
        good
          ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
          : "border-amber-300/20 bg-amber-500/10 text-amber-100",
      ].join(" ")}
    >
      {good ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5" />
      )}
      {children}
    </span>
  );
}

function DetailCard({
  title,
  value,
  description,
  icon: Icon,
  good = true,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof ShieldCheck;
  good?: boolean;
}) {
  return (
    <article
      className="
        rounded-3xl
        border
        border-white/10
        bg-white/[0.055]
        p-5
        shadow-xl
        shadow-black/10
        backdrop-blur-xl
      "
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-white/40">
            {title}
          </p>

          <p className="mt-2 break-words text-xl font-black text-white">
            {value}
          </p>

          <p className="mt-2 text-sm leading-6 text-white/55">
            {description}
          </p>
        </div>

        <div
          className={[
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
            good
              ? "border-emerald-300/15 bg-emerald-500/10 text-emerald-200"
              : "border-amber-300/15 bg-amber-500/10 text-amber-200",
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

export default function SessionsClient() {
  const [snapshot, setSnapshot] =
    useState<SessionsSnapshot>({
      admin: null,
      session: null,
      devices: null,
    });

  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] =
    useState("");

  const loadSessions = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const [
          adminResponse,
          sessionResponse,
          devicesResponse,
        ] = await Promise.all([
          fetch(ADMIN_ME_API, {
            method: "GET",
            cache: "no-store",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }),
          fetch(SESSION_STATUS_API, {
            method: "GET",
            cache: "no-store",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }),
          fetch(TRUSTED_DEVICES_API, {
            method: "GET",
            cache: "no-store",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }),
        ]);

        const [
          adminData,
          sessionData,
          devicesData,
        ] = await Promise.all([
          adminResponse.json().catch(() => ({})),
          sessionResponse.json().catch(() => ({})),
          devicesResponse.json().catch(() => ({})),
        ]);

        if (!adminResponse.ok) {
          throw new Error(
            typeof adminData?.error === "string"
              ? adminData.error
              : "Unable to verify the current administrator.",
          );
        }

        if (!sessionResponse.ok) {
          throw new Error(
            typeof sessionData?.error === "string"
              ? sessionData.error
              : "Unable to load the current security session.",
          );
        }

        setSnapshot({
          admin: adminData as AdminMeResponse,
          session:
            sessionData as SessionStatusResponse,
          devices: devicesResponse.ok
            ? (devicesData as TrustedDevicesResponse)
            : null,
        });
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load session security information.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const admin = useMemo(
    () => getAdmin(snapshot.admin),
    [snapshot.admin],
  );

  const session = snapshot.session;

  const mfaVerified =
    snapshot.admin?.security?.mfa_verified ===
      true ||
    snapshot.admin?.security?.aal === "aal2" ||
    session?.aal === "aal2";

  const requiresReauthentication =
    session?.requires_reauthentication === true;

  const currentDevice =
    snapshot.devices?.devices?.find(
      (device) =>
        device.currentDevice === true &&
        device.active !== false,
    ) ?? null;

  const activeDeviceCount =
    snapshot.devices?.activeCount ??
    snapshot.devices?.devices?.filter(
      (device) => device.active !== false,
    ).length ??
    0;

  const maxDevices =
    snapshot.devices?.maxDevices ?? 3;

  if (loading) {
    return (
      <div className="flex min-h-[70vh] w-full items-center justify-center px-4 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-200" />
          <p className="mt-3 text-sm font-black text-white/60">
            Loading active session...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen w-full px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="w-full max-w-none">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={SECURITY_CENTRE_ROUTE}
            className="
              inline-flex
              h-11
              items-center
              gap-2
              rounded-2xl
              border
              border-white/10
              bg-white/[0.06]
              px-4
              text-sm
              font-black
              text-white
              transition
              hover:bg-white/10
            "
          >
            <ArrowLeft className="h-4 w-4" />
            Security Centre
          </Link>

          <button
            type="button"
            onClick={() =>
              void loadSessions(true)
            }
            disabled={refreshing}
            className="
              inline-flex
              h-11
              items-center
              gap-2
              rounded-2xl
              border
              border-white/10
              bg-white/10
              px-4
              text-sm
              font-black
              transition
              hover:bg-white/15
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            <RefreshCw
              className={[
                "h-4 w-4",
                refreshing
                  ? "animate-spin"
                  : "",
              ].join(" ")}
            />
            Refresh session
          </button>
        </div>

        <section
          className="
            overflow-hidden
            rounded-[32px]
            border
            border-white/10
            bg-gradient-to-br
            from-purple-500/10
            via-black/20
            to-blue-500/10
            p-6
            shadow-2xl
            shadow-black/20
            backdrop-blur-xl
            sm:p-8
          "
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-full
                    border
                    border-purple-300/20
                    bg-purple-500/10
                    px-3
                    py-1
                    text-xs
                    font-black
                    uppercase
                    tracking-[0.16em]
                    text-purple-100
                  "
                >
                  <KeyRound className="h-4 w-4" />
                  Session security
                </span>

                <StatusBadge
                  good={
                    !requiresReauthentication &&
                    session?.authenticated !== false
                  }
                >
                  {requiresReauthentication
                    ? "Verification required"
                    : session?.authenticated === false
                      ? "Not authenticated"
                      : "Session active"}
                </StatusBadge>
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
                Active Sessions
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60 sm:text-base">
                Review the security state of your current Burton Pride
                Admin Portal session, strong authentication, presence
                checks and the trusted device linked to this sign-in.
              </p>

              <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/50">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                  {admin?.email ?? "Admin account"}
                </span>

                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                  Role: {admin?.role ?? "Unknown"}
                </span>

                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                  Assurance:{" "}
                  {session?.aal?.toUpperCase() ??
                    snapshot.admin?.security?.aal?.toUpperCase() ??
                    "Unknown"}
                </span>
              </div>
            </div>

            <div
              className={[
                "flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border",
                requiresReauthentication
                  ? "border-amber-300/20 bg-amber-500/10 text-amber-200"
                  : "border-emerald-300/20 bg-emerald-500/10 text-emerald-200",
              ].join(" ")}
            >
              {requiresReauthentication ? (
                <ShieldAlert className="h-8 w-8" />
              ) : (
                <ShieldCheck className="h-8 w-8" />
              )}
            </div>
          </div>
        </section>

        {error ? (
          <div
            role="alert"
            className="
              mt-6
              flex
              items-start
              gap-3
              rounded-3xl
              border
              border-red-300/20
              bg-red-500/10
              p-5
              text-sm
              text-red-50
            "
          >
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">
                Session information could not fully load
              </p>
              <p className="mt-1 text-red-50/70">
                {error}
              </p>
            </div>
          </div>
        ) : null}

        {requiresReauthentication ? (
          <section
            className="
              mt-6
              flex
              flex-col
              gap-4
              rounded-3xl
              border
              border-amber-300/20
              bg-amber-500/10
              p-5
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
              <div>
                <h2 className="font-black text-amber-50">
                  Strong verification is required
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-amber-50/70">
                  Your security session says that reauthentication is
                  required. Complete your normal two-step verification
                  flow before continuing with protected admin actions.
                </p>
              </div>
            </div>

            <Link
              href={TWO_FACTOR_ROUTE}
              className="
                inline-flex
                h-11
                shrink-0
                items-center
                justify-center
                gap-2
                rounded-2xl
                border
                border-amber-200/20
                bg-amber-100/10
                px-4
                text-sm
                font-black
                text-amber-50
                transition
                hover:bg-amber-100/15
              "
            >
              <Fingerprint className="h-4 w-4" />
              Verification settings
            </Link>
          </section>
        ) : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DetailCard
            title="Session state"
            value={
              session?.authenticated === false
                ? "Not authenticated"
                : requiresReauthentication
                  ? "Reverify"
                  : "Active"
            }
            description={
              session?.reason
                ? `Security status: ${session.reason}`
                : "Current server-side Admin Portal security session."
            }
            icon={LockKeyhole}
            good={
              session?.authenticated !== false &&
              !requiresReauthentication
            }
          />

          <DetailCard
            title="Two-step verification"
            value={
              mfaVerified
                ? "AAL2 verified"
                : "Check required"
            }
            description="AAL2 means strong multi-factor authentication has been verified for the session."
            icon={Fingerprint}
            good={mfaVerified}
          />

          <DetailCard
            title="Session expiry"
            value={formatDate(
              session?.expires_at,
            )}
            description="When available, this is the server-side expiry time for the current security session."
            icon={Clock3}
            good={
              session?.authenticated !== false
            }
          />

          <DetailCard
            title="Trusted devices"
            value={`${activeDeviceCount} / ${maxDevices}`}
            description="Active trusted devices registered to this administrator account."
            icon={Laptop2}
            good={
              activeDeviceCount <= maxDevices
            }
          />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div
            className="
              rounded-[32px]
              border
              border-white/10
              bg-white/[0.045]
              p-6
              shadow-xl
              shadow-black/10
              backdrop-blur-xl
            "
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-purple-300/15 bg-purple-500/10 text-purple-200">
                <TimerReset className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
                  Presence protection
                </p>
                <h2 className="mt-1 text-xl font-black">
                  Security timing
                </h2>
              </div>
            </div>

            <dl className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <dt className="text-xs font-black uppercase tracking-[0.12em] text-white/40">
                  Last strong authentication
                </dt>
                <dd className="mt-1 font-bold text-white/80">
                  {formatDate(
                    session?.last_mfa_at,
                  )}
                </dd>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <dt className="text-xs font-black uppercase tracking-[0.12em] text-white/40">
                  Last presence confirmation
                </dt>
                <dd className="mt-1 font-bold text-white/80">
                  {formatDate(
                    session?.last_presence_at,
                  )}
                </dd>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <dt className="text-xs font-black uppercase tracking-[0.12em] text-white/40">
                  Next presence check
                </dt>
                <dd className="mt-1 font-bold text-white/80">
                  {formatDate(
                    session?.next_presence_check_at,
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div
            className="
              rounded-[32px]
              border
              border-white/10
              bg-white/[0.045]
              p-6
              shadow-xl
              shadow-black/10
              backdrop-blur-xl
            "
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-300/15 bg-blue-500/10 text-blue-200">
                <Smartphone className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
                  Current device
                </p>
                <h2 className="mt-1 text-xl font-black">
                  Trusted device information
                </h2>
              </div>
            </div>

            {currentDevice ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                  <p className="font-black text-white">
                    {getDeviceLabel(
                      currentDevice,
                    )}
                  </p>

                  <div className="mt-3 grid gap-3 text-sm text-white/60 sm:grid-cols-2">
                    <div>
                      <span className="block text-xs font-black uppercase tracking-[0.1em] text-white/35">
                        Browser
                      </span>
                      <span>
                        {currentDevice.browser ??
                          "Not available"}
                      </span>
                    </div>

                    <div>
                      <span className="block text-xs font-black uppercase tracking-[0.1em] text-white/35">
                        Operating system
                      </span>
                      <span>
                        {currentDevice.operatingSystem ??
                          "Not available"}
                      </span>
                    </div>

                    <div>
                      <span className="block text-xs font-black uppercase tracking-[0.1em] text-white/35">
                        Approximate location
                      </span>
                      <span>
                        {currentDevice.approximateLocation ??
                          snapshot.devices
                            ?.currentApproximateLocation ??
                          "Not available"}
                      </span>
                    </div>

                    <div>
                      <span className="block text-xs font-black uppercase tracking-[0.1em] text-white/35">
                        Last seen
                      </span>
                      <span>
                        {formatDate(
                          currentDevice.lastSeenAt,
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  href={TRUSTED_DEVICES_ROUTE}
                  className="
                    inline-flex
                    h-11
                    items-center
                    justify-center
                    gap-2
                    rounded-2xl
                    border
                    border-white/10
                    bg-white/[0.07]
                    px-4
                    text-sm
                    font-black
                    transition
                    hover:bg-white/10
                  "
                >
                  <Laptop2 className="h-4 w-4" />
                  Manage trusted devices
                </Link>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/15 p-5">
                <p className="font-black text-white/80">
                  Current trusted device not identified
                </p>
                <p className="mt-2 text-sm leading-6 text-white/50">
                  The session can still be valid even if the trusted
                  devices endpoint does not mark a device as the current
                  device.
                </p>

                <Link
                  href={TRUSTED_DEVICES_ROUTE}
                  className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] px-4 text-sm font-black transition hover:bg-white/10"
                >
                  <Laptop2 className="h-4 w-4" />
                  View trusted devices
                </Link>
              </div>
            )}
          </div>
        </section>

        <section
          className="
            mt-8
            rounded-3xl
            border
            border-blue-300/10
            bg-blue-500/[0.06]
            p-5
          "
        >
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-blue-200" />

            <div>
              <h2 className="font-black text-blue-50">
                Session privacy
              </h2>

              <p className="mt-2 max-w-5xl text-sm leading-6 text-blue-50/65">
                This page intentionally displays only safe session
                metadata. Never render access tokens, refresh tokens,
                session cookies, OTP codes, authenticator secrets,
                passwords or service-role credentials in the browser.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
