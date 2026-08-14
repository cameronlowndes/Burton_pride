"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Clock3,
  Fingerprint,
  KeyRound,
  Laptop2,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const API =
  "/api/admin/settings/security/notifications";

const SECURITY_CENTRE =
  "/Admin/Dashboard/Settings/SecurityCentre";

type NotificationSettings = {
  emailEnabled: boolean;

  successfulLogin: boolean;
  failedLogin: boolean;
  failedLoginThreshold: 1 | 3 | 5;
  newDevice: boolean;
  newLocation: boolean;
  trustedDeviceAdded: boolean;
  trustedDeviceRevoked: boolean;

  mfaChanged: boolean;
  mfaFailure: boolean;
  passwordChanged: boolean;
  highRiskActivity: boolean;
  sessionSecurity: boolean;
  rateLimitOrLockout: boolean;
  adminAccessChanged: boolean;
  securitySettingsChanged: boolean;

  updatedAt?: string | null;
};

type DeliveryRecord = {
  id: string;
  eventType: string;
  recipientMasked: string;
  status: "sent" | "failed";
  errorMessage?: string | null;
  createdAt: string;
};

type NotificationHealth = {
  configured: boolean;
  senderConfigured: boolean;
  recipientConfigured: boolean;
  lastDeliveryAt?: string | null;
  lastDeliveryStatus?: "sent" | "failed" | null;
};

type ApiResponse = {
  ok?: boolean;
  settings?: NotificationSettings;
  email?: string | null;
  health?: NotificationHealth;
  deliveries?: DeliveryRecord[];
  testSent?: boolean;
  error?: string;
};

type Notice = {
  tone: "success" | "error" | "warning";
  title: string;
  message: string;
};

type NotificationOption = {
  key: keyof NotificationSettings;
  title: string;
  description: string;
  critical: boolean;
  icon: typeof BellRing;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  emailEnabled: true,

  successfulLogin: true,
  failedLogin: true,
  failedLoginThreshold: 1,
  newDevice: true,
  newLocation: true,
  trustedDeviceAdded: true,
  trustedDeviceRevoked: true,

  mfaChanged: true,
  mfaFailure: true,
  passwordChanged: true,
  highRiskActivity: true,
  sessionSecurity: true,
  rateLimitOrLockout: true,
  adminAccessChanged: true,
  securitySettingsChanged: true,
};

const CRITICAL_KEYS = new Set<
  keyof NotificationSettings
>([
  "mfaChanged",
  "passwordChanged",
  "highRiskActivity",
  "sessionSecurity",
  "rateLimitOrLockout",
  "adminAccessChanged",
  "securitySettingsChanged",
]);

const CRITICAL_OPTIONS: NotificationOption[] = [
  {
    key: "mfaChanged",
    title: "Two-factor authentication changed",
    description:
      "Always alert when MFA methods, authenticator setup or recovery settings change.",
    icon: Fingerprint,
    critical: true,
  },
  {
    key: "passwordChanged",
    title: "Password changed or reset",
    description:
      "Always alert when an administrator password is changed or reset.",
    icon: KeyRound,
    critical: true,
  },
  {
    key: "highRiskActivity",
    title: "High-risk security activity",
    description:
      "Always alert about blocked, suspicious, high-risk or critical security events.",
    icon: ShieldAlert,
    critical: true,
  },
  {
    key: "sessionSecurity",
    title: "Session security event",
    description:
      "Always alert about forced sign-outs, revoked sessions and major session-security events.",
    icon: ShieldCheck,
    critical: true,
  },
  {
    key: "rateLimitOrLockout",
    title: "Rate limit or account lock",
    description:
      "Always alert when repeated sign-in attempts trigger rate limiting, lockout or automated blocking.",
    icon: LockKeyhole,
    critical: true,
  },
  {
    key: "adminAccessChanged",
    title: "Admin access changed",
    description:
      "Always alert when administrator roles, permissions or account access are changed.",
    icon: UserCog,
    critical: true,
  },
  {
    key: "securitySettingsChanged",
    title: "Security settings changed",
    description:
      "Always alert when important Admin Portal security settings are modified.",
    icon: ShieldCheck,
    critical: true,
  },
];

