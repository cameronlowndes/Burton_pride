"use client";

import {
  FormEvent,
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
  Lock,
  Loader2,
  Mail,
  ShieldAlert,
  RotateCcw,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";

type TwoFactorMethod = "email" | "totp";

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
};

type VerifyTwoFactorResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  code?: string;
  attemptsRemaining?: number;
};

type LoginError = {
  title: string;
  message: string;
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
  session: "/api/admin/me",
} as const;

const DEFAULT_REDIRECT = "/Admin/Dashboard";
const LOGIN_ROUTE = "/Admin/Login";
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 128;
const TWO_FACTOR_CODE_LENGTH = 6;
const LOCAL_MAX_ATTEMPTS = 5;
const LOCAL_LOCKOUT_MS = 5 * 60 * 1000;

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
    text: "Access is monitored to help protect this restricted space.",
    icon: Lock,
  },
  {
    title: "Use safely",
    text: "Sign out on shared devices and keep login details private.",
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

function parseLoginError(status: number): LoginError {
  if (status === 429) return TOO_MANY_ATTEMPTS_ERROR;
  if (status === 401 || status === 403) return GENERIC_LOGIN_ERROR;
  if (status >= 500) return GENERIC_SERVICE_ERROR;
  return GENERIC_LOGIN_ERROR;
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
  const [twoFactorExpiresAt, setTwoFactorExpiresAt] = useState<number | null>(
    null,
  );
  const [resendingCode, setResendingCode] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

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
        }),
      });

      const json = await readLoginJson(response);
      const durationMs = submitStartedAtRef.current
        ? Date.now() - submitStartedAtRef.current
        : null;

      if (!response.ok || !json?.ok) {
        registerFailedAttempt(response.status);
        setError(parseLoginError(response.status));

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

        return;
      }

      setFailedAttempts(0);
      setLockedUntil(null);

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

      return;
    } catch {
      const durationMs = submitStartedAtRef.current
        ? Date.now() - submitStartedAtRef.current
        : null;

      setError(GENERIC_SERVICE_ERROR);

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

    if (loading) return;

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

    setLoading(true);

    void reportAudit({
      action: "login_two_factor_verify_started",
      status: "started",
      risk_level: "medium",
      metadata: {
        method: selectedMethod,
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
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | VerifyTwoFactorResponse
        | null;

      if (!response.ok || !json?.ok) {
        setTwoFactorCode("");

        if (response.status === 410) {
          setTwoFactorExpiresAt(Date.now());
          setError({
            title: "Security code expired",
            message:
              selectedMethod === "email"
                ? "Send a new email code and try again."
                : "Enter the newest code from your authenticator app.",
          });
        } else if (response.status === 429) {
          setError(TOO_MANY_ATTEMPTS_ERROR);
        } else {
          setError({
            title: "Code not accepted",
            message:
              typeof json?.attemptsRemaining === "number"
                ? `Check the code and try again. ${json.attemptsRemaining} attempt${
                    json.attemptsRemaining === 1 ? "" : "s"
                  } remaining.`
                : "Check the code and try again.",
          });
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
        },
      });

      window.location.replace(nextPath);
    } catch {
      setError(GENERIC_SERVICE_ERROR);

      void reportAudit({
        action: "login_two_factor_verify_connection_failed",
        status: "connection_failed",
        risk_level: "medium",
        metadata: {
          method: selectedMethod,
        },
      });
    } finally {
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
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | LoginResponse
        | null;

      if (!response.ok || !json?.ok) {
        setError(
          response.status === 429
            ? TOO_MANY_ATTEMPTS_ERROR
            : {
                title: "Code could not be sent",
                message: "Please wait a moment and try again.",
              },
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
      setError(GENERIC_SERVICE_ERROR);
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

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050816] px-4 py-8 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(236,72,153,0.28),transparent_32%),radial-gradient(circle_at_82%_20%,rgba(59,130,246,0.26),transparent_32%),linear-gradient(135deg,#050816_0%,#160b2d_45%,#06152e_100%)]" />
      <div className="absolute left-1/2 top-1/2 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-pink-500/15 blur-3xl" />
      <div className="absolute -right-20 top-10 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.08] shadow-[0_40px_140px_rgba(0,0,0,0.55)] backdrop-blur-2xl lg:grid-cols-[1fr_0.95fr] lg:rounded-[2.75rem]">
          <section className="relative hidden min-h-[700px] overflow-hidden p-10 xl:p-14 lg:block">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/22 via-purple-500/14 to-blue-500/20" />
            <div className="absolute -left-28 -top-28 h-80 w-80 rounded-full bg-pink-400/28 blur-3xl" />
            <div className="absolute -bottom-28 right-0 h-96 w-96 rounded-full bg-blue-400/24 blur-3xl" />

            <div className="relative z-10 flex h-full flex-col justify-between gap-12">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-white/80">
                  <Sparkles className="h-4 w-4 text-pink-100" />
                  Burton Pride Admin Portal App
                </div>

                <h1 className="mt-10 max-w-xl text-5xl font-black leading-[1.2] tracking-tight">
                  Welcome to the Burton Pride Admin Portal
                </h1>

                <p className="mt-8 max-w-lg text-lg leading-9 text-white/72">
                  This is a restricted Burton Pride area. Continue only if you
                  have been given permission to sign in.
                </p>

                <div className="mt-10 grid gap-5">
                  {restrictedAccessCards.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.title}
                        className="flex gap-4 rounded-3xl border border-white/10 bg-black/20 p-5 backdrop-blur-xl"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                          <Icon className="h-6 w-6 text-pink-100" />
                        </div>

                        <div>
                          <p className="font-black text-white">{item.title}</p>
                          <p className="mt-1 text-sm leading-6 text-white/60">
                            {item.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-black/20 p-6 backdrop-blur-xl">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-white/55">
                  Security reminder
                </p>
                <p className="mt-3 text-2xl font-black text-white">
                  Keep access private
                </p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Never share login details. Report anything suspicious to an
                  authorised admin lead.
                </p>
              </div>
            </div>
          </section>

          <section className="bg-[#111827]/85 p-8 sm:p-10 lg:p-12 xl:p-14">
            <div className="mx-auto flex min-h-[620px] max-w-md flex-col justify-center">
              <div className="mb-8">
                <Link
                  href="/"
                  onClick={handleBackToPublicWebsite}
                  className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-white/55 transition hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to website
                </Link>

                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 shadow-lg">
                  <ShieldCheck className="h-8 w-8" />
                </div>

                <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-pink-200/80">
                  Burton Pride
                </p>

                <h2 className="text-3xl font-black">
                  {loginStep === "password"
                    ? "Secure Access Login"
                    : "Confirm it is you"}
                </h2>

                <p className="mt-3 text-sm leading-6 text-white/60">
                  {loginStep === "password"
                    ? "Use your approved account to continue. Every administrator must complete two-step verification."
                    : "Complete the required second security step before the admin portal opens."}
                </p>

                {loginStep === "password" ? (
                  <div className="mt-5 rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4">
                    <div className="flex gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-100" />
                      <div>
                        <p className="text-sm font-black text-white">
                          Two-step verification is required
                        </p>
                        <p className="mt-1 text-xs leading-5 text-white/55">
                          After your password is accepted, you must enter a code
                          from your email or authenticator app.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {checkingSession ? (
                <div className="mb-6 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4 text-sm text-sky-50">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <p className="font-bold">Checking secure access...</p>
                  </div>
                </div>
              ) : null}

              {notice ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="mb-6 rounded-2xl border border-emerald-400/25 bg-emerald-500/12 p-4 text-sm text-emerald-50"
                >
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-black">{notice.title}</p>
                      <p className="mt-1 leading-6 text-emerald-50/90">
                        {notice.message}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {loginStep === "password" ? (
                <form onSubmit={handleLogin} className="space-y-6" noValidate>
                  <div>
                    <label
                      htmlFor="admin-email"
                      className="mb-3 block text-sm font-bold text-white/85"
                    >
                      Email address
                    </label>

                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-4 transition focus-within:border-pink-300/60 focus-within:bg-white/[0.1]">
                      <Mail className="h-4 w-4 shrink-0 text-white/45" />

                      <input
                        id="admin-email"
                        type="email"
                        inputMode="email"
                        required
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        autoComplete="email"
                        maxLength={MAX_EMAIL_LENGTH}
                        value={email}
                        onFocus={handleEmailFocus}
                        onBlur={handleEmailBlur}
                        onChange={(event) => setEmail(event.target.value)}
                        disabled={loading || isLocallyLocked}
                        className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/35 disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="Enter email address"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="admin-password"
                      className="mb-3 block text-sm font-bold text-white/85"
                    >
                      Password
                    </label>

                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-4 transition focus-within:border-pink-300/60 focus-within:bg-white/[0.1]">
                      <Lock className="h-4 w-4 shrink-0 text-white/45" />

                      <input
                        id="admin-password"
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        maxLength={MAX_PASSWORD_LENGTH}
                        value={password}
                        onFocus={handlePasswordFocus}
                        onBlur={handlePasswordBlur}
                        onChange={(event) => setPassword(event.target.value)}
                        disabled={loading || isLocallyLocked}
                        className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/35 disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="Enter password"
                      />

                      <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        disabled={loading || isLocallyLocked}
                        className="rounded-xl p-1 text-white/55 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isLocallyLocked ? (
                    <div
                      role="alert"
                      aria-live="polite"
                      className="rounded-2xl border border-amber-400/25 bg-amber-500/12 p-4 text-sm text-amber-50"
                    >
                      <div className="flex gap-3">
                        <Timer className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                          <p className="font-black">
                            Sign in temporarily paused
                          </p>
                          <p className="mt-1 leading-6 text-amber-50/90">
                            Please wait a few minutes before trying again.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {error && !isLocallyLocked ? (
                    <LoginErrorPanel error={error} />
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading || isLocallyLocked}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-5 py-4 text-sm font-black text-white shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Checking details...
                      </>
                    ) : isLocallyLocked ? (
                      <>
                        <Timer className="h-4 w-4" />
                        Try again later
                      </>
                    ) : (
                      <>
                        Continue securely
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={handleTwoFactorVerify}
                  className="space-y-6"
                  noValidate
                >
                  <div className="rounded-3xl border border-blue-300/20 bg-blue-500/10 p-5">
                    <div className="flex gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-100">
                        <ShieldCheck className="h-5 w-5" />
                      </div>

                      <div>
                        <p className="font-black text-white">
                          Two-step verification
                        </p>
                        <p className="mt-1 text-sm leading-6 text-white/60">
                          Your password was accepted. Complete one more security
                          check to open the admin portal.
                        </p>
                      </div>
                    </div>
                  </div>

                  {twoFactorMethods.length > 1 ? (
                    <div>
                      <p className="mb-3 text-sm font-bold text-white/85">
                        Choose how to verify
                      </p>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {twoFactorMethods.includes("email") ? (
                          <button
                            type="button"
                            onClick={() => selectTwoFactorMethod("email")}
                            className={`rounded-2xl border p-4 text-left transition ${
                              selectedMethod === "email"
                                ? "border-pink-300/50 bg-pink-500/15"
                                : "border-white/10 bg-white/[0.05] hover:bg-white/[0.09]"
                            }`}
                          >
                            <Mail className="h-5 w-5 text-pink-100" />
                            <p className="mt-3 font-black">Email code</p>
                            <p className="mt-1 text-xs leading-5 text-white/50">
                              Send a six-digit code to your approved email.
                            </p>
                          </button>
                        ) : null}

                        {twoFactorMethods.includes("totp") ? (
                          <button
                            type="button"
                            onClick={() => selectTwoFactorMethod("totp")}
                            className={`rounded-2xl border p-4 text-left transition ${
                              selectedMethod === "totp"
                                ? "border-blue-300/50 bg-blue-500/15"
                                : "border-white/10 bg-white/[0.05] hover:bg-white/[0.09]"
                            }`}
                          >
                            <Smartphone className="h-5 w-5 text-blue-100" />
                            <p className="mt-3 font-black">
                              Authenticator app
                            </p>
                            <p className="mt-1 text-xs leading-5 text-white/50">
                              Use Google Authenticator or another TOTP app.
                            </p>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <label
                      htmlFor="admin-two-factor-code"
                      className="mb-3 block text-sm font-bold text-white/85"
                    >
                      {selectedMethod === "email"
                        ? "Email security code"
                        : "Authenticator code"}
                    </label>

                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-4 transition focus-within:border-pink-300/60 focus-within:bg-white/[0.1]">
                      {selectedMethod === "email" ? (
                        <KeyRound className="h-4 w-4 shrink-0 text-white/45" />
                      ) : (
                        <Smartphone className="h-4 w-4 shrink-0 text-white/45" />
                      )}

                      <input
                        id="admin-two-factor-code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        required
                        autoFocus
                        autoComplete="one-time-code"
                        maxLength={TWO_FACTOR_CODE_LENGTH}
                        value={twoFactorCode}
                        onChange={(event) =>
                          setTwoFactorCode(
                            event.target.value
                              .replace(/\D/g, "")
                              .slice(0, TWO_FACTOR_CODE_LENGTH),
                          )
                        }
                        disabled={loading}
                        className="w-full bg-transparent text-center font-mono text-2xl font-black tracking-[0.45em] text-white outline-none placeholder:text-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="000000"
                        aria-describedby="two-factor-help"
                      />
                    </div>

                    <p
                      id="two-factor-help"
                      className="mt-3 text-xs leading-5 text-white/50"
                    >
                      {selectedMethod === "email"
                        ? `Enter the code sent${
                            maskedEmail ? ` to ${maskedEmail}` : " by email"
                          }.`
                        : "Open your authenticator app and enter the current six-digit code."}
                    </p>

                    {twoFactorExpiresAt ? (
                      <p className="mt-2 text-xs font-bold text-white/45">
                        {twoFactorExpired
                          ? "This challenge has expired."
                          : `Challenge expires in ${Math.max(
                              1,
                              Math.ceil(twoFactorRemainingMs / 60000),
                            )} minute${
                              Math.ceil(twoFactorRemainingMs / 60000) === 1
                                ? ""
                                : "s"
                            }.`}
                      </p>
                    ) : null}
                  </div>

                  {error ? <LoginErrorPanel error={error} /> : null}

                  <button
                    type="submit"
                    disabled={
                      loading ||
                      twoFactorCode.length !== TWO_FACTOR_CODE_LENGTH ||
                      twoFactorExpired
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-5 py-4 text-sm font-black text-white shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                  >
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
                  </button>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    {selectedMethod === "email" ? (
                      <button
                        type="button"
                        onClick={() => void resendEmailCode()}
                        disabled={resendingCode || loading}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {resendingCode ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Send a new code
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={returnToPasswordStep}
                      disabled={loading || resendingCode}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Start again
                    </button>
                  </div>
                </form>
              )}

              <div className="mt-8 grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-pink-200" />
                    <p className="text-xs leading-5 text-white/55">
                      Approved users only. Access must be granted before this
                      area can be used.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-300/15 bg-amber-500/[0.08] p-4">
                  <div className="flex gap-3">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-100" />
                    <p className="text-xs leading-5 text-amber-50/70">
                      Need help with access? Contact an authorised admin lead.
                      Never share login details with anyone.
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-8 text-center text-xs leading-5 text-white/35">
                Burton Pride C.I.C · Restricted access
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function LoginErrorPanel({ error }: { error: LoginError }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="rounded-2xl border border-red-400/25 bg-red-500/12 p-4 text-sm text-red-50"
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-black">{error.title}</p>
          <p className="mt-1 leading-6 text-red-50/90">{error.message}</p>
        </div>
      </div>
    </div>
  );
}

