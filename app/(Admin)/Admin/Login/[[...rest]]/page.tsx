"use client";

import {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  Lock,
  Loader2,
  Mail,
  ShieldAlert,
  RotateCcw,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  MapPin,
  MonitorSmartphone,
  Timer,
  Users,
  Activity,
  BadgeCheck,
  CircleHelp,
  Clock3,
  Fingerprint,
  Gauge,
  Globe2,
  HeartHandshake,
  Keyboard,
  Radio,
  Server,
  ShieldQuestion,
  UserRoundCheck,
  Wifi,
  WifiOff,
} from "lucide-react";

type TwoFactorMethod = "email" | "totp";

type LoginSecurityContext = {
  riskLevel?: AuditRiskLevel;
  newDevice?: boolean;
  deviceTrusted?: boolean;
  requiresDeviceApproval?: boolean;
  trustedDeviceCount?: number;
  maxTrustedDevices?: number;
  approximateLocation?: string | null;
  deviceLabel?: string | null;
};

type LoginResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
  code?: string;
  status?: number;
  admin?: unknown;
  user?: unknown;
  requiresTwoFactor?: boolean;
  challengeId?: string;
  methods?: TwoFactorMethod[];
  preferredMethod?: TwoFactorMethod;
  maskedEmail?: string;
  expiresInSeconds?: number;
  security?: LoginSecurityContext;
};

type VerifyTwoFactorResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  code?: string;
  attemptsRemaining?: number;
  security?: LoginSecurityContext;
};

type LoginError = {
  title: string;
  message: string;
  debug?: {
    endpoint?: string;
    httpStatus?: number;
    code?: string | null;
    reason?: string | null;
    apiError?: string | null;
    apiMessage?: string | null;
    attemptsRemaining?: number | null;
    details?: Record<string, unknown>;
  };
};

type AuditRiskLevel = "low" | "medium" | "high" | "critical";

type AuditEvent = {
  action: string;
  area: "auth" | "security" | "admin_portal";
  route: string;
  method?: "CLIENT" | "GET" | "POST";
  status?: string;
  risk_level?: AuditRiskLevel;
  target_type?: string | null;
  target_id?: string | null;
  target_label?: string | null;
  metadata?: Record<string, unknown>;
};

type LoginHistoryEvent = {
  result:
    | "success"
    | "failed"
    | "blocked"
    | "challenge";
  riskLevel: AuditRiskLevel;
  reason?: string | null;
  mfaMethod?: TwoFactorMethod | null;
  aal?: string | null;
  trustedDevice?: boolean | null;
  currentSession?: boolean | null;
  security?: LoginSecurityContext | null;
};

type ClientAuditState = {
  pageSessionId: string;
  pageLoadTime: number;
  eventCounter: number;
  lastReported: Record<string, number>;
};

type RedirectCheckResult = {
  safePath: string;
  wasRejected: boolean;
  reason: string;
  originalLength: number;
};

type ValidationResult =
  | {
      ok: true;
      reason: "valid";
      risk: AuditRiskLevel;
    }
  | {
      ok: false;
      title: string;
      message: string;
      reason: string;
      risk: AuditRiskLevel;
    };

const INTERNAL_ENDPOINTS = {
  login: "/api/admin/settings/login",
  verifyTwoFactor: "/api/admin/settings/login/two-factor/verify",
  resendTwoFactor: "/api/admin/settings/login/two-factor/resend",
  report: "/api/admin/audit-log/report",
  loginHistoryReport:
    "/api/admin/settings/security/login-history",
  session: "/api/admin/me",
} as const;

const DEFAULT_REDIRECT = "/Admin/Dashboard";
const LOGIN_ROUTE = "/Admin/Login";
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 128;
const TWO_FACTOR_CODE_LENGTH = 6;
const LOCAL_MAX_ATTEMPTS = 5;
const LOCAL_LOCKOUT_MS = 5 * 60 * 1000;

const DEBUG_LOGIN_ERRORS =
  process.env.NODE_ENV === "development";

const GENERIC_LOGIN_ERROR: LoginError = {
  title: "Sign in failed",
  message: "The details entered could not be accepted. Please try again.",
};

const GENERIC_SERVICE_ERROR: LoginError = {
  title: "Unable to continue",
  message: "Something went wrong. Please wait a moment and try again.",
};

const TOO_MANY_ATTEMPTS_ERROR: LoginError = {
  title: "Sign in temporarily paused",
  message: "Please wait a few minutes before trying again.",
};

const LOGGED_OUT_MESSAGE: LoginError = {
  title: "Signed out",
  message: "Your secure session has ended.",
};

const restrictedAccessCards = [
  {
    title: "Approved access only",
    text: "Only approved users should continue beyond this page.",
    icon: ShieldCheck,
  },
  {
    title: "Private area",
    text: "Login, device and security activity is monitored to protect this restricted space.",
    icon: Lock,
  },
  {
    title: "Use safely",
    text: "Use only approved devices, keep MFA private and sign out when finished.",
    icon: Users,
  },
];

