"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BellRing,
  ChevronRight,
  CircleCheck,
  Clock3,
  Fingerprint,
  History,
  KeyRound,
  Laptop2,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserCog,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const ADMIN_ME_API =
  "/api/admin/me";

const TRUSTED_DEVICES_API =
  "/api/admin/settings/security/trusted-devices";

const SESSION_STATUS_API =
  "/api/admin/settings/security/session/status";

/*
 * Security Centre destination routes.
 *
 * Keep the Security Centre as the single entry point and allow each
 * security feature to have its own focused page.
 */
const SECURITY_ROUTES = {
  twoFactor:
    "/Admin/Dashboard/Settings/SecurityCentre/TwoFactor/Authenticator",

  trustedDevices:
    "/Admin/Dashboard/Settings/SecurityCentre/TrustedDevices",

  sessions:
    "/Admin/Dashboard/Settings/SecurityCentre/Sessions",

  loginHistory:
    "/Admin/Dashboard/Settings/SecurityCentre/LoginHistory",

  notifications:
    "/Admin/Dashboard/Settings/SecurityCentre/Notifications",

  sessionTest:
    "/Admin/Dashboard/Settings/SecurityCentre/SessionTest",

  adminAccess:
    "/Admin/Dashboard/Settings/Users",

  auditLog:
    "/Admin/Dashboard/AuditLog",
} as const;

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
    permissions?: string[];
  } | null;

  user?: {
    id?: string;
    email?: string | null;
    full_name?: string | null;
    name?: string | null;
    role?: string | null;
    is_main_admin?: boolean;
    permissions?: string[];
  } | null;

  security?: {
    aal?: string | null;
    mfa_verified?: boolean;
    trusted_devices_used?: number;
    trusted_devices_max?: number;
  } | null;
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
  maxDevices?: number;
  activeCount?: number;
  slotsRemaining?: number;
  atLimit?: boolean;
  currentApproximateLocation?: string | null;
  locationAvailable?: boolean;
  devices?: TrustedDevice[];
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

type SecuritySnapshot = {
  admin: AdminMeResponse | null;
  devices: TrustedDevicesResponse | null;
  session: SessionStatusResponse | null;
};

function formatDate(
  value?: string | null,
): string {
  if (!value) {
    return "Not available";
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(parsed);
}

function getAdminRecord(
  response: AdminMeResponse | null,
) {
  return (
    response?.admin ??
    response?.user ??
    null
  );
}

function hasPermission(
  admin: ReturnType<
    typeof getAdminRecord
  >,
  permission: string,
) {
  const permissions =
    Array.isArray(
      admin?.permissions,
    )
      ? admin.permissions
      : [];

  return (
    admin?.is_main_admin === true ||
    permissions.includes(
      permission,
    )
  );
}

function SecurityStatusPill({
  good,
  label,
}: {
  good: boolean;
  label: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold",
        good
          ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
          : "border-amber-300/20 bg-amber-500/10 text-amber-100",
      ].join(" ")}
    >
      {good ? (
        <CircleCheck className="h-3.5 w-3.5" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5" />
      )}
      {label}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  good = true,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: typeof ShieldCheck;
  good?: boolean;
}) {
  return (
    <div
      className="
        rounded-3xl
        border
        border-white/10
        bg-white/[0.06]
        p-5
        shadow-xl
        shadow-black/10
        backdrop-blur-xl
      "
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className="
              text-xs
              font-bold
              uppercase
              tracking-[0.16em]
              text-white/45
            "
          >
            {title}
          </p>

          <p className="mt-2 text-2xl font-black text-white">
            {value}
          </p>

          <p className="mt-2 text-sm leading-5 text-white/55">
            {subtitle}
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
    </div>
  );
}