const OPTIONAL_OPTIONS: NotificationOption[] = [
  {
    key: "successfulLogin",
    title: "Successful sign-in",
    description:
      "Email when this administrator account successfully signs in.",
    icon: CheckCircle2,
    critical: false,
  },
  {
    key: "failedLogin",
    title: "Failed sign-in attempt",
    description:
      "Warn when sign-in attempts fail. The threshold can be adjusted below.",
    icon: XCircle,
    critical: false,
  },
  {
    key: "mfaFailure",
    title: "Failed MFA verification",
    description:
      "Alert when a two-factor verification attempt fails.",
    icon: Fingerprint,
    critical: false,
  },
  {
    key: "newDevice",
    title: "New device detected",
    description:
      "Alert when an unfamiliar browser or device is seen during sign-in.",
    icon: Laptop2,
    critical: false,
  },
  {
    key: "newLocation",
    title: "New approximate location",
    description:
      "Alert when a sign-in is seen from a new approximate city, region or country.",
    icon: MapPin,
    critical: false,
  },
  {
    key: "trustedDeviceAdded",
    title: "Trusted device added",
    description:
      "Tell me whenever a new trusted device is registered.",
    icon: Laptop2,
    critical: false,
  },
  {
    key: "trustedDeviceRevoked",
    title: "Trusted device revoked",
    description:
      "Tell me whenever one of my trusted devices is revoked.",
    icon: LockKeyhole,
    critical: false,
  },
];

function formatDate(
  value?: string | null,
) {
  if (!value) {
    return "Not available";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
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
  ).format(date);
}

function normaliseSettings(
  value?: NotificationSettings,
): NotificationSettings {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(value || {}),
  };

  return {
    ...merged,
    failedLoginThreshold:
      merged.failedLoginThreshold === 3 ||
      merged.failedLoginThreshold === 5
        ? merged.failedLoginThreshold
        : 1,

    // Critical alerts can never be disabled by client or stale DB values.
    mfaChanged: true,
    passwordChanged: true,
    highRiskActivity: true,
    sessionSecurity: true,
    rateLimitOrLockout: true,
    adminAccessChanged: true,
    securitySettingsChanged: true,
  };
}