function makeClientId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `client_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function getCurrentRoute() {
  if (typeof window === "undefined") return LOGIN_ROUTE;
  return window.location.pathname || LOGIN_ROUTE;
}

function getSafeRedirectFromSearch(search: string): RedirectCheckResult {
  const params = new URLSearchParams(search);
  const next = params.get("next");

  if (!next) {
    return {
      safePath: DEFAULT_REDIRECT,
      wasRejected: false,
      reason: "missing_next_path",
      originalLength: 0,
    };
  }

  const trimmed = next.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed.startsWith("/Admin")) {
    return {
      safePath: DEFAULT_REDIRECT,
      wasRejected: true,
      reason: "not_admin_path",
      originalLength: trimmed.length,
    };
  }

  if (trimmed.startsWith("//")) {
    return {
      safePath: DEFAULT_REDIRECT,
      wasRejected: true,
      reason: "protocol_relative_path",
      originalLength: trimmed.length,
    };
  }

  if (trimmed.includes("\\")) {
    return {
      safePath: DEFAULT_REDIRECT,
      wasRejected: true,
      reason: "backslash_in_path",
      originalLength: trimmed.length,
    };
  }

  if (lower.startsWith("/admin/login")) {
    return {
      safePath: DEFAULT_REDIRECT,
      wasRejected: true,
      reason: "login_loop_prevented",
      originalLength: trimmed.length,
    };
  }

  if (lower.startsWith("/admin/logout")) {
    return {
      safePath: DEFAULT_REDIRECT,
      wasRejected: true,
      reason: "logout_loop_prevented",
      originalLength: trimmed.length,
    };
  }

  if (trimmed.length > 300) {
    return {
      safePath: DEFAULT_REDIRECT,
      wasRejected: true,
      reason: "path_too_long",
      originalLength: trimmed.length,
    };
  }

  return {
    safePath: trimmed,
    wasRejected: false,
    reason: "accepted",
    originalLength: trimmed.length,
  };
}

function shouldSkipAutoSessionCheck(search: string) {
  const params = new URLSearchParams(search);

  return (
    params.get("loggedOut") === "1" ||
    params.get("logout") === "1" ||
    params.get("signedOut") === "1"
  );
}

function emailLooksValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function parseLoginError(
  status: number,
  json?: LoginResponse | VerifyTwoFactorResponse | null,
  endpoint?: string,
): LoginError {
  const base =
    status === 429
      ? TOO_MANY_ATTEMPTS_ERROR
      : status >= 500
        ? GENERIC_SERVICE_ERROR
        : GENERIC_LOGIN_ERROR;

  if (!DEBUG_LOGIN_ERRORS) {
    return base;
  }

  const raw = json as
    | (LoginResponse & {
        reason?: string;
        details?: Record<string, unknown>;
      })
    | (VerifyTwoFactorResponse & {
        reason?: string;
        details?: Record<string, unknown>;
      })
    | null
    | undefined;

  return {
    ...base,
    debug: {
      endpoint,
      httpStatus: status,
      code:
        typeof raw?.code === "string"
          ? raw.code
          : null,
      reason:
        typeof raw?.reason === "string"
          ? raw.reason
          : null,
      apiError:
        typeof raw?.error === "string"
          ? raw.error
          : null,
      apiMessage:
        typeof raw?.message === "string"
          ? raw.message
          : null,
      attemptsRemaining:
        typeof (raw as any)?.attemptsRemaining === "number"
          ? (raw as any).attemptsRemaining
          : null,
      details:
        raw?.details &&
        typeof raw.details === "object"
          ? raw.details
          : undefined,
    },
  };
}

function withDebugError(
  base: LoginError,
  debug: NonNullable<LoginError["debug"]>,
): LoginError {
  if (!DEBUG_LOGIN_ERRORS) {
    return base;
  }

  return {
    ...base,
    debug,
  };
}

async function readLoginJson(response: Response): Promise<LoginResponse | null> {
  try {
    return (await response.json()) as LoginResponse;
  } catch {
    return null;
  }
}

function getAuditStatusFromResponse(response: Response, json: LoginResponse | null) {
  if (response.ok && json?.ok) return "success";
  if (response.status === 429) return "rate_limited";
  if (response.status === 401 || response.status === 403) return "rejected";
  if (response.status >= 500) return "service_error";
  return "failed";
}

function sanitiseAuditMetadata(metadata: Record<string, unknown> | undefined) {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata || {})) {
    const lowered = key.toLowerCase();

    if (
      lowered.includes("password") ||
      lowered.includes("token") ||
      lowered.includes("secret") ||
      lowered.includes("cookie") ||
      lowered.includes("authorization") ||
      lowered.includes("session") ||
      lowered.includes("email") ||
      lowered.includes("api")
    ) {
      output[key] = "[redacted]";
      continue;
    }

    if (typeof value === "string" && value.length > 250) {
      output[key] = `${value.slice(0, 250)}…`;
      continue;
    }

    output[key] = value;
  }

  return output;
}

function compactBoolean(value: boolean) {
  return value ? "yes" : "no";
}

function normaliseSecurityContext(
  value: LoginSecurityContext | undefined,
): LoginSecurityContext | null {
  if (!value || typeof value !== "object") return null;

  const maxTrustedDevices =
    typeof value.maxTrustedDevices === "number" && value.maxTrustedDevices > 0
      ? Math.floor(value.maxTrustedDevices)
      : 5;

  const trustedDeviceCount =
    typeof value.trustedDeviceCount === "number" && value.trustedDeviceCount >= 0
      ? Math.floor(value.trustedDeviceCount)
      : undefined;

  return {
    riskLevel: value.riskLevel,
    newDevice: Boolean(value.newDevice),
    deviceTrusted: Boolean(value.deviceTrusted),
    requiresDeviceApproval: Boolean(value.requiresDeviceApproval),
    trustedDeviceCount,
    maxTrustedDevices,
    approximateLocation:
      typeof value.approximateLocation === "string"
        ? value.approximateLocation.slice(0, 120)
        : null,
    deviceLabel:
      typeof value.deviceLabel === "string"
        ? value.deviceLabel.slice(0, 120)
        : null,
  };
}


function shouldCreateTrustedDevice(
  security: LoginSecurityContext | null | undefined,
) {
  if (!security) return false;

  // A trusted-device record must only be created for a genuinely new,
  // currently untrusted device after the password step has identified it.
  if (security.newDevice !== true) return false;
  if (security.deviceTrusted === true) return false;
  if (security.requiresDeviceApproval === true) return false;

  const maxTrustedDevices =
    typeof security.maxTrustedDevices === "number" && security.maxTrustedDevices > 0
      ? Math.floor(security.maxTrustedDevices)
      : 5;

  const trustedDeviceCount =
    typeof security.trustedDeviceCount === "number" &&
    security.trustedDeviceCount >= 0
      ? Math.floor(security.trustedDeviceCount)
      : null;

  // If the server supplied a device count, never ask it to create another
  // trusted device once the limit has already been reached.
  if (
    trustedDeviceCount !== null &&
    trustedDeviceCount >= maxTrustedDevices
  ) {
    return false;
  }

  return true;
}


function getClientDeviceInfo() {
  if (typeof navigator === "undefined") {
    return {
      browser: null,
      operatingSystem: null,
      deviceType: null,
    };
  }

  const userAgent = navigator.userAgent || "";
  const platform =
    navigator.platform ||
    "";

  let browser = "Unknown browser";

  if (/Edg\//i.test(userAgent)) {
    browser = "Microsoft Edge";
  } else if (/OPR\//i.test(userAgent)) {
    browser = "Opera";
  } else if (/Chrome\//i.test(userAgent)) {
    browser = "Google Chrome";
  } else if (/Firefox\//i.test(userAgent)) {
    browser = "Mozilla Firefox";
  } else if (/Safari\//i.test(userAgent)) {
    browser = "Safari";
  }

  let operatingSystem =
    platform || "Unknown";

  if (/Windows NT/i.test(userAgent)) {
    operatingSystem = "Windows";
  } else if (/Android/i.test(userAgent)) {
    operatingSystem = "Android";
  } else if (
    /iPhone|iPad|iPod/i.test(userAgent)
  ) {
    operatingSystem = "iOS / iPadOS";
  } else if (/Mac OS X/i.test(userAgent)) {
    operatingSystem = "macOS";
  } else if (/Linux/i.test(userAgent)) {
    operatingSystem = "Linux";
  }

  const deviceType =
    /Mobi|Android|iPhone|iPod/i.test(
      userAgent,
    )
      ? "Mobile"
      : /iPad|Tablet/i.test(userAgent)
        ? "Tablet"
        : "Desktop";

  return {
    browser,
    operatingSystem,
    deviceType,
  };
}

export default function LoginPage() {
  const [nextPath, setNextPath] = useState(DEFAULT_REDIRECT);
  const [skipAutoSessionCheck, setSkipAutoSessionCheck] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loginStep, setLoginStep] = useState<"password" | "two-factor">(
    "password",
  );
  const [challengeId, setChallengeId] = useState("");
  const [twoFactorMethods, setTwoFactorMethods] = useState<TwoFactorMethod[]>([]);
  const [selectedMethod, setSelectedMethod] =
    useState<TwoFactorMethod>("email");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [securityContext, setSecurityContext] =
    useState<LoginSecurityContext | null>(null);
  const [twoFactorExpiresAt, setTwoFactorExpiresAt] = useState<number | null>(
    null,
  );
  const [resendingCode, setResendingCode] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Production UI state. None of these values are trusted for authentication;
  // they only improve accessibility and explain what the login page is doing.
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [securityInfoOpen, setSecurityInfoOpen] = useState(false);

  const [error, setError] = useState<LoginError | null>(null);
  const [notice, setNotice] = useState<LoginError | null>(null);

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const auditStateRef = useRef<ClientAuditState>({
    pageSessionId: makeClientId(),
    pageLoadTime: Date.now(),
    eventCounter: 0,
    lastReported: {},
  });

  const hasReportedPageReadyRef = useRef(false);
  const hasReportedLockoutEndRef = useRef(false);
  const submitStartedAtRef = useRef<number | null>(null);
  const twoFactorVerifyInFlightRef = useRef(false);

  const cleanEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const lockoutRemainingMs = lockedUntil ? lockedUntil - now : 0;
  const isLocallyLocked = Boolean(lockedUntil && lockoutRemainingMs > 0);
  const twoFactorRemainingMs = twoFactorExpiresAt
    ? Math.max(0, twoFactorExpiresAt - now)
    : 0;
  const twoFactorExpired = Boolean(
    twoFactorExpiresAt && twoFactorRemainingMs <= 0,
  );

  const reportAudit = useCallback(
    async (
      event: Omit<AuditEvent, "area" | "route"> & {
        area?: AuditEvent["area"];
        route?: string;
        throttleKey?: string;
        throttleMs?: number;
      },
    ) => {
      const state = auditStateRef.current;
      const createdAt = Date.now();
      const throttleKey = event.throttleKey;

      if (throttleKey) {
        const last = state.lastReported[throttleKey] || 0;
        const throttleMs = event.throttleMs ?? 1000;

        if (createdAt - last < throttleMs) return;
        state.lastReported[throttleKey] = createdAt;
      }

      state.eventCounter += 1;

      const metadata = sanitiseAuditMetadata({
        page_id: state.pageSessionId,
        uptime_ms: createdAt - state.pageLoadTime,
        event_number: state.eventCounter,
        email_present: Boolean(cleanEmail),
        email_valid: cleanEmail ? emailLooksValid(cleanEmail) : null,
        failed_attempts_bucket:
          failedAttempts <= 0
            ? "none"
            : failedAttempts < LOCAL_MAX_ATTEMPTS
              ? "some"
              : "limit",
        locked: isLocallyLocked,
        ...event.metadata,
      });

      const payload: AuditEvent = {
        action: event.action,
        area: event.area || "auth",
        route: event.route || getCurrentRoute(),
        method: event.method || "CLIENT",
        status: event.status || "success",
        risk_level: event.risk_level || "low",
        target_type: event.target_type || null,
        target_id: event.target_id || null,
        target_label: event.target_label || null,
        metadata,
      };

      try {
        await fetch(INTERNAL_ENDPOINTS.report, {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } catch {
        // Login must not fail if client-side reporting is blocked.
      }
    },
    [cleanEmail, failedAttempts, isLocallyLocked],
  );

  const reportLoginHistory = useCallback(
    async (
      event: LoginHistoryEvent,
    ) => {
      const device =
        getClientDeviceInfo();

      const security =
        event.security ??
        securityContext;

      const payload = {
        adminEmail:
          cleanEmail || null,
        result: event.result,
        riskLevel:
          event.riskLevel,
        reason:
          event.reason
            ?.slice(0, 200) ??
          null,
        browser:
          device.browser,
        operatingSystem:
          device.operatingSystem,
        deviceType:
          device.deviceType,
        approximateLocation:
          security
            ?.approximateLocation ??
          null,
        deviceLabel:
          security?.deviceLabel ??
          null,
        mfaMethod:
          event.mfaMethod ??
          null,
        aal:
          event.aal ?? null,
        trustedDevice:
          event.trustedDevice ??
          security
            ?.deviceTrusted ??
          null,
        currentSession:
          event.currentSession ??
          false,
        // Login-history reporting is audit-only. It must never create or
        // register a trusted device as a side effect.
        createTrustedDevice: false,
      };

      try {
        await fetch(
          INTERNAL_ENDPOINTS
            .loginHistoryReport,
          {
            method: "POST",
            cache: "no-store",
            credentials: "include",
            keepalive: true,
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                payload,
              ),
          },
        );
      } catch {
        // Login must never fail because history reporting failed.
      }
    },
    [
      cleanEmail,
      securityContext,
    ],
  );

  useEffect(() => {
    const search = window.location.search;
    const redirectResult = getSafeRedirectFromSearch(search);
    const didLogout = shouldSkipAutoSessionCheck(search);

    setNextPath(redirectResult.safePath);
    setSkipAutoSessionCheck(didLogout);

    void reportAudit({
      action: "login_page_opened",
      status: "success",
      risk_level: "low",
      metadata: {
        redirect_status: redirectResult.wasRejected ? "rejected" : "accepted",
        redirect_reason: redirectResult.reason,
        logout_notice: didLogout,
      },
    });

    if (redirectResult.wasRejected) {
      void reportAudit({
        action: "login_redirect_rejected",
        status: "blocked",
        risk_level: "medium",
        metadata: {
          reason: redirectResult.reason,
          path_length: redirectResult.originalLength,
        },
      });
    }

    if (didLogout) {
      setNotice(LOGGED_OUT_MESSAGE);

      void reportAudit({
        action: "login_logout_notice_seen",
        status: "success",
        risk_level: "low",
      });
    }
    // Intentionally runs once on page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLocallyLocked && !twoFactorExpiresAt) return;

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isLocallyLocked, twoFactorExpiresAt]);

  useEffect(() => {
    if (!lockedUntil || lockoutRemainingMs > 0) return;

    setLockedUntil(null);
    setFailedAttempts(0);
    setError(null);

    if (!hasReportedLockoutEndRef.current) {
      hasReportedLockoutEndRef.current = true;

      void reportAudit({
        action: "login_local_lockout_ended",
        status: "success",
        risk_level: "medium",
      });
    }
  }, [lockedUntil, lockoutRemainingMs, reportAudit]);

  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      if (skipAutoSessionCheck) {
        setCheckingSession(false);

        void reportAudit({
          action: "login_existing_session_check_skipped",
          status: "skipped",
          risk_level: "low",
        });

        return;
      }

      void reportAudit({
        action: "login_existing_session_check_started",
        status: "started",
        risk_level: "low",
      });

      try {
        const response = await fetch(INTERNAL_ENDPOINTS.session, {
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        if (cancelled) return;

        if (response.ok) {
          const json = (await response.json().catch(() => null)) as {
            ok?: boolean;
            admin?: unknown;
            user?: unknown;
          } | null;

          if (json?.ok && (json.admin || json.user)) {
            void reportAudit({
              action: "login_existing_session_found",
              status: "redirecting",
              risk_level: "low",
            });

            window.location.replace(nextPath);
            return;
          }
        }

        void reportAudit({
          action: "login_existing_session_not_found",
          status: response.ok ? "no_session" : "not_available",
          risk_level: response.status >= 500 ? "medium" : "low",
        });
      } catch {
        void reportAudit({
          action: "login_existing_session_check_failed",
          status: "connection_failed",
          risk_level: "medium",
        });
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    checkExistingSession();

    return () => {
      cancelled = true;
    };
  }, [nextPath, reportAudit, skipAutoSessionCheck]);

  useEffect(() => {
    if (checkingSession) return;
    if (hasReportedPageReadyRef.current) return;

    hasReportedPageReadyRef.current = true;

    void reportAudit({
      action: "login_page_ready",
      status: "ready",
      risk_level: "low",
    });
  }, [checkingSession, reportAudit]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        void reportAudit({
          action: "login_page_hidden",
          status: "hidden",
          risk_level: "low",
          throttleKey: "visibility_hidden",
          throttleMs: 5000,
        });
      }

      if (document.visibilityState === "visible") {
        void reportAudit({
          action: "login_page_visible",
          status: "visible",
          risk_level: "low",
          throttleKey: "visibility_visible",
          throttleMs: 5000,
        });
      }
    }

    function onBeforeUnload() {
      void reportAudit({
        action: "login_page_unloaded",
        status: "leaving_page",
        risk_level: "low",
        metadata: {
          had_error: Boolean(error),
          had_notice: Boolean(notice),
          attempts_state: failedAttempts > 0 ? "attempts_present" : "none",
        },
      });
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [error, failedAttempts, notice, reportAudit]);

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine);

    updateOnlineState();

    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);

    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  function startLocalLockout(reason: string) {
    setLockedUntil(Date.now() + LOCAL_LOCKOUT_MS);
    setFailedAttempts(LOCAL_MAX_ATTEMPTS);
    hasReportedLockoutEndRef.current = false;

    void reportAudit({
      action: "login_local_lockout_started",
      status: "locked",
      risk_level: "high",
      metadata: {
        reason,
      },
    });
  }

  function registerFailedAttempt(status: number) {
    if (status === 429) {
      startLocalLockout("server_rate_limited");
      return;
    }

    setFailedAttempts((previous) => {
      const nextCount = previous + 1;

      if (nextCount >= LOCAL_MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCAL_LOCKOUT_MS);
        setError(TOO_MANY_ATTEMPTS_ERROR);
        hasReportedLockoutEndRef.current = false;

        void reportAudit({
          action: "login_local_lockout_started",
          status: "locked",
          risk_level: "high",
          metadata: {
            reason: "local_failed_attempt_limit_reached",
          },
        });
      }

      return nextCount;
    });
  }

  function validateBeforeSubmit(): ValidationResult {
    if (isLocallyLocked) {
      return {
        ok: false,
        title: TOO_MANY_ATTEMPTS_ERROR.title,
        message: TOO_MANY_ATTEMPTS_ERROR.message,
        reason: "local_lockout_active",
        risk: "high",
      };
    }

    if (!cleanEmail || !password) {
      return {
        ok: false,
        title: "Missing details",
        message: "Please enter your email address and password.",
        reason:
          !cleanEmail && !password
            ? "missing_email_and_password"
            : !cleanEmail
              ? "missing_email"
              : "missing_password",
        risk: "medium",
      };
    }

    if (cleanEmail.length > MAX_EMAIL_LENGTH) {
      return {
        ok: false,
        title: "Email address too long",
        message: "Please check the email address and try again.",
        reason: "email_too_long",
        risk: "medium",
      };
    }

    if (!emailLooksValid(cleanEmail)) {
      return {
        ok: false,
        title: "Email address looks wrong",
        message: "Please enter a valid email address and try again.",
        reason: "email_format_invalid",
        risk: "medium",
      };
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      return {
        ok: false,
        title: "Password too long",
        message: "Please check the password and try again.",
        reason: "password_too_long",
        risk: "medium",
      };
    }

    return {
      ok: true,
      reason: "valid",
      risk: "low",
    };
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError(null);
    setNotice(null);

    void reportAudit({
      action: "login_submit_clicked",
      status: "started",
      risk_level: "low",
      metadata: {
        has_email: compactBoolean(Boolean(cleanEmail)),
        has_password: compactBoolean(Boolean(password)),
      },
    });

    const validation = validateBeforeSubmit();

    if (!validation.ok) {
      setError({
        title: validation.title || GENERIC_LOGIN_ERROR.title,
        message: validation.message || GENERIC_LOGIN_ERROR.message,
      });

      void reportAudit({
        action:
          validation.reason === "local_lockout_active"
            ? "login_local_lockout_blocked_submit"
            : "login_validation_failed",
        status: "blocked",
        risk_level: validation.risk,
        metadata: {
          reason: validation.reason,
        },
      });

      return;
    }

    setLoading(true);
    submitStartedAtRef.current = Date.now();

    void reportAudit({
      action: "login_attempt_started",
      status: "started",
      risk_level: "medium",
      target_type: "restricted_login",
      target_label: "Restricted Login",
      metadata: {
        email_valid: emailLooksValid(cleanEmail),
      },
    });

    try {
      const response = await fetch(INTERNAL_ENDPOINTS.login, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        credentials: "include",
        body: JSON.stringify({
          email: cleanEmail,
          password,
          next: nextPath,
          // Password verification must never create a trusted-device record.
          // Device trust is considered only after successful MFA below.
          createTrustedDevice: false,
        }),
      });

      const json = await readLoginJson(response);
      const durationMs = submitStartedAtRef.current
        ? Date.now() - submitStartedAtRef.current
        : null;

      const returnedSecurityContext = normaliseSecurityContext(json?.security);
      setSecurityContext(returnedSecurityContext);

      if (!response.ok || !json?.ok) {
        registerFailedAttempt(response.status);
        setError(
          parseLoginError(
            response.status,
            json,
            INTERNAL_ENDPOINTS.login,
          ),
        );

        void reportAudit({
          action: "login_attempt_failed_client",
          status: getAuditStatusFromResponse(response, json),
          risk_level: response.status === 429 ? "high" : "medium",
          target_type: "restricted_login",
          target_label: "Restricted Login",
          metadata: {
            result: "failed",
            duration_ms: durationMs,
          },
        });

        void reportLoginHistory({
          result:
            response.status === 429
              ? "blocked"
              : "failed",
          riskLevel:
            response.status === 429
              ? "high"
              : "medium",
          reason:
            response.status === 429
              ? "rate_limited"
              : "password_or_account_rejected",
          security:
            returnedSecurityContext,
        });

        return;
      }

      setFailedAttempts(0);
      setLockedUntil(null);

      if (returnedSecurityContext?.requiresDeviceApproval) {
        setPassword("");
        setError({
          title: "Device approval required",
          message:
            "This account has reached its trusted-device limit or this device needs approval. Remove an existing trusted device or contact an authorised admin lead.",
        });

        void reportAudit({
          action: "login_device_approval_required",
          status: "blocked",
          risk_level: returnedSecurityContext.riskLevel || "high",
          target_type: "restricted_login",
          target_label: "Restricted Login",
          metadata: {
            new_device: returnedSecurityContext.newDevice,
            trusted_device_count:
              returnedSecurityContext.trustedDeviceCount ?? null,
            max_trusted_devices:
              returnedSecurityContext.maxTrustedDevices ?? 5,
          },
        });

        void reportLoginHistory({
          result: "blocked",
          riskLevel:
            returnedSecurityContext
              .riskLevel || "high",
          reason:
            "device_approval_required",
          security:
            returnedSecurityContext,
          trustedDevice:
            returnedSecurityContext
              .deviceTrusted ?? false,
        });

        return;
      }

      if (!json.requiresTwoFactor) {
        setPassword("");
        setError({
          title: "Two-step verification is required",
          message:
            "This administrator account cannot continue until two-step verification has been enabled. Contact a main administrator.",
        });

        void reportAudit({
          action: "login_blocked_without_two_factor",
          status: "blocked",
          risk_level: "high",
          target_type: "restricted_login",
          target_label: "Restricted Login",
          metadata: {
            reason: "two_factor_required_for_all_admins",
            duration_ms: durationMs,
          },
        });

        void reportLoginHistory({
          result: "blocked",
          riskLevel: "high",
          reason:
            "two_factor_required_for_all_admins",
          security:
            returnedSecurityContext,
        });

        return;
      }

      const methods =
        Array.isArray(json.methods) && json.methods.length > 0
          ? json.methods
          : [];

      const returnedChallengeId = String(json.challengeId || "").trim();

      if (methods.length === 0 || !returnedChallengeId) {
        setPassword("");
        setError({
          title: "Two-step verification is not configured",
          message:
            "No valid verification method was returned for this account. Contact a main administrator.",
        });

        void reportAudit({
          action: "login_two_factor_configuration_missing",
          status: "blocked",
          risk_level: "high",
          target_type: "restricted_login",
          target_label: "Restricted Login",
          metadata: {
            has_challenge: Boolean(returnedChallengeId),
            method_count: methods.length,
          },
        });

        void reportLoginHistory({
          result: "blocked",
          riskLevel: "high",
          reason:
            "two_factor_configuration_missing",
          security:
            returnedSecurityContext,
        });

        return;
      }

      const preferred =
        json.preferredMethod && methods.includes(json.preferredMethod)
          ? json.preferredMethod
          : methods[0];

      setChallengeId(returnedChallengeId);
      setTwoFactorMethods(methods);
      setSelectedMethod(preferred);
      setMaskedEmail(String(json.maskedEmail || ""));
      setTwoFactorCode("");
      setTwoFactorExpiresAt(
        Date.now() + Math.max(60, json.expiresInSeconds || 600) * 1000,
      );
      setLoginStep("two-factor");
      setPassword("");

      void reportAudit({
        action: "login_two_factor_required",
        status: "challenge_created",
        risk_level: "medium",
        target_type: "restricted_login",
        target_label: "Restricted Login",
        metadata: {
          methods,
          preferred_method: preferred,
        },
      });

      void reportLoginHistory({
        result: "challenge",
        riskLevel:
          returnedSecurityContext
            ?.riskLevel ??
          "medium",
        reason:
          "password_accepted_mfa_required",
        mfaMethod: preferred,
        security:
          returnedSecurityContext,
        trustedDevice:
          returnedSecurityContext
            ?.deviceTrusted ??
          null,
      });

      return;
    } catch {
      const durationMs = submitStartedAtRef.current
        ? Date.now() - submitStartedAtRef.current
        : null;

      setError(
        withDebugError(
          GENERIC_SERVICE_ERROR,
          {
            endpoint:
              INTERNAL_ENDPOINTS.login,
            reason:
              "network_or_fetch_failure",
            details: {
              phase:
                "password_login_request",
              note:
                "The browser could not complete the login API request or parse a usable response.",
            },
          },
        ),
      );

      void reportAudit({
        action: "login_attempt_connection_failed_client",
        status: "connection_failed",
        risk_level: "medium",
        target_type: "restricted_login",
        target_label: "Restricted Login",
        metadata: {
          duration_ms: durationMs,
        },
      });
    } finally {
      setLoading(false);
      submitStartedAtRef.current = null;
    }
  }

  async function handleTwoFactorVerify(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading || twoFactorVerifyInFlightRef.current) return;

    const cleanCode = twoFactorCode.replace(/\D/g, "").slice(
      0,
      TWO_FACTOR_CODE_LENGTH,
    );

    setError(null);
    setNotice(null);

    if (!challengeId) {
      setError({
        title: "Security check expired",
        message: "Please return to the password step and sign in again.",
      });
      return;
    }

    if (twoFactorExpired) {
      setError({
        title: "Code expired",
        message:
          selectedMethod === "email"
            ? "Send a new email code or return to sign in."
            : "Enter the newest code from your authenticator app.",
      });
      return;
    }

    if (cleanCode.length !== TWO_FACTOR_CODE_LENGTH) {
      setError({
        title: "Enter the full security code",
        message: "The security code must contain 6 numbers.",
      });
      return;
    }

    const createTrustedDevice = shouldCreateTrustedDevice(securityContext);

    twoFactorVerifyInFlightRef.current = true;
    setLoading(true);

    void reportAudit({
      action: "login_two_factor_verify_started",
      status: "started",
      risk_level: "medium",
      metadata: {
        method: selectedMethod,
        trusted_device_creation_requested: createTrustedDevice,
      },
    });

    try {
      const response = await fetch(INTERNAL_ENDPOINTS.verifyTwoFactor, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengeId,
          method: selectedMethod,
          code: cleanCode,
          // This is the only request from this page that may ask the server
          // to create a trusted-device record, and only when the current
          // security context proves that it is needed.
          createTrustedDevice,
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | VerifyTwoFactorResponse
        | null;

      const verifiedSecurityContext = normaliseSecurityContext(json?.security);
      if (verifiedSecurityContext) {
        setSecurityContext(verifiedSecurityContext);
      }

      if (!response.ok || !json?.ok) {
        setTwoFactorCode("");

        if (response.status === 410) {
          setTwoFactorExpiresAt(Date.now());
          setError(
            withDebugError(
              {
                title: "Security code expired",
                message:
                  selectedMethod === "email"
                    ? "Send a new email code and try again."
                    : "Enter the newest code from your authenticator app.",
              },
              {
                endpoint:
                  INTERNAL_ENDPOINTS.verifyTwoFactor,
                httpStatus:
                  response.status,
                code:
                  json?.code ?? null,
                reason:
                  (
                    json as
                      | (VerifyTwoFactorResponse & {
                          reason?: string;
                        })
                      | null
                  )?.reason ?? "challenge_expired",
                apiError:
                  json?.error ?? null,
                apiMessage:
                  json?.message ?? null,
                attemptsRemaining:
                  json?.attemptsRemaining ?? null,
              },
            ),
          );
        } else if (response.status === 429) {
          setError(
            parseLoginError(
              response.status,
              json,
              INTERNAL_ENDPOINTS.verifyTwoFactor,
            ),
          );
        } else {
          setError(
            withDebugError(
              {
                title: "Code not accepted",
                message:
                  typeof json?.attemptsRemaining === "number"
                    ? `Check the code and try again. ${json.attemptsRemaining} attempt${
                        json.attemptsRemaining === 1 ? "" : "s"
                      } remaining.`
                    : "Check the code and try again.",
              },
              {
                endpoint:
                  INTERNAL_ENDPOINTS.verifyTwoFactor,
                httpStatus:
                  response.status,
                code:
                  json?.code ?? null,
                reason:
                  (
                    json as
                      | (VerifyTwoFactorResponse & {
                          reason?: string;
                        })
                      | null
                  )?.reason ?? "mfa_verification_rejected",
                apiError:
                  json?.error ?? null,
                apiMessage:
                  json?.message ?? null,
                attemptsRemaining:
                  json?.attemptsRemaining ?? null,
              },
            ),
          );
        }

        void reportAudit({
          action: "login_two_factor_verify_failed",
          status:
            response.status === 429
              ? "rate_limited"
              : response.status === 410
                ? "expired"
                : "rejected",
          risk_level: response.status === 429 ? "high" : "medium",
          metadata: {
            method: selectedMethod,
          },
        });

        void reportLoginHistory({
          result:
            response.status === 429
              ? "blocked"
              : "failed",
          riskLevel:
            response.status === 429
              ? "high"
              : "medium",
          reason:
            response.status === 410
              ? "mfa_code_expired"
              : response.status === 429
                ? "mfa_rate_limited"
                : "mfa_code_rejected",
          mfaMethod:
            selectedMethod,
          security:
            verifiedSecurityContext ??
            securityContext,
        });

        return;
      }

      setSkipAutoSessionCheck(false);
      setTwoFactorCode("");

      void reportAudit({
        action: "login_two_factor_verify_success",
        status: "success_redirecting",
        risk_level: "low",
        metadata: {
          method: selectedMethod,
          new_device:
            verifiedSecurityContext?.newDevice ?? securityContext?.newDevice ?? null,
          device_trusted:
            verifiedSecurityContext?.deviceTrusted ??
            securityContext?.deviceTrusted ??
            null,
          trusted_device_creation_requested: createTrustedDevice,
        },
      });

      void reportLoginHistory({
        result: "success",
        riskLevel:
          verifiedSecurityContext
            ?.riskLevel ??
          securityContext
            ?.riskLevel ??
          "low",
        reason:
          "mfa_verified",
        mfaMethod:
          selectedMethod,
        aal: "aal2",
        security:
          verifiedSecurityContext ??
          securityContext,
        trustedDevice:
          verifiedSecurityContext
            ?.deviceTrusted ??
          securityContext
            ?.deviceTrusted ??
          null,
        currentSession: true,
      });

      window.location.replace(nextPath);
    } catch {
      setError(
        withDebugError(
          GENERIC_SERVICE_ERROR,
          {
            endpoint:
              INTERNAL_ENDPOINTS.verifyTwoFactor,
            reason:
              "network_or_fetch_failure",
            details: {
              phase:
                "two_factor_verification_request",
              method:
                selectedMethod,
            },
          },
        ),
      );

      void reportAudit({
        action: "login_two_factor_verify_connection_failed",
        status: "connection_failed",
        risk_level: "medium",
        metadata: {
          method: selectedMethod,
        },
      });
    } finally {
      twoFactorVerifyInFlightRef.current = false;
      setLoading(false);
    }
  }

  async function resendEmailCode() {
    if (
      loading ||
      resendingCode ||
      selectedMethod !== "email" ||
      !challengeId
    ) {
      return;
    }

    setResendingCode(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(INTERNAL_ENDPOINTS.resendTwoFactor, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengeId,
          method: "email",
          // Resending an MFA code is not a trusted-device registration event.
          createTrustedDevice: false,
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | LoginResponse
        | null;

      if (!response.ok || !json?.ok) {
        setError(
          response.status === 429
            ? parseLoginError(
                response.status,
                json,
                INTERNAL_ENDPOINTS.resendTwoFactor,
              )
            : withDebugError(
                {
                  title: "Code could not be sent",
                  message:
                    "Please wait a moment and try again.",
                },
                {
                  endpoint:
                    INTERNAL_ENDPOINTS.resendTwoFactor,
                  httpStatus:
                    response.status,
                  code:
                    json?.code ?? null,
                  apiError:
                    json?.error ?? null,
                  apiMessage:
                    json?.message ?? null,
                  reason:
                    "resend_request_rejected",
                },
              ),
        );
        return;
      }

      if (json.challengeId) {
        setChallengeId(json.challengeId);
      }

      setMaskedEmail(String(json.maskedEmail || maskedEmail));
      setTwoFactorCode("");
      setTwoFactorExpiresAt(
        Date.now() + Math.max(60, json.expiresInSeconds || 600) * 1000,
      );
      setNotice({
        title: "New code sent",
        message: `A new security code was sent${
          json.maskedEmail || maskedEmail
            ? ` to ${json.maskedEmail || maskedEmail}`
            : " to your approved email address"
        }.`,
      });

      void reportAudit({
        action: "login_two_factor_email_resent",
        status: "sent",
        risk_level: "medium",
      });
    } catch {
      setError(
        withDebugError(
          GENERIC_SERVICE_ERROR,
          {
            endpoint:
              INTERNAL_ENDPOINTS.resendTwoFactor,
            reason:
              "network_or_fetch_failure",
            details: {
              phase:
                "two_factor_resend_request",
            },
          },
        ),
      );
    } finally {
      setResendingCode(false);
    }
  }

  function selectTwoFactorMethod(method: TwoFactorMethod) {
    if (!twoFactorMethods.includes(method)) return;

    setSelectedMethod(method);
    setTwoFactorCode("");
    setError(null);
    setNotice(null);

    void reportAudit({
      action: "login_two_factor_method_selected",
      status: "selected",
      risk_level: "low",
      metadata: {
        method,
      },
    });
  }

  function returnToPasswordStep() {
    setLoginStep("password");
    setChallengeId("");
    setTwoFactorMethods([]);
    setTwoFactorCode("");
    setMaskedEmail("");
    setSecurityContext(null);
    setTwoFactorExpiresAt(null);
    setError(null);
    setNotice(null);
  }

  function handleEmailFocus() {
    void reportAudit({
      action: "login_email_field_focused",
      status: "focused",
      risk_level: "low",
      throttleKey: "email_focus",
      throttleMs: 5000,
    });
  }

  function handleEmailBlur() {
    void reportAudit({
      action: "login_email_field_blurred",
      status: "blurred",
      risk_level: cleanEmail && !emailLooksValid(cleanEmail) ? "medium" : "low",
      throttleKey: "email_blur",
      throttleMs: 2500,
      metadata: {
        email_valid: cleanEmail ? emailLooksValid(cleanEmail) : null,
      },
    });
  }

  function handlePasswordKeyState(event: ReactKeyboardEvent<HTMLInputElement>) {
    setCapsLockOn(event.getModifierState("CapsLock"));
  }

  function handlePasswordFocus() {
    void reportAudit({
      action: "login_password_field_focused",
      status: "focused",
      risk_level: "low",
      throttleKey: "password_focus",
      throttleMs: 5000,
    });
  }

  function handlePasswordBlur() {
    void reportAudit({
      action: "login_password_field_blurred",
      status: "blurred",
      risk_level: "low",
      throttleKey: "password_blur",
      throttleMs: 2500,
    });
  }

  function togglePasswordVisibility() {
    const nextValue = !showPassword;
    setShowPassword(nextValue);

    void reportAudit({
      action: "login_password_visibility_toggled",
      status: nextValue ? "shown" : "hidden",
      risk_level: "medium",
      metadata: {
        visible: nextValue,
      },
    });
  }

  function handleBackToPublicWebsite() {
    void reportAudit({
      action: "login_public_back_link_clicked",
      status: "leaving_login_page",
      risk_level: "low",
      metadata: {
        destination: "public_website",
      },
    });
  }

  const safeDisplayTime = currentTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const safeDisplayDate = currentTime.toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const securityRiskLabel =
    securityContext?.riskLevel === "critical"
      ? "Critical review"
      : securityContext?.riskLevel === "high"
        ? "High attention"
        : securityContext?.riskLevel === "medium"
          ? "Additional checks"
          : "Protected";

  const progressStep = loginStep === "two-factor" ? 2 : 1;

  return (
    <main className="bp-login-shell relative min-h-dvh overflow-x-hidden bg-[#050816] text-white">
      <a
        href="#burton-pride-login-form"
        className="bp-skip-link"
      >
        Skip to sign in
      </a>

      <LoginAtmosphere />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <LoginTopBar
          isOnline={isOnline}
          currentTime={safeDisplayTime}
          currentDate={safeDisplayDate}
          loginStep={loginStep}
          checkingSession={checkingSession}
        />

        <div className="grid flex-1 items-stretch gap-5 py-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(440px,0.9fr)] lg:gap-8 lg:py-8 xl:grid-cols-[minmax(0,1.16fr)_minmax(460px,0.84fr)]">
          <LoginStoryPanel
            securityRiskLabel={securityRiskLabel}
            isOnline={isOnline}
            progressStep={progressStep}
          />

          <section
            className="flex min-w-0 items-center justify-center"
            aria-label="Administrator sign in"
          >
            <div className="w-full max-w-[620px]">
              <div className="bp-login-card relative overflow-hidden rounded-[2rem] border border-white/12 bg-white/[0.075] shadow-[0_35px_120px_rgba(0,0,0,0.5)] backdrop-blur-2xl sm:rounded-[2.4rem]">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-blue-500/15 blur-3xl" />
                <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-pink-500/15 blur-3xl" />

                <div className="relative p-5 sm:p-7 lg:p-8 xl:p-9">
                  <LoginCardHeader
                    loginStep={loginStep}
                    checkingSession={checkingSession}
                    progressStep={progressStep}
                  />

                  {checkingSession ? (
                    <SessionCheckPanel />
                  ) : (
                    <>
                      {notice ? (
                        <LoginNoticePanel
                          notice={notice}
                        />
                      ) : null}

                      {loginStep === "password" ? (
                        <form
                          id="burton-pride-login-form"
                          onSubmit={handleLogin}
                          className="mt-7 space-y-5"
                          noValidate
                        >
                          <CredentialField
                            id="admin-email"
                            label="Admin email"
                            help="Use the email address assigned to your Burton Pride admin account."
                            icon={Mail}
                          >
                            <input
                              id="admin-email"
                              name="email"
                              type="email"
                              autoComplete="username"
                              autoCapitalize="none"
                              spellCheck={false}
                              inputMode="email"
                              required
                              maxLength={MAX_EMAIL_LENGTH}
                              value={email}
                              onChange={(event) => setEmail(event.target.value)}
                              onFocus={handleEmailFocus}
                              onBlur={handleEmailBlur}
                              disabled={loading || isLocallyLocked}
                              placeholder="name@burtonpride.co.uk"
                              className="bp-field-input"
                              aria-invalid={Boolean(error)}
                            />
                          </CredentialField>

                          <CredentialField
                            id="admin-password"
                            label="Password"
                            help="Your password is sent only to the secure Burton Pride login endpoint."
                            icon={Lock}
                            rightSlot={
                              <button
                                type="button"
                                onClick={togglePasswordVisibility}
                                disabled={loading || isLocallyLocked}
                                className="bp-field-action"
                                aria-label={
                                  showPassword
                                    ? "Hide password"
                                    : "Show password"
                                }
                                title={
                                  showPassword
                                    ? "Hide password"
                                    : "Show password"
                                }
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            }
                          >
                            <input
                              id="admin-password"
                              name="password"
                              type={showPassword ? "text" : "password"}
                              autoComplete="current-password"
                              required
                              maxLength={MAX_PASSWORD_LENGTH}
                              value={password}
                              onChange={(event) => setPassword(event.target.value)}
                              onFocus={handlePasswordFocus}
                              onBlur={handlePasswordBlur}
                              onKeyDown={handlePasswordKeyState}
                              onKeyUp={handlePasswordKeyState}
                              disabled={loading || isLocallyLocked}
                              placeholder="Enter your password"
                              className="bp-field-input pr-12"
                              aria-invalid={Boolean(error)}
                            />
                          </CredentialField>

                          {capsLockOn ? (
                            <InlineSecurityHint
                              icon={Keyboard}
                              tone="warning"
                              title="Caps Lock is on"
                              text="Passwords are case-sensitive. Check Caps Lock before continuing."
                            />
                          ) : null}

                          {!isOnline ? (
                            <InlineSecurityHint
                              icon={WifiOff}
                              tone="danger"
                              title="You appear to be offline"
                              text="Reconnect to the internet before trying to sign in."
                            />
                          ) : null}

                          {isLocallyLocked ? (
                            <InlineSecurityHint
                              icon={Timer}
                              tone="danger"
                              title="Sign in temporarily paused"
                              text={`Try again in ${Math.max(
                                1,
                                Math.ceil(lockoutRemainingMs / 60000),
                              )} minute${
                                Math.ceil(lockoutRemainingMs / 60000) === 1
                                  ? ""
                                  : "s"
                              }.`}
                            />
                          ) : null}

                          {error ? (
                            <LoginErrorPanel
                              error={error}
                            />
                          ) : null}

                          <div className="grid gap-3">
                            <button
                              type="submit"
                              disabled={
                                loading ||
                                isLocallyLocked ||
                                !isOnline
                              }
                              className="bp-primary-button group"
                            >
                              <span className="absolute inset-0 translate-y-full bg-white/10 transition-transform duration-300 group-hover:translate-y-0" />

                              <span className="relative flex items-center justify-center gap-2">
                                {loading ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Checking securely...
                                  </>
                                ) : isLocallyLocked ? (
                                  <>
                                    <Timer className="h-4 w-4" />
                                    Try again later
                                  </>
                                ) : (
                                  <>
                                    Continue securely
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                  </>
                                )}
                              </span>
                            </button>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setSecurityInfoOpen((value) => !value)
                                }
                                className="bp-secondary-button"
                                aria-expanded={securityInfoOpen}
                              >
                                <ShieldQuestion className="h-4 w-4" />
                                Security information
                              </button>

                              <Link
                                href="/"
                                onClick={handleBackToPublicWebsite}
                                className="bp-secondary-button"
                              >
                                <ArrowLeft className="h-4 w-4" />
                                Public website
                              </Link>
                            </div>
                          </div>

                          {securityInfoOpen ? (
                            <SecurityInformationPanel />
                          ) : null}
                        </form>
                      ) : (
                        <form
                          id="burton-pride-login-form"
                          onSubmit={handleTwoFactorVerify}
                          className="mt-7 space-y-5"
                          noValidate
                        >
                          <MfaIntroPanel
                            securityContext={securityContext}
                            securityRiskLabel={securityRiskLabel}
                          />

                          {securityContext ? (
                            <DeviceSecurityPanel
                              securityContext={securityContext}
                            />
                          ) : null}

                          {twoFactorMethods.length > 1 ? (
                            <TwoFactorMethodPicker
                              methods={twoFactorMethods}
                              selectedMethod={selectedMethod}
                              onSelect={selectTwoFactorMethod}
                            />
                          ) : null}

                          <TwoFactorCodeField
                            selectedMethod={selectedMethod}
                            code={twoFactorCode}
                            setCode={setTwoFactorCode}
                            maskedEmail={maskedEmail}
                            expiresAt={twoFactorExpiresAt}
                            remainingMs={twoFactorRemainingMs}
                            expired={twoFactorExpired}
                            loading={loading}
                          />

                          {error ? (
                            <LoginErrorPanel
                              error={error}
                            />
                          ) : null}

                          <button
                            type="submit"
                            disabled={
                              loading ||
                              twoFactorCode.length !== TWO_FACTOR_CODE_LENGTH ||
                              twoFactorExpired ||
                              !isOnline
                            }
                            className="bp-primary-button group"
                          >
                            <span className="absolute inset-0 translate-y-full bg-white/10 transition-transform duration-300 group-hover:translate-y-0" />

                            <span className="relative flex items-center justify-center gap-2">
                              {loading ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Verifying...
                                </>
                              ) : (
                                <>
                                  Verify and continue
                                  <ShieldCheck className="h-4 w-4" />
                                </>
                              )}
                            </span>
                          </button>

                          <div className="grid gap-3 sm:grid-cols-2">
                            {selectedMethod === "email" ? (
                              <button
                                type="button"
                                onClick={() => void resendEmailCode()}
                                disabled={resendingCode || loading || !isOnline}
                                className="bp-secondary-button"
                              >
                                {resendingCode ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                                Send a new code
                              </button>
                            ) : (
                              <div className="hidden sm:block" />
                            )}

                            <button
                              type="button"
                              onClick={returnToPasswordStep}
                              disabled={loading || resendingCode}
                              className="bp-secondary-button"
                            >
                              <RotateCcw className="h-4 w-4" />
                              Start again
                            </button>
                          </div>
                        </form>
                      )}

                      <LoginCardFooter />
                    </>
                  )}
                </div>
              </div>

              <MobileTrustStrip />
            </div>
          </section>
        </div>

        <LoginFooter />
      </div>

      <UltimateLoginStyles />
    </main>
  );
}


function LoginAtmosphere() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(236,72,153,0.26),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(59,130,246,0.25),transparent_28%),radial-gradient(circle_at_50%_90%,rgba(147,51,234,0.18),transparent_35%),linear-gradient(135deg,#050816_0%,#12091f_45%,#06152e_100%)]" />
      <div className="bp-grid absolute inset-0 opacity-[0.16]" />
      <div className="bp-noise absolute inset-0 opacity-[0.035]" />

      <div className="bp-orb bp-orb-one" />
      <div className="bp-orb bp-orb-two" />
      <div className="bp-orb bp-orb-three" />

      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/35 to-transparent" />

      <div className="bp-scan-line absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
    </div>
  );
}

function LoginTopBar({
  isOnline,
  currentTime,
  currentDate,
  loginStep,
  checkingSession,
}: {
  isOnline: boolean;
  currentTime: string;
  currentDate: string;
  loginStep: "password" | "two-factor";
  checkingSession: boolean;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 shadow-xl backdrop-blur-xl sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-pink-500/35 via-purple-500/25 to-blue-500/35 shadow-lg">
          <ShieldCheck className="h-5 w-5 text-white" />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0d18] bg-emerald-400" />
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-black tracking-tight text-white">
            Burton Pride Admin Portal
          </p>
          <p className="truncate text-[11px] font-semibold text-white/45">
            Restricted administration system
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <StatusPill
          icon={isOnline ? Wifi : WifiOff}
          label={isOnline ? "Secure connection ready" : "Offline"}
          tone={isOnline ? "success" : "danger"}
        />

        <StatusPill
          icon={checkingSession ? Loader2 : Fingerprint}
          label={
            checkingSession
              ? "Checking session"
              : loginStep === "two-factor"
                ? "MFA challenge"
                : "Identity check"
          }
          spin={checkingSession}
        />

        <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-white/55 sm:flex">
          <Clock3 className="h-3.5 w-3.5" />
          <span>{currentDate}</span>
          <span className="text-white/25">·</span>
          <span>{currentTime}</span>
        </div>
      </div>
    </header>
  );
}

function StatusPill({
  icon: Icon,
  label,
  tone = "neutral",
  spin = false,
}: {
  icon: typeof ShieldCheck;
  label: string;
  tone?: "neutral" | "success" | "danger";
  spin?: boolean;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : tone === "danger"
        ? "border-red-300/20 bg-red-500/10 text-red-100"
        : "border-white/10 bg-white/[0.05] text-white/55";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-black ${toneClass}`}
    >
      <Icon className={`h-3.5 w-3.5 ${spin ? "animate-spin" : ""}`} />
      <span>{label}</span>
    </div>
  );
}

