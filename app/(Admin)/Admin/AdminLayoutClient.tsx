"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  AdminProvider,
  useAdmin,
  type AdminRole,
} from "./components/providers/AdminProvider";
import AdminSidebar from "./components/rooting/AdminSidebar";

const ALL_PERMISSION_KEYS = [
  "admin:dashboard:view",
  "admin:users:manage",

  "event_hub:view",
  "event_hub:manage",

  "contacts:view",
  "contacts:manage",

  "email:view",
  "email:send",
  "email:manage_templates",

  "money:view",
  "money:add_transactions",
  "money:edit_transactions",
  "money:edit_old_years",
  "money:hide_transactions",
  "money:delete_all",
  "money:delete_year",
  "money:manage_year_locks",
  "money:manage_sponsors",
  "money:change_sponsor_totals",
  "money:sync_website_payments",
  "money:print_reports",
  "money:export_reports",
  "money:manage_refunds",

  "donations:view",
  "donations:manage",

  "raffle:view",
  "raffle:manage",
  "raffle:draw_winners",

  "site_pages:view",
  "site_pages:manage",

  "audit_logs:view",
];

const AUTH_ROUTES = [
  "/admin/login",
  "/admin/logout",
  "/admin/forgot-password",
  "/admin/reset-password",
  "/admin/change-password",
];

const EVENT_HUB_PREFIX = "/admin/eventhub";
const DASHBOARD_PREFIX = "/admin/dashboard";
const EMAIL_PREFIX = "/admin/email";
const MONEY_PREFIX = "/admin/money";
const MONEY_MANAGEMENT_PREFIX = "/admin/moneymanagement";
const STOCK_MANAGEMENT_PREFIX = "/admin/stockmanagement";
const BUG_TRACKER_PREFIX = "/admin/bugtracker";

const ADMIN_PRESENCE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const ADMIN_PRESENCE_RESPONSE_WINDOW_MS = 60 * 1000;
const ADMIN_SECURITY_STATUS_RETRY_MS = 30 * 1000;

const SESSION_SECURITY_STATUS_API = "/api/admin/settings/security/session/status";
const SESSION_PRESENCE_API = "/api/admin/settings/security/session/presence";
const SESSION_REQUIRE_REAUTH_API =
  "/api/admin/settings/security/session/require-reauth";

type AdminSessionSecurityStatus = {
  authenticated?: boolean;
  requires_reauthentication?: boolean;
  last_mfa_at?: string | null;
  next_presence_check_at?: string | null;
};

type AdminPresenceResponse = {
  ok?: boolean;
  next_presence_check_at?: string | null;
};

type AuditRiskLevel = "low" | "medium" | "high" | "critical";

type AuditReportInput = {
  action: string;
  area: string;
  route?: string | null;
  method?: string;
  status?: string;
  risk_level?: AuditRiskLevel;
  target_type?: string | null;
  target_id?: string | null;
  target_label?: string | null;
  metadata?: Record<string, unknown>;
};

function normalisePath(pathname: string | null | undefined) {
  const path = String(pathname || "")
    .trim()
    .toLowerCase()
    .replace(/\/+$/, "");

  return path || "/";
}