export default function SecurityNotificationsPage() {
  const [settings, setSettings] =
    useState<NotificationSettings>(
      DEFAULT_SETTINGS,
    );

  const [
    savedSettings,
    setSavedSettings,
  ] =
    useState<NotificationSettings>(
      DEFAULT_SETTINGS,
    );

  const [adminEmail, setAdminEmail] =
    useState("");

  const [health, setHealth] =
    useState<NotificationHealth | null>(
      null,
    );

  const [deliveries, setDeliveries] =
    useState<DeliveryRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [sendingTest, setSendingTest] =
    useState(false);

  const [notice, setNotice] =
    useState<Notice | null>(null);

  const loadAbortRef =
    useRef<AbortController | null>(
      null,
    );

  const dirty =
    useMemo(
      () =>
        JSON.stringify(settings) !==
        JSON.stringify(savedSettings),
      [settings, savedSettings],
    );

  const optionalEnabledCount =
    useMemo(
      () =>
        OPTIONAL_OPTIONS.filter(
          (option) =>
            Boolean(
              settings[
                option.key
              ],
            ),
        ).length,
      [settings],
    );

  const loadSettings =
    useCallback(
      async (
        refresh = false,
      ) => {
        loadAbortRef.current
          ?.abort();

        const controller =
          new AbortController();

        loadAbortRef.current =
          controller;

        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setNotice(null);

        try {
          const response =
            await fetch(
              API,
              {
                method: "GET",
                credentials:
                  "include",
                cache:
                  "no-store",
                signal:
                  controller.signal,
                headers: {
                  Accept:
                    "application/json",
                },
              },
            );

          const data =
            (await response
              .json()
              .catch(
                () => null,
              )) as
              | ApiResponse
              | null;

          if (
            !response.ok ||
            !data?.ok
          ) {
            throw new Error(
              data?.error ||
                "Security notification settings could not be loaded.",
            );
          }

          const nextSettings =
            normaliseSettings(
              data.settings,
            );

          setSettings(
            nextSettings,
          );

          setSavedSettings(
            nextSettings,
          );

          setAdminEmail(
            data.email || "",
          );

          setHealth(
            data.health || null,
          );

          setDeliveries(
            Array.isArray(
              data.deliveries,
            )
              ? data.deliveries
              : [],
          );
        } catch (error) {
          if (
            error instanceof
              DOMException &&
            error.name ===
              "AbortError"
          ) {
            return;
          }

          setNotice({
            tone: "error",
            title:
              "Unable to load notification settings",
            message:
              error instanceof
              Error
                ? error.message
                : "Refresh the page and try again.",
          });
        } finally {
          if (
            loadAbortRef.current ===
            controller
          ) {
            setLoading(false);
            setRefreshing(
              false,
            );
          }
        }
      },
      [],
    );

  useEffect(() => {
    void loadSettings();

    return () => {
      loadAbortRef.current
        ?.abort();
    };
  }, [loadSettings]);

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const beforeUnload = (
      event: BeforeUnloadEvent,
    ) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener(
      "beforeunload",
      beforeUnload,
    );

    return () =>
      window.removeEventListener(
        "beforeunload",
        beforeUnload,
      );
  }, [dirty]);

  function updateSetting(
    key:
      keyof NotificationSettings,
    value: boolean,
  ) {
    if (
      CRITICAL_KEYS.has(key)
    ) {
      return;
    }

    setNotice(null);

    setSettings(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  }

  function updateFailedThreshold(
    value: string,
  ) {
    const threshold =
      value === "3"
        ? 3
        : value === "5"
          ? 5
          : 1;

    setSettings(
      (current) => ({
        ...current,
        failedLoginThreshold:
          threshold,
      }),
    );

    setNotice(null);
  }

  async function saveSettings() {
    if (
      saving ||
      !dirty
    ) {
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const response =
        await fetch(
          API,
          {
            method: "PATCH",
            credentials:
              "include",
            cache:
              "no-store",
            headers: {
              Accept:
                "application/json",
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                emailEnabled:
                  settings
                    .emailEnabled,

                successfulLogin:
                  settings
                    .successfulLogin,

                failedLogin:
                  settings
                    .failedLogin,

                failedLoginThreshold:
                  settings
                    .failedLoginThreshold,

                newDevice:
                  settings
                    .newDevice,

                newLocation:
                  settings
                    .newLocation,

                trustedDeviceAdded:
                  settings
                    .trustedDeviceAdded,

                trustedDeviceRevoked:
                  settings
                    .trustedDeviceRevoked,

                mfaFailure:
                  settings
                    .mfaFailure,

                // Locked critical security controls.
                mfaChanged: true,
                passwordChanged: true,
                highRiskActivity: true,
                sessionSecurity: true,
                rateLimitOrLockout: true,
                adminAccessChanged: true,
                securitySettingsChanged: true,
              }),
          },
        );

      const data =
        (await response
          .json()
          .catch(
            () => null,
          )) as
          | ApiResponse
          | null;

      if (
        !response.ok ||
        !data?.ok ||
        !data.settings
      ) {
        throw new Error(
          data?.error ||
            "Notification settings could not be saved.",
        );
      }

      const next =
        normaliseSettings(
          data.settings,
        );

      setSettings(next);
      setSavedSettings(
        next,
      );

      setNotice({
        tone: "success",
        title:
          "Security notifications updated",
        message:
          "Your security notification preferences have been saved.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        title:
          "Unable to save notification settings",
        message:
          error instanceof
            Error
            ? error.message
            : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function sendTestAlert() {
    if (
      sendingTest ||
      saving
    ) {
      return;
    }

    setSendingTest(true);
    setNotice(null);

    try {
      const response =
        await fetch(
          API,
          {
            method: "POST",
            credentials:
              "include",
            cache:
              "no-store",
            headers: {
              Accept:
                "application/json",
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                action:
                  "send_test",
              }),
          },
        );

      const data =
        (await response
          .json()
          .catch(
            () => null,
          )) as
          | ApiResponse
          | null;

      if (
        !response.ok ||
        !data?.ok ||
        !data.testSent
      ) {
        throw new Error(
          data?.error ||
            "The test security alert could not be sent.",
        );
      }

      setNotice({
        tone: "success",
        title:
          "Test security alert sent",
        message:
          `A test alert was sent to ${
            adminEmail ||
            "your administrator email"
          }.`,
      });

      await loadSettings(
        true,
      );
    } catch (error) {
      setNotice({
        tone: "error",
        title:
          "Test security alert failed",
        message:
          error instanceof
            Error
            ? error.message
            : "Check your email notification configuration and try again.",
      });
    } finally {
      setSendingTest(false);
    }
  }

  function resetUnsavedChanges() {
    setSettings(
      savedSettings,
    );

    setNotice({
      tone: "warning",
      title:
        "Unsaved changes discarded",
      message:
        "Your notification settings have been restored to the last saved version.",
    });
  }

  if (loading) {
    return (
      <main className="flex min-h-[70vh] w-full items-center justify-center px-4 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-200" />
          <p className="mt-3 text-sm font-black text-white/60">
            Loading security notifications...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="w-full max-w-none">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={
              SECURITY_CENTRE
            }
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-black transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Security Centre
          </Link>

          <div className="flex flex-wrap gap-2">
            {dirty ? (
              <button
                type="button"
                onClick={
                  resetUnsavedChanges
                }
                disabled={
                  saving
                }
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white/70 transition hover:bg-white/10 disabled:opacity-40"
              >
                Discard changes
              </button>
            ) : null}

            <button
              type="button"
              onClick={() =>
                void loadSettings(
                  true,
                )
              }
              disabled={
                refreshing ||
                saving ||
                dirty
              }
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-black transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={[
                  "h-4 w-4",
                  refreshing
                    ? "animate-spin"
                    : "",
                ].join(" ")}
              />
              Refresh
            </button>
          </div>
        </div>

        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-purple-500/10 via-black/20 to-pink-500/10 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-purple-100">
                  <BellRing className="h-4 w-4" />
                  Security alert centre
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-100">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Critical alerts locked on
                </span>
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
                Security Notifications
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60 sm:text-base">
                Monitor account access, MFA, trusted devices, approximate
                location, sessions, permissions and high-risk activity.
                Critical alerts are enforced by the server and cannot be
                disabled from this page.
              </p>
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-purple-300/20 bg-purple-500/10 text-purple-200">
              <BellRing className="h-8 w-8" />
            </div>
          </div>
        </section>

        {notice ? (
          <section
            role={
              notice.tone ===
              "error"
                ? "alert"
                : "status"
            }
            className={[
              "mt-6 flex items-start gap-3 rounded-3xl border p-5 text-sm",
              notice.tone ===
              "success"
                ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-50"
                : notice.tone ===
                    "warning"
                  ? "border-amber-300/20 bg-amber-500/10 text-amber-50"
                  : "border-red-300/20 bg-red-500/10 text-red-50",
            ].join(" ")}
          >
            {notice.tone ===
            "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            )}

            <div>
              <p className="font-black">
                {notice.title}
              </p>
              <p className="mt-1 opacity-70">
                {notice.message}
              </p>
            </div>
          </section>
        ) : null}

        {dirty ? (
          <section className="mt-6 rounded-3xl border border-amber-300/20 bg-amber-500/[0.08] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
              <div>
                <p className="font-black text-amber-50">
                  Unsaved security changes
                </p>
                <p className="mt-1 text-sm text-amber-50/65">
                  Save or discard these changes before refreshing or leaving
                  the page.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Alert destination"
            value={
              adminEmail ||
              "Admin email unavailable"
            }
            description="Primary administrator security-alert email."
            icon={Mail}
          />

          <SummaryCard
            title="Critical protection"
            value={`${CRITICAL_OPTIONS.length} always on`}
            description="Server-enforced critical account alerts."
            icon={ShieldCheck}
          />

          <SummaryCard
            title="Optional monitoring"
            value={`${optionalEnabledCount} of ${OPTIONAL_OPTIONS.length} enabled`}
            description="Additional login, MFA, device and location alerts."
            icon={BellRing}
          />

          <SummaryCard
            title="Delivery health"
            value={
              health?.configured
                ? "Ready"
                : "Needs attention"
            }
            description={
              health?.lastDeliveryAt
                ? `Last delivery: ${formatDate(
                    health.lastDeliveryAt,
                  )}`
                : "No notification delivery recorded yet."
            }
            icon={
              health?.configured
                ? CheckCircle2
                : AlertTriangle
            }
          />
        </section>

        <section className="mt-6 rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/10 backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-300/15 bg-blue-500/10 text-blue-200">
                <Mail className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-black">
                  Optional email alerts
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-white/55">
                  This controls optional alert emails. Critical account
                  protection alerts remain enabled regardless of this switch.
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <StatusPill
                    good={
                      Boolean(
                        health
                          ?.senderConfigured,
                      )
                    }
                    goodText="Sender configured"
                    badText="Sender missing"
                  />
                  <StatusPill
                    good={
                      Boolean(
                        health
                          ?.recipientConfigured,
                      )
                    }
                    goodText="Recipient configured"
                    badText="Recipient missing"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  void sendTestAlert()
                }
                disabled={
                  sendingTest ||
                  saving ||
                  dirty
                }
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-blue-300/20 bg-blue-500/10 px-4 text-sm font-black text-blue-100 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sendingTest ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sendingTest
                  ? "Sending..."
                  : "Send test alert"}
              </button>

              <Toggle
                checked={
                  settings.emailEnabled
                }
                onChange={(value) =>
                  updateSetting(
                    "emailEnabled",
                    value,
                  )
                }
                label="Optional email alerts"
              />
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
              Required protection
            </p>
            <h2 className="mt-1 text-xl font-black">
              Critical alerts — always enabled
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-white/50">
              These controls protect against silent account changes. They
              must also be enforced server-side so a modified browser request
              cannot disable them.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {CRITICAL_OPTIONS.map(
              (option) => (
                <NotificationCard
                  key={option.key}
                  option={option}
                  checked
                  disabled
                  onChange={() => {}}
                />
              ),
            )}
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
              Additional monitoring
            </p>
            <h2 className="mt-1 text-xl font-black">
              Optional alerts
            </h2>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {OPTIONAL_OPTIONS.map(
              (option) => (
                <NotificationCard
                  key={option.key}
                  option={option}
                  checked={
                    Boolean(
                      settings[
                        option.key
                      ],
                    )
                  }
                  disabled={
                    !settings.emailEnabled
                  }
                  onChange={(value) =>
                    updateSetting(
                      option.key,
                      value,
                    )
                  }
                />
              ),
            )}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-200" />
                <h2 className="font-black">
                  Failed sign-in threshold
                </h2>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
                Choose how many failed attempts should trigger the optional
                failed-login alert. Rate-limit and lockout alerts remain
                critical and always on.
              </p>
            </div>

            <select
              value={
                String(
                  settings
                    .failedLoginThreshold,
                )
              }
              disabled={
                !settings.emailEnabled ||
                !settings.failedLogin
              }
              onChange={(event) =>
                updateFailedThreshold(
                  event.target.value,
                )
              }
              className="h-11 min-w-48 rounded-2xl border border-white/10 bg-black/70 px-4 text-sm font-black text-white outline-none focus:border-purple-300/30 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-40"
            >
              <option value="1">
                Alert after 1 failure
              </option>
              <option value="3">
                Alert after 3 failures
              </option>
              <option value="5">
                Alert after 5 failures
              </option>
            </select>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black">
                Save security alert settings
              </p>

              <p className="mt-1 text-sm text-white/50">
                Last saved:{" "}
                {formatDate(
                  savedSettings
                    .updatedAt,
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void saveSettings()
              }
              disabled={
                saving ||
                !dirty
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-purple-300/20 bg-purple-500/15 px-5 text-sm font-black text-purple-50 transition hover:bg-purple-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving
                ? "Saving..."
                : "Save settings"}
            </button>
          </div>
        </section>

        <section className="mt-8 rounded-[32px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <Activity className="h-5 w-5 text-purple-200" />
            <div>
              <h2 className="font-black">
                Recent notification deliveries
              </h2>
              <p className="mt-1 text-sm text-white/45">
                Latest security notification delivery attempts recorded by
                this notification service.
              </p>
            </div>
          </div>

          {deliveries.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/15 p-6 text-center text-sm text-white/45">
              No notification deliveries have been recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {deliveries.map(
                (delivery) => (
                  <div
                    key={delivery.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/15 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      {delivery.status ===
                      "sent" ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                      ) : (
                        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
                      )}

                      <div className="min-w-0">
                        <p className="font-black">
                          {
                            delivery.eventType
                          }
                        </p>
                        <p className="mt-1 text-sm text-white/45">
                          {
                            delivery.recipientMasked
                          }
                        </p>
                        {delivery.errorMessage ? (
                          <p className="mt-1 text-xs text-red-200/70">
                            {
                              delivery.errorMessage
                            }
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 text-xs text-white/45">
                      <Clock3 className="h-4 w-4" />
                      {formatDate(
                        delivery.createdAt,
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-3xl border border-blue-300/10 bg-blue-500/[0.06] p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-200" />

            <div>
              <h2 className="font-black text-blue-50">
                Security design
              </h2>

              <p className="mt-2 max-w-5xl text-sm leading-6 text-blue-50/65">
                Security notifications are useful as an early-warning system,
                but they must not replace MFA, trusted-device checks, session
                controls, audit logging or rate limiting. Critical alerts
                should be sent immediately and should never expose passwords,
                OTP codes, session tokens, raw trusted-device tokens or other
                secrets.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusPill({
  good,
  goodText,
  badText,
}: {
  good: boolean;
  goodText: string;
  badText: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-black",
        good
          ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
          : "border-red-300/20 bg-red-500/10 text-red-100",
      ].join(" ")}
    >
      {good ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5" />
      )}
      {good
        ? goodText
        : badText}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof BellRing;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-purple-300/15 bg-purple-500/10 text-purple-200">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-white/40">
            {title}
          </p>
          <p className="mt-2 break-words text-base font-black text-white/85">
            {value}
          </p>
          <p className="mt-2 text-sm leading-5 text-white/50">
            {description}
          </p>
        </div>
      </div>
    </article>
  );
}

function NotificationCard({
  option,
  checked,
  disabled,
  onChange,
}: {
  option: NotificationOption;
  checked: boolean;
  disabled: boolean;
  onChange: (
    checked: boolean,
  ) => void;
}) {
  const Icon =
    option.icon;

  return (
    <article
      className={[
        "rounded-3xl border p-5 shadow-xl shadow-black/10 backdrop-blur-xl",
        option.critical
          ? "border-amber-300/15 bg-amber-500/[0.055]"
          : "border-white/10 bg-white/[0.045]",
      ].join(" ")}
    >
      <div className="flex items-start gap-4">
        <div
          className={[
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
            option.critical
              ? "border-amber-300/20 bg-amber-500/10 text-amber-200"
              : "border-purple-300/15 bg-purple-500/10 text-purple-200",
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black">
              {option.title}
            </h3>

            {option.critical ? (
              <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-100">
                Always on
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-sm leading-6 text-white/55">
            {option.description}
          </p>
        </div>

        <Toggle
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          label={option.title}
        />
      </div>
    </article>
  );
}

function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (
    checked: boolean,
  ) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() =>
        onChange(
          !checked,
        )
      }
      className={[
        "relative h-7 w-12 shrink-0 rounded-full border transition",
        checked
          ? "border-emerald-300/30 bg-emerald-500/30"
          : "border-white/10 bg-black/25",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:ring-2 hover:ring-purple-400/20",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition",
          checked
            ? "left-6"
            : "left-1",
        ].join(" ")}
      />
    </button>
  );
}