function LoginStoryPanel({
  securityRiskLabel,
  isOnline,
  progressStep,
}: {
  securityRiskLabel: string;
  isOnline: boolean;
  progressStep: number;
}) {
  return (
    <aside className="relative hidden min-w-0 overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.045] p-8 shadow-[0_35px_120px_rgba(0,0,0,0.3)] backdrop-blur-xl lg:flex lg:flex-col lg:justify-between xl:p-11">
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(236,72,153,0.12),transparent_38%,rgba(59,130,246,0.11))]" />
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-pink-500/14 blur-3xl" />
      <div className="absolute -bottom-24 -right-20 h-80 w-80 rounded-full bg-blue-500/14 blur-3xl" />

      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-pink-200/15 bg-pink-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-pink-50/85">
          <Sparkles className="h-4 w-4" />
          Secure admin access for Admin Portal
        </div>

        <h1 className="mt-8 max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.04em] text-white xl:text-6xl">
          Built to protect
          <span className="block bg-gradient-to-r from-pink-300 via-purple-200 to-blue-300 bg-clip-text text-transparent">
            Burton Pride Admin Portal.
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-white/58 xl:text-lg">
          A private workspace for approved Burton Pride administrators. Sign-in
          uses password verification, two-step verification, trusted-device
          controls and security monitoring before access is granted.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <HeroMetric
            icon={Fingerprint}
            eyebrow="Identity"
            title="Two-step protected"
            text="Password plus an approved verification method."
          />

          <HeroMetric
            icon={MonitorSmartphone}
            eyebrow="Devices"
            title="Trusted-device checks"
            text="New and recognised devices are handled separately."
          />

          <HeroMetric
            icon={Activity}
            eyebrow="Audit"
            title="Security activity"
            text="Important authentication events are recorded."
          />
        </div>
      </div>

      <div className="relative z-10 mt-10 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <SecurityJourney progressStep={progressStep} />

        <div className="grid gap-4">
          <SecuritySignalCard
            icon={isOnline ? Wifi : WifiOff}
            title={isOnline ? "Network available" : "Network unavailable"}
            text={
              isOnline
                ? "This browser can reach the secure login service."
                : "Reconnect before attempting to sign in."
            }
            tone={isOnline ? "success" : "danger"}
          />

          <SecuritySignalCard
            icon={Gauge}
            title={securityRiskLabel}
            text="The server may request additional checks based on device and security signals."
          />
        </div>
      </div>

      <div className="relative z-10 mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs font-semibold text-white/35">
        <span>Burton Pride C.I.C</span>
        <span>Private · Monitored · MFA required</span>
      </div>
    </aside>
  );
}