function SecuritySettingCard({
  href,
  title,
  description,
  icon: Icon,
  badge,
  disabled = false,
}: {
  href: string;
  title: string;
  description: string;
  icon: typeof ShieldCheck;
  badge?: string;
  disabled?: boolean;
}) {
  const content = (
    <>
      <div
        className="
          flex
          h-11
          w-11
          shrink-0
          items-center
          justify-center
          rounded-2xl
          border
          border-purple-300/15
          bg-purple-500/10
          text-purple-200
        "
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-black text-white">
            {title}
          </h3>

          {badge ? (
            <span
              className="
                rounded-full
                border
                border-white/10
                bg-white/[0.06]
                px-2
                py-0.5
                text-[11px]
                font-bold
                text-white/55
              "
            >
              {badge}
            </span>
          ) : null}
        </div>

        <p className="mt-1 text-sm leading-5 text-white/55">
          {description}
        </p>
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 text-white/35" />
    </>
  );

  if (disabled) {
    return (
      <div
        className="
          flex
          items-start
          gap-4
          rounded-3xl
          border
          border-white/10
          bg-white/[0.035]
          p-5
          opacity-60
        "
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="
        group
        flex
        items-start
        gap-4
        rounded-3xl
        border
        border-white/10
        bg-white/[0.05]
        p-5
        transition
        hover:-translate-y-0.5
        hover:border-purple-300/25
        hover:bg-white/[0.08]
      "
    >
      {content}
    </Link>
  );
}

export default function SecurityCentreClient() {
  const [
    snapshot,
    setSnapshot,
  ] =
    useState<SecuritySnapshot>({
      admin: null,
      devices: null,
      session: null,
    });

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const loadSecurity =
    useCallback(
      async (
        isRefresh = false,
      ) => {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        try {
          const [
            adminResponse,
            devicesResponse,
            sessionResponse,
          ] =
            await Promise.all([
              fetch(
                ADMIN_ME_API,
                {
                  method: "GET",
                  cache: "no-store",
                  credentials:
                    "include",
                  headers: {
                    Accept:
                      "application/json",
                  },
                },
              ),

              fetch(
                TRUSTED_DEVICES_API,
                {
                  method: "GET",
                  cache: "no-store",
                  credentials:
                    "include",
                  headers: {
                    Accept:
                      "application/json",
                  },
                },
              ),

              fetch(
                SESSION_STATUS_API,
                {
                  method: "GET",
                  cache: "no-store",
                  credentials:
                    "include",
                  headers: {
                    Accept:
                      "application/json",
                  },
                },
              ),
            ]);

          const [
            adminData,
            devicesData,
            sessionData,
          ] =
            await Promise.all([
              adminResponse
                .json()
                .catch(
                  () => ({}),
                ),

              devicesResponse
                .json()
                .catch(
                  () => ({}),
                ),

              sessionResponse
                .json()
                .catch(
                  () => ({}),
                ),
            ]);

          if (
            !adminResponse.ok
          ) {
            throw new Error(
              typeof adminData
                ?.error ===
                "string"
                ? adminData.error
                : "Unable to verify the current administrator.",
            );
          }

          setSnapshot({
            admin:
              adminData as AdminMeResponse,

            devices:
              devicesResponse.ok
                ? (devicesData as TrustedDevicesResponse)
                : null,

            session:
              sessionResponse.ok
                ? (sessionData as SessionStatusResponse)
                : null,
          });
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The Security Centre could not be loaded.",
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadSecurity();
  }, [loadSecurity]);

  const admin =
    useMemo(
      () =>
        getAdminRecord(
          snapshot.admin,
        ),
      [snapshot.admin],
    );

  const activeDevices =
    snapshot.devices
      ?.activeCount ??
    snapshot.devices
      ?.devices
      ?.filter(
        (device) =>
          device.active !== false,
      )
      .length ??
    0;

  const maxDevices =
    snapshot.devices
      ?.maxDevices ??
    snapshot.admin
      ?.security
      ?.trusted_devices_max ??
    3;

  const mfaVerified =
    snapshot.admin
      ?.security
      ?.mfa_verified ===
      true ||
    snapshot.session?.aal ===
      "aal2";

  const requiresReauth =
    snapshot.session
      ?.requires_reauthentication ===
    true;

  const canViewSecurityLogs =
    hasPermission(
      admin,
      "security:view_login_history",
    ) ||
    hasPermission(
      admin,
      "event_audit:view_security",
    );

  const canManageDevices =
    hasPermission(
      admin,
      "security:manage_devices",
    );

  const canManageMfa =
    hasPermission(
      admin,
      "security:manage_mfa",
    );

  const canManageAdmins =
    hasPermission(
      admin,
      "security:manage_admins",
    );

  const isDevelopment =
    process.env.NODE_ENV !==
    "production";

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-200" />
          <p className="mt-3 text-sm font-bold text-white/60">
            Loading Security Centre...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="w-full max-w-none">
        <section
          className="
            overflow-hidden
            rounded-[32px]
            border
            border-white/10
            bg-gradient-to-br
            from-purple-500/10
            via-black/20
            to-pink-500/10
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
                  <Shield className="h-4 w-4" />
                  Admin Security
                </span>

                <SecurityStatusPill
                  good={
                    mfaVerified &&
                    !requiresReauth
                  }
                  label={
                    requiresReauth
                      ? "Verification required"
                      : mfaVerified
                        ? "Protected"
                        : "MFA status unavailable"
                  }
                />
              </div>

              <h1
                className="
                  mt-5
                  text-3xl
                  font-black
                  tracking-tight
                  sm:text-4xl
                "
              >
                Security Centre
              </h1>

              <p
                className="
                  mt-3
                  max-w-3xl
                  text-sm
                  leading-6
                  text-white/60
                  sm:text-base
                "
              >
                View and manage your Burton Pride Admin Portal
                security settings, two-step verification,
                trusted devices, active sessions and recent
                security activity from one place.
              </p>

              <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/50">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                  {admin?.email ??
                    "Admin account"}
                </span>

                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                  Role:{" "}
                  {admin?.role ??
                    "Unknown"}
                </span>

                {admin?.is_main_admin ? (
                  <span className="rounded-full border border-pink-300/20 bg-pink-500/10 px-3 py-1.5 text-pink-100">
                    Main Admin
                  </span>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadSecurity(
                  true,
                )
              }
              disabled={
                refreshing
              }
              className="
                inline-flex
                h-11
                shrink-0
                items-center
                justify-center
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
              Refresh security
            </button>
          </div>
        </section>

        {error ? (
          <div
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
            role="alert"
          >
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">
                Security Centre could not fully load
              </p>
              <p className="mt-1 text-red-50/70">
                {error}
              </p>
            </div>
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Two-step verification"
            value={
              mfaVerified
                ? "Verified"
                : "Check required"
            }
            subtitle={
              snapshot.session
                ?.aal
                ? `Current assurance level: ${snapshot.session.aal.toUpperCase()}`
                : "Strong MFA is required for Admin Portal access."
            }
            icon={
              Fingerprint
            }
            good={
              mfaVerified
            }
          />

          <SummaryCard
            title="Trusted devices"
            value={`${activeDevices} / ${maxDevices}`}
            subtitle="A maximum of three active trusted devices is allowed per administrator."
            icon={
              Laptop2
            }
            good={
              activeDevices <=
              maxDevices
            }
          />

          <SummaryCard
            title="Session status"
            value={
              requiresReauth
                ? "Action needed"
                : "Active"
            }
            subtitle={
              snapshot.session
                ?.expires_at
                ? `Expires ${formatDate(
                    snapshot
                      .session
                      .expires_at,
                  )}`
                : "Current server-side security session."
            }
            icon={
              LockKeyhole
            }
            good={
              !requiresReauth
            }
          />

          <SummaryCard
            title="Next presence check"
            value={
              snapshot.session
                ?.next_presence_check_at
                ? formatDate(
                    snapshot
                      .session
                      .next_presence_check_at,
                  )
                : "Not available"
            }
            subtitle="The Admin Portal can ask you to confirm you are still present after the security interval."
            icon={
              Clock3
            }
            good={
              !requiresReauth
            }
          />
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
                Security settings
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Account & access
              </h2>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <SecuritySettingCard
              href={
                SECURITY_ROUTES
                  .twoFactor
              }
              title="Two-step verification"
              description="Manage authenticator-app and approved fallback MFA methods."
              icon={
                Fingerprint
              }
              badge={
                mfaVerified
                  ? "AAL2 active"
                  : "Review"
              }
              disabled={
                !canManageMfa &&
                !admin
                  ?.is_main_admin
              }
            />

            <SecuritySettingCard
              href={
                SECURITY_ROUTES
                  .trustedDevices
              }
              title="Trusted devices"
              description={`Review device names, browsers, operating systems, approximate locations and revoke access. ${activeDevices} of ${maxDevices} slots are in use.`}
              icon={
                Smartphone
              }
              badge={`${activeDevices}/${maxDevices}`}
              disabled={
                !canManageDevices &&
                !admin
                  ?.is_main_admin
              }
            />

            <SecuritySettingCard
              href={
                SECURITY_ROUTES
                  .sessions
              }
              title="Active sessions"
              description="See current session activity, device binding and session expiry, with revocation controls."
              icon={
                KeyRound
              }
              badge={
                requiresReauth
                  ? "Reverify"
                  : "Active"
              }
            />

            <SecuritySettingCard
              href={
                SECURITY_ROUTES
                  .loginHistory
              }
              title="Recent sign-ins"
              description="View successful and failed sign-ins, device details, approximate location, MFA method and risk level."
              icon={
                History
              }
              badge={
                canViewSecurityLogs
                  ? "Security log"
                  : "Restricted"
              }
              disabled={
                !canViewSecurityLogs
              }
            />

            <SecuritySettingCard
              href={
                SECURITY_ROUTES
                  .notifications
              }
              title="Security notifications"
              description="Review security alerts for new devices, credential changes, account changes and suspicious sign-ins."
              icon={
                BellRing
              }
            />

            <SecuritySettingCard
              href={
                SECURITY_ROUTES
                  .adminAccess
              }
              title="Administrator access"
              description="Manage administrator roles and security permissions. Restricted to authorised Main Admins."
              icon={
                UserCog
              }
              badge="High risk"
              disabled={
                !canManageAdmins
              }
            />
          </div>
        </section>

        <section className="mt-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
              Monitoring & testing
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Security activity
            </h2>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <SecuritySettingCard
              href={
                SECURITY_ROUTES
                  .auditLog
              }
              title="Security audit log"
              description="Review security events, authentication decisions and high-risk administrative actions."
              icon={
                Activity
              }
              badge={
                canViewSecurityLogs
                  ? "Available"
                  : "Restricted"
              }
              disabled={
                !canViewSecurityLogs
              }
            />

            <SecuritySettingCard
              href={
                SECURITY_ROUTES
                  .sessionTest
              }
              title="Six-hour presence test"
              description="Development-only safe test of the 60-second ‘Are you still here?’ security popup."
              icon={
                Clock3
              }
              badge={
                isDevelopment
                  ? "Development"
                  : "Disabled"
              }
              disabled={
                !isDevelopment
              }
            />

            <div
              className="
                rounded-3xl
                border
                border-white/10
                bg-white/[0.035]
                p-5
              "
            >
              <div className="flex items-start gap-4">
                <div
                  className="
                    flex
                    h-11
                    w-11
                    shrink-0
                    items-center
                    justify-center
                    rounded-2xl
                    border
                    border-emerald-300/15
                    bg-emerald-500/10
                    text-emerald-200
                  "
                >
                  <ShieldCheck className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="font-black">
                    Current protection
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-white/55">
                    Last strong authentication:{" "}
                    {formatDate(
                      snapshot
                        .session
                        ?.last_mfa_at,
                    )}
                  </p>

                  <p className="mt-2 text-sm leading-5 text-white/55">
                    Last presence confirmation:{" "}
                    {formatDate(
                      snapshot
                        .session
                        ?.last_presence_at,
                    )}
                  </p>
                </div>
              </div>
            </div>
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
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-200" />

            <div>
              <h2 className="font-black text-blue-50">
                Security and privacy
              </h2>

              <p className="mt-2 max-w-5xl text-sm leading-6 text-blue-50/65">
                Approximate location is a security signal only and may
                be inaccurate because of mobile networks, VPNs or ISP
                routing. Security pages must never display raw session
                tokens, passwords, OTP codes, TOTP secrets or service
                credentials.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