function isPathOrChild(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function isAuthRoute(path: string) {
  return AUTH_ROUTES.some((route) => isPathOrChild(path, route));
}

function getSafeNextPath(pathname: string | null | undefined) {
  const raw = String(pathname || "/Admin/Dashboard").trim();

  if (!raw.startsWith("/Admin")) return "/Admin/Dashboard";
  if (raw.startsWith("//")) return "/Admin/Dashboard";
  if (raw.includes("\\")) return "/Admin/Dashboard";
  if (raw.toLowerCase().startsWith("/admin/login")) return "/Admin/Dashboard";

  return raw;
}

function getLoginPath(pathname: string | null | undefined) {
  const next = getSafeNextPath(pathname);

  return `/Admin/Login?next=${encodeURIComponent(next)}`;
}

function getTwoFactorReauthPath(
  pathname: string | null | undefined,
  reason: string,
) {
  const next = getSafeNextPath(pathname);
  const params = new URLSearchParams({
    next,
    reason,
    reauth: "1",
  });

  return `/Admin/Login/TwoFactor/Verify?${params.toString()}`;
}

function parseSecurityTimestamp(value: string | null | undefined) {
  if (!value) return null;

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function getAuditArea(pathname: string | null | undefined) {
  const path = normalisePath(pathname);

  if (isAuthRoute(path)) return "auth";
  if (isPathOrChild(path, EVENT_HUB_PREFIX)) return "event_hub";
  if (isPathOrChild(path, EMAIL_PREFIX)) return "email";

  if (
    isPathOrChild(path, MONEY_PREFIX) ||
    isPathOrChild(path, MONEY_MANAGEMENT_PREFIX) ||
    isPathOrChild(path, "/admin/dashboard/money")
  ) {
    return "money";
  }

  if (isPathOrChild(path, "/admin/dashboard/users")) return "admin_users";
  if (isPathOrChild(path, "/admin/dashboard/logs")) return "audit_logs";
  if (isPathOrChild(path, "/admin/dashboard/donations")) return "donations";
  if (isPathOrChild(path, "/admin/dashboard/raffle")) return "raffle";
  if (isPathOrChild(path, "/admin/dashboard/settings/pageeditor")) {
    return "site_pages";
  }
  if (isPathOrChild(path, "/admin/dashboard/pageeditor")) {
    return "site_pages";
  }
  if (isPathOrChild(path, DASHBOARD_PREFIX)) return "dashboard";

  return "admin_portal";
}

function getRequiredPermission(pathname: string | null | undefined) {
  const path = normalisePath(pathname);

  if (!path || path === "/") return null;
  if (isAuthRoute(path)) return null;

 
  if (isPathOrChild(path, EVENT_HUB_PREFIX)) {
    return "event_hub:view";
  }

  if (isPathOrChild(path, "/admin/dashboard/settings/pageeditor")) {
    return "site_pages:manage";
  }

  if (isPathOrChild(path, "/admin/dashboard/pageeditor")) {
    return "site_pages:manage";
  }

  if (isPathOrChild(path, "/admin/dashboard/users")) {
    return "admin:users:manage";
  }

  if (isPathOrChild(path, "/admin/dashboard/logs")) {
    return "audit_logs:view";
  }

  if (isPathOrChild(path, "/admin/dashboard/donations")) {
    return "donations:view";
  }

  if (isPathOrChild(path, "/admin/dashboard/raffle")) {
    return "raffle:view";
  }

  if (isPathOrChild(path, EMAIL_PREFIX)) {
    return "email:view";
  }

  if (
    isPathOrChild(path, MONEY_PREFIX) ||
    isPathOrChild(path, MONEY_MANAGEMENT_PREFIX) ||
    isPathOrChild(path, "/admin/dashboard/money")
  ) {
    return "money:view";
  }

  if (isPathOrChild(path, DASHBOARD_PREFIX)) {
    return "admin:dashboard:view";
  }

  return null;
}

function getFirstAllowedPage(
  permissions: string[],
  adminRole: AdminRole | null,
) {
  if (adminRole === "main_admin") return "/Admin/Dashboard";

  if (permissions.includes("admin:dashboard:view")) {
    return "/Admin/Dashboard";
  }

  if (permissions.includes("money:view")) {
    return "/Admin/MoneyManagement/TrackingMoney";
  }

  if (permissions.includes("email:view")) {
    return "/Admin/Email/Sending";
  }

  if (permissions.includes("event_hub:view")) {
    return "/Admin/BurtonPrideEventHub";
  }

  if (permissions.includes("donations:view")) {
    return "/Admin/Dashboard/Donations";
  }

  if (permissions.includes("raffle:view")) {
    return "/Admin/Dashboard/Raffle";
  }

  if (
    permissions.includes("site_pages:view") ||
    permissions.includes("site_pages:manage")
  ) {
    return "/Admin/Dashboard/Settings/PageEditor";
  }

  if (permissions.includes("audit_logs:view")) {
    return "/Admin/Dashboard/Logs";
  }

  return null;
}

function hasPermission(
  permissions: string[],
  adminRole: AdminRole | null,
  permission: string,
) {
  if (adminRole === "main_admin") return true;
  return permissions.includes(permission);
}

async function reportAdminAudit(input: AuditReportInput) {
  try {
    await fetch("/api/admin/audit-log/report", {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  } catch (error) {
    console.warn("Audit report failed:", error);
  }
}


function AdminSessionPresenceBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const path = normalisePath(pathname);
  const isAuthPage = isAuthRoute(path);

  const [showPresenceCheck, setShowPresenceCheck] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [confirmingPresence, setConfirmingPresence] = useState(false);
  const [securityMessage, setSecurityMessage] = useState("");

  const presenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const securityRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef =
    useRef<ReturnType<typeof setInterval> | null>(null);
  const responseDeadlineRef = useRef<number | null>(null);
  const reauthStartedRef = useRef(false);
  const developmentPresenceTestRef = useRef(false);

  const clearPresenceTimer = useCallback(() => {
    if (presenceTimerRef.current) {
      clearTimeout(presenceTimerRef.current);
      presenceTimerRef.current = null;
    }
  }, []);

  const clearSecurityRetryTimer = useCallback(() => {
    if (securityRetryTimerRef.current) {
      clearTimeout(securityRetryTimerRef.current);
      securityRetryTimerRef.current = null;
    }
  }, []);

  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const redirectToTwoFactor = useCallback(
    (reason: string) => {
      if (reauthStartedRef.current) return;

      reauthStartedRef.current = true;
      clearPresenceTimer();
      clearSecurityRetryTimer();
      clearCountdownTimer();
      setShowPresenceCheck(false);

      router.replace(getTwoFactorReauthPath(pathname, reason));
      router.refresh();
    },
    [
      clearCountdownTimer,
      clearPresenceTimer,
      clearSecurityRetryTimer,
      pathname,
      router,
    ],
  );

  const requireReauthentication = useCallback(
    async (reason: string) => {
      if (reauthStartedRef.current) return;

      try {
        await fetch(SESSION_REQUIRE_REAUTH_API, {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason,
            route: pathname || "/Admin/Dashboard",
          }),
        });
      } catch (error) {
        console.warn(
          "Could not update admin reauthentication state:",
          error,
        );
      } finally {
        redirectToTwoFactor(reason);
      }
    },
    [pathname, redirectToTwoFactor],
  );

  const startPresenceCountdown = useCallback(() => {
    clearPresenceTimer();
    clearCountdownTimer();

    const deadline =
      Date.now() + ADMIN_PRESENCE_RESPONSE_WINDOW_MS;

    responseDeadlineRef.current = deadline;

    setSecondsRemaining(
      Math.ceil(ADMIN_PRESENCE_RESPONSE_WINDOW_MS / 1000),
    );
    setSecurityMessage("");
    setShowPresenceCheck(true);

    void reportAdminAudit({
      action: "admin_presence_check_shown",
      area: getAuditArea(pathname),
      route: pathname || "/Admin/Dashboard",
      method: "CLIENT",
      status: "pending",
      risk_level: "low",
      metadata: {
        response_window_seconds:
          ADMIN_PRESENCE_RESPONSE_WINDOW_MS / 1000,
        interval_hours:
          ADMIN_PRESENCE_CHECK_INTERVAL_MS / 60 / 60 / 1000,
      },
    });

    countdownTimerRef.current = setInterval(() => {
      const activeDeadline = responseDeadlineRef.current;

      if (!activeDeadline) return;

      const remaining = Math.max(
        0,
        Math.ceil((activeDeadline - Date.now()) / 1000),
      );

      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        clearCountdownTimer();

        void reportAdminAudit({
          action: "admin_presence_check_timeout",
          area: getAuditArea(pathname),
          route: pathname || "/Admin/Dashboard",
          method: "CLIENT",
          status: "blocked",
          risk_level: "medium",
          metadata: {
            reason: "no_response_within_60_seconds",
          },
        });

        if (
          process.env.NODE_ENV !== "production" &&
          developmentPresenceTestRef.current
        ) {
          /*
           * A development UI test must never lock the real admin session.
           * Close the modal after the one-minute timeout and leave the
           * server-side MFA/session state untouched.
           */
          developmentPresenceTestRef.current = false;
          responseDeadlineRef.current = null;
          setShowPresenceCheck(false);
          setSecurityMessage(
            "Development test complete: the one-minute timeout fired. The real admin session was not locked.",
          );
          return;
        }

        void requireReauthentication(
          "presence_check_timeout",
        );
      }
    }, 250);
  }, [
    clearCountdownTimer,
    clearPresenceTimer,
    pathname,
    requireReauthentication,
  ]);

  const schedulePresenceCheck = useCallback(
    (checkAt: number) => {
      clearPresenceTimer();

      const delay = Math.max(0, checkAt - Date.now());

      presenceTimerRef.current = setTimeout(() => {
        startPresenceCountdown();
      }, delay);
    },
    [clearPresenceTimer, startPresenceCountdown],
  );

  const loadSessionSecurityStatus = useCallback(async () => {
    if (isAuthPage || reauthStartedRef.current) return;

    try {
      const response = await fetch(SESSION_SECURITY_STATUS_API, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.status === 401 || response.status === 403) {
        /*
         * Do not force a 2FA redirect here.
         *
         * The normal AdminProvider/AdminLayoutGate owns authentication
         * redirects. Sending every 401/403 straight to the two-factor page
         * can create an endless Dashboard -> 2FA -> Dashboard -> 2FA loop
         * when the security-session API and the login session briefly disagree.
         */
        clearPresenceTimer();
        clearSecurityRetryTimer();

        securityRetryTimerRef.current = setTimeout(() => {
          if (!reauthStartedRef.current) {
            void loadSessionSecurityStatus();
          }
        }, ADMIN_SECURITY_STATUS_RETRY_MS);

        return;
      }

      if (!response.ok) {
        /*
         * A temporary 404/500 from the presence-check API must not trap an
         * already authenticated administrator in a reauthentication loop.
         * Keep the existing admin permission/authentication boundary in
         * control and retry the optional presence status check shortly.
         */
        console.warn(
          `Security status request failed with ${response.status}.`,
        );

        clearSecurityRetryTimer();

        securityRetryTimerRef.current = setTimeout(() => {
          if (!reauthStartedRef.current) {
            void loadSessionSecurityStatus();
          }
        }, ADMIN_SECURITY_STATUS_RETRY_MS);

        return;
      }

      const data =
        (await response.json()) as AdminSessionSecurityStatus;

      if (data.authenticated === false) {
        redirectToTwoFactor("admin_session_not_authenticated");
        return;
      }

      if (data.requires_reauthentication) {
        redirectToTwoFactor("reauthentication_required");
        return;
      }

      const nextPresenceCheck = parseSecurityTimestamp(
        data.next_presence_check_at,
      );

      if (nextPresenceCheck) {
        if (nextPresenceCheck <= Date.now()) {
          startPresenceCountdown();
          return;
        }

        schedulePresenceCheck(nextPresenceCheck);
        return;
      }

      const lastMfaAt = parseSecurityTimestamp(data.last_mfa_at);

      if (!lastMfaAt) {
        /*
         * Fail closed when the server cannot prove when the
         * administrator last completed MFA.
         */
        await requireReauthentication(
          "mfa_timestamp_unavailable",
        );
        return;
      }

      const calculatedCheckAt =
        lastMfaAt + ADMIN_PRESENCE_CHECK_INTERVAL_MS;

      if (calculatedCheckAt <= Date.now()) {
        startPresenceCountdown();
        return;
      }

      schedulePresenceCheck(calculatedCheckAt);
    } catch (error) {
      console.warn(
        "Admin session security check failed:",
        error,
      );

      /*
       * Loop protection:
       * a network error or temporary API failure is NOT treated as proof
       * that MFA has expired. The existing AdminProvider and server-side
       * protected APIs remain the authentication boundary.
       *
       * Retry the presence check instead of redirecting to 2FA forever.
       */
      clearSecurityRetryTimer();

      securityRetryTimerRef.current = setTimeout(() => {
        if (!reauthStartedRef.current) {
          void loadSessionSecurityStatus();
        }
      }, ADMIN_SECURITY_STATUS_RETRY_MS);
    }
  }, [
    clearPresenceTimer,
    clearSecurityRetryTimer,
    isAuthPage,
    redirectToTwoFactor,
    requireReauthentication,
    schedulePresenceCheck,
    startPresenceCountdown,
  ]);

  useEffect(() => {
    if (isAuthPage) {
      clearPresenceTimer();
      clearSecurityRetryTimer();
      clearCountdownTimer();
      setShowPresenceCheck(false);
      return;
    }

    reauthStartedRef.current = false;
    void loadSessionSecurityStatus();

    return () => {
      clearPresenceTimer();
      clearSecurityRetryTimer();
      clearCountdownTimer();
    };
  }, [
    clearCountdownTimer,
    clearPresenceTimer,
    clearSecurityRetryTimer,
    isAuthPage,
    loadSessionSecurityStatus,
  ]);

  useEffect(() => {
    if (isAuthPage) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (reauthStartedRef.current) return;

      if (showPresenceCheck) {
        const activeDeadline = responseDeadlineRef.current;

        if (activeDeadline && activeDeadline <= Date.now()) {
          void requireReauthentication(
            "presence_check_timeout",
          );
        }

        return;
      }

      void loadSessionSecurityStatus();
    };

    const handleFocus = () => {
      if (reauthStartedRef.current) return;

      if (showPresenceCheck) {
        const activeDeadline = responseDeadlineRef.current;

        if (activeDeadline && activeDeadline <= Date.now()) {
          void requireReauthentication(
            "presence_check_timeout",
          );
        }

        return;
      }

      void loadSessionSecurityStatus();
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
      window.removeEventListener("focus", handleFocus);
    };
  }, [
    isAuthPage,
    loadSessionSecurityStatus,
    requireReauthentication,
    showPresenceCheck,
  ]);

  /*
   * DEVELOPMENT-ONLY SAFE TEST HOOK
   *
   * The Security Session Test page dispatches this browser event to exercise
   * the real 60-second presence modal without changing admin_security_sessions.
   *
   * This avoids putting the current server session into a "due" or
   * "requires_reauthentication" state just to test the UI.
   */
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (isAuthPage) return;

    const handlePresenceTest = () => {
      if (reauthStartedRef.current) return;
      developmentPresenceTestRef.current = true;
      startPresenceCountdown();
    };

    window.addEventListener(
      "burton-admin:test-presence-check",
      handlePresenceTest,
    );

    return () => {
      window.removeEventListener(
        "burton-admin:test-presence-check",
        handlePresenceTest,
      );
    };
  }, [isAuthPage, startPresenceCountdown]);

  const handleStillHere = useCallback(async () => {
    if (confirmingPresence || reauthStartedRef.current) return;

    setConfirmingPresence(true);
    setSecurityMessage("");

    if (
      process.env.NODE_ENV !== "production" &&
      developmentPresenceTestRef.current
    ) {
      developmentPresenceTestRef.current = false;
      clearCountdownTimer();
      responseDeadlineRef.current = null;
      setShowPresenceCheck(false);
      setConfirmingPresence(false);
      setSecurityMessage("");

      void reportAdminAudit({
        action: "admin_presence_check_development_test_confirmed",
        area: getAuditArea(pathname),
        route: pathname || "/Admin/Dashboard",
        method: "CLIENT",
        status: "success",
        risk_level: "low",
        metadata: {
          development_test: true,
          server_session_changed: false,
        },
      });

      return;
    }

    try {
      const response = await fetch(SESSION_PRESENCE_API, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: pathname || "/Admin/Dashboard",
        }),
      });

      if (response.status === 401 || response.status === 403) {
        await requireReauthentication(
          "presence_confirmation_requires_mfa",
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          `Presence confirmation failed with ${response.status}.`,
        );
      }

      const data =
        (await response.json()) as AdminPresenceResponse;

      clearCountdownTimer();
      responseDeadlineRef.current = null;
      setShowPresenceCheck(false);

      void reportAdminAudit({
        action: "admin_presence_check_confirmed",
        area: getAuditArea(pathname),
        route: pathname || "/Admin/Dashboard",
        method: "CLIENT",
        status: "success",
        risk_level: "low",
        metadata: {
          next_check_hours:
            ADMIN_PRESENCE_CHECK_INTERVAL_MS / 60 / 60 / 1000,
        },
      });

      const serverNextCheck = parseSecurityTimestamp(
        data.next_presence_check_at,
      );

      schedulePresenceCheck(
        serverNextCheck ??
          Date.now() + ADMIN_PRESENCE_CHECK_INTERVAL_MS,
      );
    } catch (error) {
      console.warn(
        "Admin presence confirmation failed:",
        error,
      );

      setSecurityMessage(
        "We could not confirm your admin session. For security, two-step verification is required again.",
      );

      await requireReauthentication(
        "presence_confirmation_failed",
      );
    } finally {
      setConfirmingPresence(false);
    }
  }, [
    clearCountdownTimer,
    confirmingPresence,
    pathname,
    requireReauthentication,
    schedulePresenceCheck,
  ]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <>
      {children}

      {showPresenceCheck ? (
        <div
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 px-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-presence-title"
          aria-describedby="admin-presence-description"
        >
          <div className="w-full max-w-md rounded-3xl border border-purple-300/20 bg-[#090d1d] p-6 text-white shadow-2xl shadow-black/50">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15">
                <ShieldCheck className="h-6 w-6 text-purple-200" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-200/70">
                  Security check
                </p>

                <h2
                  id="admin-presence-title"
                  className="mt-1 text-2xl font-black text-white"
                >
                  Are you still here?
                </h2>
              </div>
            </div>

            <p
              id="admin-presence-description"
              className="mt-4 text-sm leading-6 text-white/75"
            >
              Burton Pride checks active admin sessions every six
              hours. Confirm within one minute to keep using this
              session. If you do not respond, you will need to enter
              your two-step verification PIN again.
            </p>

            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
              <Clock3 className="h-5 w-5 shrink-0 text-amber-200" />

              <div className="min-w-0">
                <div className="text-sm font-black text-amber-50">
                  {secondsRemaining} second
                  {secondsRemaining === 1 ? "" : "s"} remaining
                </div>

                <div className="mt-1 text-xs leading-5 text-amber-50/70">
                  No response means this admin session will be locked
                  until two-step verification succeeds.
                </div>
              </div>
            </div>

            {securityMessage ? (
              <div
                className="mt-4 flex items-start gap-2 rounded-2xl border border-red-300/20 bg-red-500/10 p-3 text-sm leading-5 text-red-50"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{securityMessage}</span>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleStillHere()}
              disabled={confirmingPresence}
              autoFocus
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 px-4 text-sm font-black text-white transition hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-offset-2 focus:ring-offset-[#090d1d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirmingPresence ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Yes, I&apos;m still here
                </>
              )}
            </button>

            <p className="mt-4 text-center text-xs text-white/40">
              Burton Pride Admin Portal security check
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function AdminStatusScreen({
  label,
  title,
  message,
  tone = "default",
  children,
}: {
  label: string;
  title: string;
  message?: string;
  tone?: "default" | "error" | "warning" | "success";
  children?: ReactNode;
}) {
  const toneClasses = {
    default: "border-white/15 bg-white/10 text-white",
    error: "border-red-300/25 bg-red-500/10 text-red-50",
    warning: "border-amber-300/25 bg-amber-500/10 text-amber-50",
    success: "border-emerald-300/25 bg-emerald-500/10 text-emerald-50",
  };

  const Icon =
    tone === "error"
      ? AlertTriangle
      : tone === "warning"
        ? Lock
        : tone === "success"
          ? ShieldCheck
          : Loader2;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] text-white before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_18%_15%,rgba(236,72,153,0.18),transparent_30%),radial-gradient(circle_at_82%_12%,rgba(59,130,246,0.18),transparent_32%),linear-gradient(135deg,#050816_0%,#160b2d_45%,#06152e_100%)]">
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div
          className={[
            "max-w-lg rounded-3xl border p-6 text-center shadow-2xl shadow-black/20 backdrop-blur-xl",
            toneClasses[tone],
          ].join(" ")}
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Icon
              className={[
                "h-6 w-6",
                tone === "default" ? "animate-spin" : "",
              ].join(" ")}
            />
          </div>

          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-white/65">
            {label}
          </p>

          <h1 className="mt-2 text-2xl font-black text-white">{title}</h1>

          {message ? (
            <p className="mt-3 text-sm leading-6 text-white/75">{message}</p>
          ) : null}

          {children ? <div className="mt-5">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

function LoadingPermissionsScreen() {
  return (
    <AdminStatusScreen
      label="Admin Portal"
      title="Loading admin access..."
      message="Checking your admin session and permissions."
    />
  );
}

function PermissionErrorScreen({
  error,
  refreshAdmin,
}: {
  error: string;
  refreshAdmin: () => Promise<void>;
}) {
  return (
    <AdminStatusScreen
      label="Admin Portal"
      title="Could not load admin access"
      message={error}
      tone="error"
    >
      <button
        type="button"
        onClick={() => void refreshAdmin()}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </AdminStatusScreen>
  );
}

function RedirectingScreen() {
  return (
    <AdminStatusScreen
      label="Restricted Access"
      title="Redirecting..."
      message="You do not have access to this page, so we are sending you to a page you can use."
      tone="warning"
    />
  );
}

function NoAccessScreen() {
  return (
    <AdminStatusScreen
      label="Restricted Access"
      title="You do not have access to any admin pages"
      message="Ask a main admin to update your permissions in Admin Users."
      tone="warning"
    >
      <Link
        href="/Admin/Login"
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25"
      >
        Back to login
        <ArrowRight className="h-4 w-4" />
      </Link>
    </AdminStatusScreen>
  );
}

function AdminLayoutGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const lastPageViewAuditRef = useRef("");
  const lastPermissionDeniedAuditRef = useRef("");
  const lastUnauthenticatedAuditRef = useRef("");
  const lastAccessErrorAuditRef = useRef("");

  const {
    admin,
    adminEmail,
    adminName,
    adminRole,
    permissions,
    isMainAdmin,
    loading,
    refreshing,
    status,
    error,
    refreshAdmin,
  } = useAdmin();

  const path = normalisePath(pathname);

  const isAuthPage = isAuthRoute(path);
  const isDashboardRoute = isPathOrChild(path, DASHBOARD_PREFIX);
  const isEmailRoute = isPathOrChild(path, EMAIL_PREFIX);
  const isMoneyRoute =
    isPathOrChild(path, MONEY_PREFIX) ||
    isPathOrChild(path, MONEY_MANAGEMENT_PREFIX);
  const isEventHubRoute = isPathOrChild(path, EVENT_HUB_PREFIX);

  const requiredPermission = useMemo(
    () => getRequiredPermission(pathname),
    [pathname],
  );

  const safePermissions = useMemo(() => {
    return isMainAdmin || adminRole === "main_admin"
      ? ALL_PERMISSION_KEYS
      : permissions;
  }, [adminRole, isMainAdmin, permissions]);

  const canAccessCurrentPage = useMemo(() => {
    if (!requiredPermission) return true;

    return hasPermission(safePermissions, adminRole, requiredPermission);
  }, [adminRole, requiredPermission, safePermissions]);

  const fallbackPage = useMemo(() => {
    return getFirstAllowedPage(safePermissions, adminRole);
  }, [adminRole, safePermissions]);

  useEffect(() => {
    document.title = isDashboardRoute
      ? "Burton Pride Admin Portal"
      : isEmailRoute
        ? "Burton Pride Email Centre"
        : isMoneyRoute
          ? "Burton Pride Money Management"
          : isEventHubRoute
            ? "Burton Pride Event Hub"
            : "Burton Pride Admin Portal";
  }, [isDashboardRoute, isEmailRoute, isMoneyRoute, isEventHubRoute]);

  /**
   * Report successful admin page views.
   */
  useEffect(() => {
    if (isAuthPage) return;
    if (loading) return;
    if (status !== "authenticated") return;
    if (!admin) return;
    if (!canAccessCurrentPage) return;

    const route = pathname || "/Admin/Dashboard";
    const auditKey = [
      "page_view",
      route,
      adminEmail || "unknown",
      requiredPermission || "none",
    ].join("|");

    if (lastPageViewAuditRef.current === auditKey) return;
    lastPageViewAuditRef.current = auditKey;

    void reportAdminAudit({
      action: "page_view",
      area: getAuditArea(route),
      route,
      method: "CLIENT",
      status: "success",
      risk_level: "low",
      metadata: {
        required_permission: requiredPermission,
        admin_role: adminRole,
        admin_email: adminEmail,
        admin_name: adminName,
        is_main_admin: isMainAdmin,
      },
    });
  }, [
    admin,
    adminEmail,
    adminName,
    adminRole,
    canAccessCurrentPage,
    isAuthPage,
    isMainAdmin,
    loading,
    pathname,
    requiredPermission,
    status,
  ]);

  /**
   * Report unauthenticated attempts to open admin pages.
   */
  useEffect(() => {
    if (isAuthPage) return;
    if (loading) return;
    if (status === "loading") return;
    if (status !== "unauthenticated") return;

    const route = pathname || "/Admin/Dashboard";
    const auditKey = ["unauthenticated", route].join("|");

    if (lastUnauthenticatedAuditRef.current === auditKey) return;
    lastUnauthenticatedAuditRef.current = auditKey;

    void reportAdminAudit({
      action: "unauthenticated_admin_access",
      area: getAuditArea(route),
      route,
      method: "CLIENT",
      status: "blocked",
      risk_level: "high",
      metadata: {
        reason: "admin_session_missing_or_expired",
      },
    });

    router.replace(getLoginPath(pathname));
  }, [isAuthPage, loading, pathname, router, status]);

  /**
   * Report admin permission loading errors.
   */
  useEffect(() => {
    if (isAuthPage) return;
    if (loading) return;
    if (status !== "error") return;

    const route = pathname || "/Admin/Dashboard";
    const auditKey = ["access_error", route, error || "unknown"].join("|");

    if (lastAccessErrorAuditRef.current === auditKey) return;
    lastAccessErrorAuditRef.current = auditKey;

    void reportAdminAudit({
      action: "admin_access_check_failed",
      area: getAuditArea(route),
      route,
      method: "CLIENT",
      status: "error",
      risk_level: "medium",
      metadata: {
        error: error || "Failed to load admin access.",
      },
    });
  }, [error, isAuthPage, loading, pathname, status]);

  /**
   * Report permission denied and then redirect to the first allowed page.
   */
  useEffect(() => {
    if (isAuthPage) return;
    if (loading) return;
    if (status !== "authenticated") return;
    if (!admin) return;
    if (canAccessCurrentPage) return;

    const route = pathname || "/Admin/Dashboard";
    const auditKey = [
      "permission_denied",
      route,
      adminEmail || "unknown",
      requiredPermission || "none",
    ].join("|");

    if (lastPermissionDeniedAuditRef.current !== auditKey) {
      lastPermissionDeniedAuditRef.current = auditKey;

      void reportAdminAudit({
        action: "permission_denied",
        area: getAuditArea(route),
        route,
        method: "CLIENT",
        status: "blocked",
        risk_level: "medium",
        metadata: {
          required_permission: requiredPermission,
          fallback_page: fallbackPage,
          admin_role: adminRole,
          admin_email: adminEmail,
          admin_name: adminName,
          is_main_admin: isMainAdmin,
        },
      });
    }

    if (fallbackPage && normalisePath(pathname) !== normalisePath(fallbackPage)) {
      router.replace(fallbackPage);
    }
  }, [
    admin,
    adminEmail,
    adminName,
    adminRole,
    canAccessCurrentPage,
    fallbackPage,
    isAuthPage,
    isMainAdmin,
    loading,
    pathname,
    requiredPermission,
    router,
    status,
  ]);

  /**
   * Auth pages should render without the admin shell.
   */
  if (isAuthPage) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#050816] text-white before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_18%_15%,rgba(236,72,153,0.18),transparent_30%),radial-gradient(circle_at_82%_12%,rgba(59,130,246,0.18),transparent_32%),linear-gradient(135deg,#050816_0%,#160b2d_45%,#06152e_100%)]">
        {children}
      </div>
    );
  }

  if (loading || status === "loading") {
    return <LoadingPermissionsScreen />;
  }

  if (status === "unauthenticated") {
    return (
      <AdminStatusScreen
        label="Admin Portal"
        title="Redirecting to login..."
        message="Your admin session has expired or you are not signed in."
      />
    );
  }

  if (status === "error") {
    return (
      <PermissionErrorScreen
        error={error || "Failed to load admin access."}
        refreshAdmin={refreshAdmin}
      />
    );
  }

  if (!admin) {
    return (
      <AdminStatusScreen
        label="Admin Portal"
        title="Admin session missing"
        message="Please log in again to continue."
        tone="warning"
      >
        <Link
          href={getLoginPath(pathname)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25"
        >
          Go to login
          <ArrowRight className="h-4 w-4" />
        </Link>
      </AdminStatusScreen>
    );
  }

  if (!canAccessCurrentPage) {
    if (fallbackPage) {
      return <RedirectingScreen />;
    }

    return <NoAccessScreen />;
  }

  if (isMoneyRoute || isEmailRoute || isEventHubRoute) {
    return <>{children}</>;
  }

  const showAdminNav = Boolean(isDashboardRoute);
  const displayName = adminName || adminEmail || "Committee Member";

  return (
    <div className="relative min-h-screen w-full max-w-none overflow-x-hidden bg-[#050816] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(236,72,153,0.18),transparent_30%),radial-gradient(circle_at_82%_12%,rgba(59,130,246,0.18),transparent_32%),linear-gradient(135deg,#050816_0%,#160b2d_45%,#06152e_100%)]" />
      <div className="pointer-events-none absolute left-[58%] top-[28%] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="relative z-10 flex min-h-screen w-full max-w-none flex-col md:flex-row">
        {showAdminNav ? (
          <AdminSidebar
            permissions={safePermissions}
            adminRole={adminRole}
            adminEmail={adminEmail}
            adminName={displayName}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
          {showAdminNav ? (
            <header className="hidden h-16 w-full shrink-0 items-center justify-between border-b border-white/10 bg-[#0b1020]/75 px-5 shadow-sm backdrop-blur-xl md:flex lg:px-6">
              <div>
                <div className="font-semibold text-white/90">Admin Portal</div>
                {refreshing ? (
                  <div className="text-xs font-semibold text-white/45">
                    Refreshing admin access...
                  </div>
                ) : null}
              </div>

              <div className="text-sm text-white/80">
                Signed in as{" "}
                <span className="font-semibold">{displayName}</span>
              </div>
            </header>
          ) : null}

          <main className="min-w-0 flex-1 overflow-x-hidden px-0 py-0">
            <div className="w-full min-w-0 max-w-none">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayoutClient({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const path = normalisePath(pathname);

  const usesSeparateAdminLayout =
    isPathOrChild(path, STOCK_MANAGEMENT_PREFIX) ||
    isPathOrChild(path, BUG_TRACKER_PREFIX);

  if (usesSeparateAdminLayout) {
    return (
      <AdminSessionPresenceBoundary>
        {children}
      </AdminSessionPresenceBoundary>
    );
  }

  return (
    <AdminProvider>
      <AdminSessionPresenceBoundary>
        <AdminLayoutGate>{children}</AdminLayoutGate>
      </AdminSessionPresenceBoundary>
    </AdminProvider>
  );
}