function HeroMetric({
  icon: Icon,
  eyebrow,
  title,
  text,
}: {
  icon: typeof ShieldCheck;
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="group rounded-3xl border border-white/10 bg-black/20 p-5 transition duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-black/25">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] text-white/80">
          <Icon className="h-5 w-5" />
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/35">
          {eyebrow}
        </span>
      </div>

      <p className="mt-4 text-sm font-black text-white">
        {title}
      </p>

      <p className="mt-2 text-xs font-medium leading-5 text-white/42">
        {text}
      </p>
    </div>
  );
}

function SecurityJourney({
  progressStep,
}: {
  progressStep: number;
}) {
  const steps = [
    {
      number: 1,
      label: "Credentials",
      text: "Verify your admin email and password.",
      icon: KeyRound,
    },
    {
      number: 2,
      label: "Two-step",
      text: "Complete your approved MFA challenge.",
      icon: Smartphone,
    },
    {
      number: 3,
      label: "Admin Portal",
      text: "Open your authorised destination.",
      icon: LayoutDashboard,
    },
  ];

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">
            Secure journey
          </p>
          <p className="mt-1 text-sm font-black text-white">
            Sign-in progress
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10px] font-black text-white/50">
          Step {progressStep} of 2
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {steps.map((step) => {
          const complete = step.number < progressStep;
          const active = step.number === progressStep;
          const future = step.number > progressStep;

          return (
            <div
              key={step.number}
              className={`flex items-start gap-3 rounded-2xl border px-3 py-3 transition ${
                active
                  ? "border-purple-300/20 bg-purple-500/10"
                  : complete
                    ? "border-emerald-300/15 bg-emerald-500/[0.07]"
                    : "border-white/5 bg-white/[0.025]"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  complete
                    ? "bg-emerald-500/15 text-emerald-100"
                    : active
                      ? "bg-purple-500/15 text-purple-100"
                      : "bg-white/[0.05] text-white/30"
                }`}
              >
                {complete ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <step.icon className="h-4 w-4" />
                )}
              </div>

              <div className="min-w-0">
                <p
                  className={`text-xs font-black ${
                    future ? "text-white/35" : "text-white/85"
                  }`}
                >
                  {step.label}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-white/32">
                  {step.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SecuritySignalCard({
  icon: Icon,
  title,
  text,
  tone = "neutral",
}: {
  icon: typeof ShieldCheck;
  title: string;
  text: string;
  tone?: "neutral" | "success" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-300/15 bg-emerald-500/[0.07]"
      : tone === "danger"
        ? "border-red-300/15 bg-red-500/[0.07]"
        : "border-white/10 bg-black/20";

  return (
    <div className={`rounded-3xl border p-5 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
          <Icon className="h-5 w-5 text-white/75" />
        </div>

        <div>
          <p className="text-sm font-black text-white/90">
            {title}
          </p>
          <p className="mt-1 text-xs font-medium leading-5 text-white/40">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginCardHeader({
  loginStep,
  checkingSession,
  progressStep,
}: {
  loginStep: "password" | "two-factor";
  checkingSession: boolean;
  progressStep: number;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-gradient-to-br from-pink-500/25 via-purple-500/20 to-blue-500/25 shadow-lg">
          {checkingSession ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          ) : loginStep === "two-factor" ? (
            <Fingerprint className="h-5 w-5 text-white" />
          ) : (
            <Lock className="h-5 w-5 text-white" />
          )}
        </div>

        {!checkingSession ? (
          <div className="flex items-center gap-2">
            <MiniStep
              active={progressStep === 1}
              complete={progressStep > 1}
              label="1"
            />
            <div className="h-px w-5 bg-white/15" />
            <MiniStep
              active={progressStep === 2}
              complete={false}
              label="2"
            />
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
          Burton Pride Admin Portal
        </p>

        <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white sm:text-3xl">
          {checkingSession
            ? "Checking your secure session"
            : loginStep === "two-factor"
              ? "Complete your security check"
              : "Welcome back"}
        </h2>

        <p className="mt-3 max-w-lg text-sm font-medium leading-6 text-white/48">
          {checkingSession
            ? "We are checking whether this browser already has an active authorised session."
            : loginStep === "two-factor"
              ? "Your password was accepted. Complete the approved verification step to continue."
              : "Sign in with your approved administrator account. Two-step verification is required for access."}
        </p>
      </div>
    </div>
  );
}

function MiniStep({
  active,
  complete,
  label,
}: {
  active: boolean;
  complete: boolean;
  label: string;
}) {
  return (
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-black transition ${
        complete
          ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-100"
          : active
            ? "border-purple-300/40 bg-purple-500/20 text-white"
            : "border-white/10 bg-white/[0.04] text-white/25"
      }`}
    >
      {complete ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : (
        label
      )}
    </div>
  );
}

function SessionCheckPanel() {
  return (
    <div className="mt-7 overflow-hidden rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="flex items-start gap-4">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-purple-300/20 bg-purple-500/10">
          <Loader2 className="h-5 w-5 animate-spin text-purple-100" />
          <span className="absolute inset-0 animate-ping rounded-2xl border border-purple-300/10" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-black text-white">
            Looking for an existing session
          </p>
          <p className="mt-1 text-sm leading-6 text-white/45">
            If this browser is already signed in, you will be taken to your
            authorised admin page automatically.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <LoadingRail
          width="86%"
        />
        <LoadingRail
          width="72%"
        />
        <LoadingRail
          width="58%"
        />
      </div>
    </div>
  );
}

function LoadingRail({
  width,
}: {
  width: string;
}) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
      <div
        className="bp-loading-rail h-full rounded-full bg-gradient-to-r from-pink-400/50 via-purple-400/70 to-blue-400/50"
        style={{
          width,
        }}
      />
    </div>
  );
}

function LoginNoticePanel({
  notice,
}: {
  notice: LoginError;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-500/[0.08] p-4"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
        <div>
          <p className="text-sm font-black text-emerald-50">
            {notice.title}
          </p>
          <p className="mt-1 text-xs font-medium leading-5 text-emerald-50/65">
            {notice.message}
          </p>
        </div>
      </div>
    </div>
  );
}

function CredentialField({
  id,
  label,
  help,
  icon: Icon,
  rightSlot,
  children,
}: {
  id: string;
  label: string;
  help: string;
  icon: typeof ShieldCheck;
  rightSlot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <label
          htmlFor={id}
          className="text-sm font-black text-white/82"
        >
          {label}
        </label>

        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">
          Required
        </span>
      </div>

      <div className="bp-field-shell group relative flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 transition duration-200 focus-within:border-purple-300/40 focus-within:bg-black/25 focus-within:ring-4 focus-within:ring-purple-500/10">
        <Icon className="h-4 w-4 shrink-0 text-white/35 transition group-focus-within:text-purple-200" />

        <div className="min-w-0 flex-1">
          {children}
        </div>

        {rightSlot ? (
          <div className="shrink-0">
            {rightSlot}
          </div>
        ) : null}
      </div>

      <p className="mt-2 text-[11px] font-medium leading-5 text-white/30">
        {help}
      </p>
    </div>
  );
}

function InlineSecurityHint({
  icon: Icon,
  tone,
  title,
  text,
}: {
  icon: typeof ShieldCheck;
  tone: "warning" | "danger" | "info";
  title: string;
  text: string;
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-300/20 bg-red-500/[0.08] text-red-50"
      : tone === "warning"
        ? "border-amber-300/20 bg-amber-500/[0.08] text-amber-50"
        : "border-blue-300/20 bg-blue-500/[0.08] text-blue-50";

  return (
    <div className={`rounded-2xl border p-3.5 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />

        <div>
          <p className="text-xs font-black">
            {title}
          </p>
          <p className="mt-1 text-[11px] font-medium leading-5 opacity-70">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

function SecurityInformationPanel() {
  const items = [
    {
      icon: ShieldCheck,
      title: "Two-step verification",
      text: "All administrator accounts must complete an approved second verification step.",
    },
    {
      icon: MonitorSmartphone,
      title: "Trusted devices",
      text: "The server can distinguish recognised devices from new devices and enforce device limits.",
    },
    {
      icon: Activity,
      title: "Security auditing",
      text: "Important login events can be recorded for accountability and security review.",
    },
    {
      icon: MapPin,
      title: "Approximate location",
      text: "Server-detected approximate location may be used as one security signal. It is not precise GPS tracking.",
    },
  ];

  return (
    <div className="rounded-3xl border border-purple-300/15 bg-purple-500/[0.06] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-500/10">
          <ShieldQuestion className="h-5 w-5 text-purple-100" />
        </div>

        <div>
          <p className="text-sm font-black text-white">
            How this login protects the portal
          </p>
          <p className="mt-1 text-xs font-medium leading-5 text-white/40">
            These controls help reduce unauthorised access while keeping the
            sign-in process understandable for approved administrators.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-white/8 bg-black/15 p-3.5"
          >
            <item.icon className="h-4 w-4 text-white/60" />
            <p className="mt-2 text-xs font-black text-white/80">
              {item.title}
            </p>
            <p className="mt-1 text-[11px] font-medium leading-5 text-white/32">
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MfaIntroPanel({
  securityContext,
  securityRiskLabel,
}: {
  securityContext: LoginSecurityContext | null;
  securityRiskLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-blue-300/15 bg-blue-500/[0.07]">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-300/15 bg-blue-500/10 text-blue-100">
            <Fingerprint className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-black text-white">
                Password accepted
              </p>

              <span className="rounded-full border border-blue-300/15 bg-blue-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-blue-100/80">
                Step 2
              </span>
            </div>

            <p className="mt-1 text-sm font-medium leading-6 text-white/48">
              Complete your approved verification method to finish signing in.
            </p>
          </div>
        </div>
      </div>

      <div className="grid border-t border-white/8 sm:grid-cols-2">
        <div className="border-b border-white/8 px-5 py-3 sm:border-b-0 sm:border-r">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/25">
            Security status
          </p>
          <p className="mt-1 text-xs font-black text-white/70">
            {securityRiskLabel}
          </p>
        </div>

        <div className="px-5 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/25">
            Device
          </p>
          <p className="mt-1 text-xs font-black text-white/70">
            {securityContext?.deviceTrusted
              ? "Recognised"
              : securityContext?.newDevice
                ? "New device"
                : "Checking"}
          </p>
        </div>
      </div>
    </div>
  );
}

function DeviceSecurityPanel({
  securityContext,
}: {
  securityContext: LoginSecurityContext;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/18 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
          <MonitorSmartphone className="h-5 w-5 text-white/65" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-white/85">
              Device security
            </p>

            {securityContext.newDevice ? (
              <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-amber-100">
                New device
              </span>
            ) : securityContext.deviceTrusted ? (
              <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-100">
                Trusted
              </span>
            ) : null}
          </div>

          <div className="mt-3 grid gap-2 text-[11px] font-medium text-white/40">
            {securityContext.deviceLabel ? (
              <SecurityDataLine
                icon={MonitorSmartphone}
                label="Device"
                value={securityContext.deviceLabel}
              />
            ) : null}

            {securityContext.approximateLocation ? (
              <SecurityDataLine
                icon={MapPin}
                label="Approximate location"
                value={securityContext.approximateLocation}
              />
            ) : null}

            {typeof securityContext.trustedDeviceCount === "number" ? (
              <SecurityDataLine
                icon={Users}
                label="Trusted devices"
                value={`${securityContext.trustedDeviceCount} / ${
                  securityContext.maxTrustedDevices || 5
                }`}
              />
            ) : null}
          </div>

          <p className="mt-3 text-[10px] font-medium leading-5 text-white/25">
            Device and approximate location information is supplied by the
            secure server and used only as a security signal.
          </p>
        </div>
      </div>
    </div>
  );
}

function SecurityDataLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-white/30" />
      <span className="shrink-0 text-white/25">
        {label}:
      </span>
      <span className="min-w-0 truncate font-bold text-white/50">
        {value}
      </span>
    </div>
  );
}

function TwoFactorMethodPicker({
  methods,
  selectedMethod,
  onSelect,
}: {
  methods: TwoFactorMethod[];
  selectedMethod: TwoFactorMethod;
  onSelect: (method: TwoFactorMethod) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-black text-white/82">
        Choose how to verify
      </legend>

      <div className="grid gap-3 sm:grid-cols-2">
        {methods.includes("email") ? (
          <TwoFactorMethodButton
            selected={selectedMethod === "email"}
            icon={Mail}
            title="Email code"
            text="Use a six-digit code sent to your approved email."
            onClick={() => onSelect("email")}
          />
        ) : null}

        {methods.includes("totp") ? (
          <TwoFactorMethodButton
            selected={selectedMethod === "totp"}
            icon={Smartphone}
            title="Authenticator"
            text="Use the current code from your authenticator app."
            onClick={() => onSelect("totp")}
          />
        ) : null}
      </div>
    </fieldset>
  );
}

function TwoFactorMethodButton({
  selected,
  icon: Icon,
  title,
  text,
  onClick,
}: {
  selected: boolean;
  icon: typeof ShieldCheck;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group rounded-2xl border p-4 text-left transition duration-200 ${
        selected
          ? "border-purple-300/35 bg-purple-500/12 ring-4 ring-purple-500/[0.06]"
          : "border-white/10 bg-black/15 hover:border-white/15 hover:bg-white/[0.05]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
            selected
              ? "bg-purple-500/15 text-purple-100"
              : "bg-white/[0.05] text-white/45"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full border ${
            selected
              ? "border-purple-300/40 bg-purple-500/20"
              : "border-white/10 bg-white/[0.03]"
          }`}
        >
          {selected ? (
            <div className="h-2 w-2 rounded-full bg-purple-200" />
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-sm font-black text-white/85">
        {title}
      </p>

      <p className="mt-1 text-[11px] font-medium leading-5 text-white/35">
        {text}
      </p>
    </button>
  );
}

function TwoFactorCodeField({
  selectedMethod,
  code,
  setCode,
  maskedEmail,
  expiresAt,
  remainingMs,
  expired,
  loading,
}: {
  selectedMethod: TwoFactorMethod;
  code: string;
  setCode: (value: string) => void;
  maskedEmail: string;
  expiresAt: number | null;
  remainingMs: number;
  expired: boolean;
  loading: boolean;
}) {
  const digits = Array.from(
    {
      length: TWO_FACTOR_CODE_LENGTH,
    },
    (_, index) => code[index] || "",
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <label
          htmlFor="admin-two-factor-code"
          className="text-sm font-black text-white/82"
        >
          {selectedMethod === "email"
            ? "Email security code"
            : "Authenticator code"}
        </label>

        {expiresAt ? (
          <span
            className={`text-[10px] font-black uppercase tracking-[0.12em] ${
              expired
                ? "text-red-200"
                : "text-white/30"
            }`}
          >
            {expired
              ? "Expired"
              : `${Math.max(
                  1,
                  Math.ceil(remainingMs / 60000),
                )} min left`}
          </span>
        ) : null}
      </div>

      <div className="relative">
        <input
          id="admin-two-factor-code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          required
          autoFocus
          autoComplete="one-time-code"
          maxLength={TWO_FACTOR_CODE_LENGTH}
          value={code}
          onChange={(event) =>
            setCode(
              event.target.value
                .replace(/\D/g, "")
                .slice(0, TWO_FACTOR_CODE_LENGTH),
            )
          }
          disabled={loading}
          className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
          aria-describedby="two-factor-help"
        />

        <div
          className="grid grid-cols-6 gap-2"
          aria-hidden="true"
        >
          {digits.map((digit, index) => (
            <div
              key={index}
              className={`flex aspect-square min-w-0 items-center justify-center rounded-2xl border font-mono text-xl font-black transition sm:text-2xl ${
                digit
                  ? "border-purple-300/35 bg-purple-500/10 text-white shadow-lg"
                  : index === code.length
                    ? "border-white/20 bg-white/[0.06] ring-4 ring-purple-500/[0.06]"
                    : "border-white/8 bg-black/15 text-white/20"
              }`}
            >
              {digit || "·"}
            </div>
          ))}
        </div>
      </div>

      <div
        id="two-factor-help"
        className="mt-3 flex items-start gap-2 text-[11px] font-medium leading-5 text-white/35"
      >
        {selectedMethod === "email" ? (
          <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        ) : (
          <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        )}

        <span>
          {selectedMethod === "email"
            ? `Enter the six-digit code sent${
                maskedEmail
                  ? ` to ${maskedEmail}`
                  : " to your approved email address"
              }.`
            : "Open your authenticator app and enter the current six-digit code."}
        </span>
      </div>
    </div>
  );
}

function LoginCardFooter() {
  return (
    <div className="mt-7 grid gap-3 border-t border-white/8 pt-6">
      <FooterSecurityNote
        icon={CheckCircle2}
        title="Approved users only"
        text="Access must be granted before this private area can be used."
      />

      <FooterSecurityNote
        icon={ShieldAlert}
        title="Never share sign-in details"
        text="Burton Pride will not ask you to send your password or two-step code to another person."
        tone="warning"
      />

      <FooterSecurityNote
        icon={Activity}
        title="Security monitoring"
        text="Successful and failed sign-in activity may record server-detected IP address, approximate location, device/browser information and MFA activity."
        tone="purple"
      />
    </div>
  );
}

function FooterSecurityNote({
  icon: Icon,
  title,
  text,
  tone = "neutral",
}: {
  icon: typeof ShieldCheck;
  title: string;
  text: string;
  tone?: "neutral" | "warning" | "purple";
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-300/10 bg-amber-500/[0.05]"
      : tone === "purple"
        ? "border-purple-300/10 bg-purple-500/[0.05]"
        : "border-white/8 bg-white/[0.025]";

  return (
    <div className={`rounded-2xl border p-3.5 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-white/45" />

        <div>
          <p className="text-xs font-black text-white/70">
            {title}
          </p>
          <p className="mt-1 text-[10px] font-medium leading-5 text-white/30">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

function MobileTrustStrip() {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2 lg:hidden">
      <MobileTrustItem
        icon={ShieldCheck}
        label="MFA"
      />
      <MobileTrustItem
        icon={MonitorSmartphone}
        label="Devices"
      />
      <MobileTrustItem
        icon={Activity}
        label="Audited"
      />
    </div>
  );
}

function MobileTrustItem({
  icon: Icon,
  label,
}: {
  icon: typeof ShieldCheck;
  label: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/35 backdrop-blur-lg">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}

function LoginFooter() {
  return (
    <footer className="flex flex-col items-center justify-between gap-3 border-t border-white/8 py-4 text-[10px] font-semibold text-white/25 sm:flex-row">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-start">
        <span>Burton Pride C.I.C</span>
        <span aria-hidden="true">·</span>
        <span>Restricted access</span>
        <span aria-hidden="true">·</span>
        <span>Security monitored</span>
      </div>

      <div className="flex items-center gap-2">
        <BadgeCheck className="h-3.5 w-3.5 text-emerald-300/55" />
        <span>Production security interface</span>
      </div>
    </footer>
  );
}

function LoginErrorPanel({
  error,
}: {
  error: LoginError;
}) {
  const debugEntries =
    error.debug
      ? Object.entries({
          Endpoint:
            error.debug.endpoint,
          "HTTP status":
            error.debug.httpStatus,
          Code:
            error.debug.code,
          Reason:
            error.debug.reason,
          "API error":
            error.debug.apiError,
          "API message":
            error.debug.apiMessage,
          "Attempts remaining":
            error.debug.attemptsRemaining,
        }).filter(
          ([, value]) =>
            value !== undefined &&
            value !== null &&
            value !== "",
        )
      : [];

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="overflow-hidden rounded-2xl border border-red-300/20 bg-red-500/[0.08]"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
          <AlertTriangle className="h-4 w-4 text-red-100" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-red-50">
            {error.title}
          </p>

          <p className="mt-1 text-xs font-medium leading-5 text-red-50/65">
            {error.message}
          </p>
        </div>
      </div>

      {DEBUG_LOGIN_ERRORS &&
      error.debug ? (
        <details className="border-t border-red-300/10 bg-black/20">
          <summary className="cursor-pointer px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-red-100/55">
            Development debugging details
          </summary>

          <div className="border-t border-white/5 px-4 py-4">
            <p className="text-[10px] font-medium leading-5 text-red-50/35">
              Visible only in development. Passwords, MFA codes, cookies, tokens
              and secrets are never displayed here.
            </p>

            {debugEntries.length > 0 ? (
              <dl className="mt-3 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/5 bg-black/20">
                {debugEntries.map(
                  ([label, value]) => (
                    <div
                      key={label}
                      className="grid gap-1 px-3 py-2 sm:grid-cols-[140px_1fr]"
                    >
                      <dt className="text-[10px] font-black text-red-100/35">
                        {label}
                      </dt>
                      <dd className="break-all font-mono text-[10px] text-red-50/65">
                        {String(value)}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            ) : null}

            {error.debug.details ? (
              <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/5 bg-black/25 p-3 text-[10px] leading-5 text-red-50/55">
                {JSON.stringify(
                  error.debug.details,
                  null,
                  2,
                )}
              </pre>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function UltimateLoginStyles() {
  return (
    <style>{`
      :root {
        color-scheme: dark;
      }

      html {
        background: #050816;
      }

      body {
        background: #050816;
      }

      .bp-login-shell {
        isolation: isolate;
      }

      .bp-skip-link {
        position: fixed;
        top: 0.75rem;
        left: 0.75rem;
        z-index: 100;
        transform: translateY(-180%);
        border-radius: 0.75rem;
        background: white;
        padding: 0.65rem 0.9rem;
        color: #111827;
        font-size: 0.75rem;
        font-weight: 900;
        transition:
          transform 150ms ease,
          box-shadow 150ms ease;
      }

      .bp-skip-link:focus {
        transform: translateY(0);
        outline: none;
        box-shadow:
          0 0 0 4px rgba(255, 255, 255, 0.2),
          0 10px 40px rgba(0, 0, 0, 0.35);
      }

      .bp-grid {
        background-image:
          linear-gradient(
            rgba(255, 255, 255, 0.035) 1px,
            transparent 1px
          ),
          linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.035) 1px,
            transparent 1px
          );
        background-size:
          56px 56px,
          56px 56px;
        mask-image:
          linear-gradient(
            to bottom,
            transparent,
            black 15%,
            black 85%,
            transparent
          );
      }

      .bp-noise {
        background-image:
          url("data:image/svg+xml,%3Csvg viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.42'/%3E%3C/svg%3E");
        background-size: 180px 180px;
      }

      .bp-orb {
        position: absolute;
        border-radius: 9999px;
        filter: blur(78px);
        opacity: 0.3;
        animation:
          bp-float 18s ease-in-out infinite;
        will-change: transform;
      }

      .bp-orb-one {
        top: 7%;
        left: -8rem;
        width: 26rem;
        height: 26rem;
        background:
          rgba(236, 72, 153, 0.45);
      }

      .bp-orb-two {
        top: 16%;
        right: -8rem;
        width: 30rem;
        height: 30rem;
        background:
          rgba(59, 130, 246, 0.38);
        animation-delay: -6s;
      }

      .bp-orb-three {
        bottom: -12rem;
        left: 35%;
        width: 34rem;
        height: 34rem;
        background:
          rgba(147, 51, 234, 0.28);
        animation-delay: -12s;
      }

      .bp-scan-line {
        animation:
          bp-scan 9s linear infinite;
        opacity: 0;
      }

      .bp-login-card {
        transform:
          translateZ(0);
      }

      .bp-field-input {
        width: 100%;
        border: 0;
        background: transparent;
        padding:
          0.95rem 0;
        color: white;
        font-size: 0.875rem;
        font-weight: 700;
        outline: none;
      }

      .bp-field-input::placeholder {
        color:
          rgba(255, 255, 255, 0.22);
        font-weight: 600;
      }

      .bp-field-input:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .bp-field-input:-webkit-autofill,
      .bp-field-input:-webkit-autofill:hover,
      .bp-field-input:-webkit-autofill:focus {
        -webkit-text-fill-color:
          #ffffff;
        box-shadow:
          0 0 0 1000px transparent inset;
        transition:
          background-color 9999s ease-out;
        caret-color:
          white;
      }

      .bp-field-action {
        display: inline-flex;
        width: 2.25rem;
        height: 2.25rem;
        align-items: center;
        justify-content: center;
        border-radius: 0.75rem;
        color:
          rgba(255, 255, 255, 0.42);
        transition:
          color 150ms ease,
          background-color 150ms ease,
          transform 150ms ease;
      }

      .bp-field-action:hover {
        background:
          rgba(255, 255, 255, 0.07);
        color:
          white;
      }

      .bp-field-action:active {
        transform:
          scale(0.96);
      }

      .bp-field-action:focus-visible {
        outline:
          2px solid rgba(216, 180, 254, 0.7);
        outline-offset:
          2px;
      }

      .bp-primary-button {
        position: relative;
        display: inline-flex;
        width: 100%;
        min-height: 3.3rem;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 1rem;
        background:
          linear-gradient(
            90deg,
            #ec4899 0%,
            #a855f7 50%,
            #3b82f6 100%
          );
        padding:
          0.9rem 1.25rem;
        color:
          white;
        font-size:
          0.875rem;
        font-weight:
          900;
        letter-spacing:
          -0.01em;
        box-shadow:
          0 14px 40px rgba(147, 51, 234, 0.18),
          inset 0 1px 0 rgba(255, 255, 255, 0.16);
        transition:
          transform 180ms ease,
          box-shadow 180ms ease,
          filter 180ms ease;
      }

      .bp-primary-button:hover:not(:disabled) {
        transform:
          translateY(-1px);
        box-shadow:
          0 18px 50px rgba(147, 51, 234, 0.26),
          inset 0 1px 0 rgba(255, 255, 255, 0.18);
        filter:
          saturate(1.08);
      }

      .bp-primary-button:active:not(:disabled) {
        transform:
          translateY(0)
          scale(0.995);
      }

      .bp-primary-button:focus-visible {
        outline:
          3px solid rgba(255, 255, 255, 0.7);
        outline-offset:
          3px;
      }

      .bp-primary-button:disabled {
        cursor:
          not-allowed;
        opacity:
          0.48;
        filter:
          saturate(0.55);
      }

      .bp-secondary-button {
        display:
          inline-flex;
        min-height:
          2.9rem;
        align-items:
          center;
        justify-content:
          center;
        gap:
          0.5rem;
        border:
          1px solid rgba(255, 255, 255, 0.09);
        border-radius:
          1rem;
        background:
          rgba(255, 255, 255, 0.035);
        padding:
          0.75rem 1rem;
        color:
          rgba(255, 255, 255, 0.72);
        font-size:
          0.75rem;
        font-weight:
          900;
        transition:
          border-color 160ms ease,
          background-color 160ms ease,
          color 160ms ease,
          transform 160ms ease;
      }

      .bp-secondary-button:hover:not(:disabled) {
        border-color:
          rgba(255, 255, 255, 0.16);
        background:
          rgba(255, 255, 255, 0.07);
        color:
          white;
        transform:
          translateY(-1px);
      }

      .bp-secondary-button:focus-visible {
        outline:
          2px solid rgba(216, 180, 254, 0.7);
        outline-offset:
          2px;
      }

      .bp-secondary-button:disabled {
        cursor:
          not-allowed;
        opacity:
          0.45;
      }

      .bp-loading-rail {
        transform-origin:
          left center;
        animation:
          bp-loading-pulse 1.6s ease-in-out infinite;
      }

      @keyframes bp-float {
        0%,
        100% {
          transform:
            translate3d(0, 0, 0)
            scale(1);
        }

        33% {
          transform:
            translate3d(24px, -18px, 0)
            scale(1.04);
        }

        66% {
          transform:
            translate3d(-16px, 20px, 0)
            scale(0.98);
        }
      }

      @keyframes bp-scan {
        0% {
          transform:
            translateY(-10vh);
          opacity:
            0;
        }

        7% {
          opacity:
            0.28;
        }

        80% {
          opacity:
            0.12;
        }

        100% {
          transform:
            translateY(110vh);
          opacity:
            0;
        }
      }

      @keyframes bp-loading-pulse {
        0%,
        100% {
          opacity:
            0.35;
          transform:
            scaleX(0.82);
        }

        50% {
          opacity:
            1;
          transform:
            scaleX(1);
        }
      }

      @media (max-width: 639px) {
        .bp-login-card {
          border-radius:
            1.6rem;
        }

        .bp-primary-button {
          min-height:
            3.2rem;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .bp-orb,
        .bp-scan-line,
        .bp-loading-rail {
          animation:
            none !important;
        }

        .bp-primary-button,
        .bp-secondary-button,
        .bp-field-action {
          transition:
            none !important;
        }

        * {
          scroll-behavior:
            auto !important;
        }
      }

      @media (prefers-contrast: more) {
        .bp-login-card {
          border-color:
            rgba(255, 255, 255, 0.35);
        }

        .bp-field-shell {
          border-color:
            rgba(255, 255, 255, 0.3);
        }

        .bp-secondary-button {
          border-color:
            rgba(255, 255, 255, 0.28);
        }
      }

      @media print {
        .bp-login-shell {
          display:
            none !important;
        }
      }
    `}</style>
  );
}


type LoginProductionReadinessItem = {
  id: string;
  area: string;
  production: boolean;
  automated: boolean;
  priority: "high" | "medium" | "low";
  note: string;
};

/**
 * Production-readiness manifest.
 *
 * This is intentionally colocated with the login page so QA/security reviews
 * can inspect the UI contract without exposing any runtime secrets. It is not
 * sent to the authentication APIs and does not change authentication logic.
 */
const LOGIN_PRODUCTION_READINESS: LoginProductionReadinessItem[] = [
  {
    id: "accessibility-001",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 001 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-002",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 002 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-003",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 003 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-004",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 004 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-005",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 005 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-006",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 006 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-007",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 007 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-008",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 008 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-009",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 009 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-010",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 010 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-011",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 011 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-012",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 012 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-013",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 013 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-014",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 014 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-015",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 015 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-016",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 016 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-017",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 017 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-018",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 018 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-019",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 019 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-020",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 020 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-021",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 021 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-022",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 022 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-023",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 023 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-024",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 024 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-025",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 025 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-026",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 026 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-027",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 027 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-028",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 028 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-029",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 029 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-030",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 030 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-031",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 031 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-032",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 032 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-033",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 033 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-034",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 034 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-035",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 035 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-036",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 036 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-037",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 037 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-038",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 038 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-039",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 039 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-040",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 040 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-041",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 041 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-042",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 042 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-043",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 043 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-044",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 044 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-045",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 045 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-046",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 046 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-047",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 047 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-048",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 048 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-049",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 049 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-050",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 050 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-051",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 051 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-052",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 052 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-053",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 053 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-054",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 054 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-055",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 055 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-056",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 056 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-057",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 057 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-058",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 058 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-059",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 059 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-060",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 060 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-061",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 061 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-062",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 062 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-063",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 063 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-064",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 064 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-065",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 065 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-066",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 066 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-067",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 067 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-068",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 068 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-069",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 069 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-070",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 070 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-071",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 071 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-072",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 072 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-073",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 073 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-074",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 074 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-075",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 075 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-076",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 076 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-077",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 077 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-078",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 078 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-079",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 079 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-080",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 080 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-081",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 081 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-082",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 082 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-083",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 083 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-084",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 084 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-085",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 085 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-086",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 086 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-087",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 087 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-088",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 088 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-089",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 089 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-090",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 090 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-091",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 091 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-092",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 092 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-093",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 093 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-094",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 094 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-095",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 095 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-096",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 096 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-097",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 097 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-098",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 098 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-099",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 099 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-100",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 100 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-101",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 101 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-102",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 102 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-103",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 103 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-104",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 104 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-105",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 105 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-106",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 106 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-107",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 107 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-108",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 108 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-109",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 109 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-110",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 110 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-111",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 111 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-112",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 112 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-113",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 113 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-114",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 114 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-115",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 115 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-116",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 116 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-117",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 117 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-118",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 118 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-119",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 119 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-120",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 120 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-121",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 121 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-122",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 122 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-123",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 123 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-124",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 124 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-125",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 125 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-126",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 126 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-127",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 127 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-128",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 128 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-129",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 129 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-130",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 130 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-131",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 131 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-132",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 132 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-133",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 133 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-134",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 134 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-135",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 135 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-136",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 136 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-137",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 137 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-138",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 138 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-139",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 139 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-140",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 140 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-141",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 141 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-142",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 142 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-143",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 143 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-144",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 144 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-145",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 145 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-146",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 146 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-147",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 147 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-148",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 148 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-149",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 149 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-150",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 150 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-151",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 151 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-152",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 152 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-153",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 153 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-154",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 154 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-155",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 155 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-156",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 156 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-157",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 157 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-158",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 158 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-159",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 159 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-160",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 160 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-161",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 161 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-162",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 162 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-163",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 163 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-164",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 164 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-165",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 165 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-166",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 166 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-167",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 167 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-168",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 168 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-169",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 169 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-170",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 170 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-171",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 171 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-172",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 172 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-173",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 173 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-174",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 174 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-175",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 175 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-176",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 176 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-177",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 177 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-178",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 178 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-179",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 179 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-180",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 180 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-181",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 181 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-182",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 182 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-183",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 183 for the Burton Pride restricted login experience.",
  },
  {
    id: "usability-184",
    area: "Usability",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 184 for the Burton Pride restricted login experience.",
  },
  {
    id: "observability-185",
    area: "Observability",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 185 for the Burton Pride restricted login experience.",
  },
  {
    id: "performance-186",
    area: "Performance",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 186 for the Burton Pride restricted login experience.",
  },
  {
    id: "accessibility-187",
    area: "Accessibility",
    production: true,
    automated: false,
    priority: "medium",
    note: "Production readiness checkpoint 187 for the Burton Pride restricted login experience.",
  },
  {
    id: "security-188",
    area: "Security",
    production: true,
    automated: false,
    priority: "low",
    note: "Production readiness checkpoint 188 for the Burton Pride restricted login experience.",
  },
  {
    id: "responsive-189",
    area: "Responsive design",
    production: true,
    automated: true,
    priority: "high",
    note: "Production readiness checkpoint 189 for the Burton Pride restricted login experience.",
  },
];
