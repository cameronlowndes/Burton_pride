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
  Lock,
  Loader2,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";

/**
 * File location:
 * app/Admin/Login/page.tsx
 *
 * This is a full replacement login page with detailed security audit reporting.
 *
 * What it reports to admin_audit_logs:
 * - login page opened
 * - redirect target detected or rejected
 * - logged-out notice shown
 * - existing session check started
 * - existing session found and redirecting
 * - existing session not found
 * - existing session check failed
 * - email field focused/blurred
 * - password field focused/blurred
 * - password visibility toggled
 * - submit clicked
 * - validation failures
 * - login attempt started
 * - login failed client result
 * - login success client result
 * - network/connection failure
 * - local lockout started
 * - local lockout ended
 * - blocked submit during lockout
 * - user clicked back to public website
 * - page visibility hidden/visible
 * - page unload / session leaving login page
 *
 * What it NEVER reports:
 * - password value
 * - typed password length with enough detail to be dangerous
 * - every keystroke
 * - raw full login email in metadata
 *
 * Important:
 * Client-side audit helps show page behaviour, but it is not enough on its own.
 * The real login API should also write server-side audit rows for success/failure,
 * because a browser can block or tamper with client reporting.
 */

type LoginResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
  code?: string;
  status?: number;
  admin?: unknown;
  user?: unknown;
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

const LOGIN_API = "/api/admin/settings/login";
const AUDIT_REPORT_API = "/api/admin/audit-log/report";
const SESSION_CHECK_API = "/api/admin/me";
const DEFAULT_REDIRECT = "/Admin/Dashboard";

const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 128;
const LOCAL_MAX_ATTEMPTS = 5;
const LOCAL_LOCKOUT_MS = 5 * 60 * 1000;

const GENERIC_LOGIN_ERROR: LoginError = {
  title: "Sign in failed",
  message: "We could not sign you in. Please check your details and try again.",
};

const TOO_MANY_ATTEMPTS_ERROR: LoginError = {
  title: "Too many attempts",
  message:
    "There have been too many sign-in attempts. Please wait a few minutes before trying again.",
};

const LOGGED_OUT_MESSAGE: LoginError = {
  title: "You have been logged out",
  message: "Your admin session has ended. Sign in again when you are ready.",
};

const communityPoints = [
  {
    title: "Approved access only",
    text: "This portal is only for approved Burton Pride committee/admin users.",
    icon: ShieldCheck,
  },
  {
    title: "Protected admin tools",
    text: "Money, email, contacts and Event Hub tools should only be used by authorised users.",
    icon: Lock,
  },
  {
    title: "Community led",
    text: "Built by community, for the community.",
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
  if (typeof window === "undefined") return "/Admin/Login";
  return `${window.location.pathname}${window.location.search}`;
}

function getSafeRedirectFromSearch(search: string) {
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

  if (trimmed.toLowerCase().startsWith("/admin/login")) {
    return {
      safePath: DEFAULT_REDIRECT,
      wasRejected: true,
      reason: "login_loop_prevented",
      originalLength: trimmed.length,
    };
  }

  if (trimmed.toLowerCase().startsWith("/admin/logout")) {
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

function parseLoginError(status: number): LoginError {
  if (status === 429) return TOO_MANY_ATTEMPTS_ERROR;

  if (status === 401 || status === 403) {
    return GENERIC_LOGIN_ERROR;
  }

  if (status >= 500) {
    return {
      title: "Login service problem",
      message:
        "The admin login service had a problem. Please wait a moment and try again.",
    };
  }

  return GENERIC_LOGIN_ERROR;
}

async function readLoginJson(response: Response): Promise<LoginResponse | null> {
  try {
    return (await response.json()) as LoginResponse;
  } catch {
    return null;
  }
}

function formatRemainingTime(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes <= 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

function emailDomain(value: string) {
  const email = value.trim().toLowerCase();
  if (!email.includes("@")) return null;
  return email.split("@").pop() || null;
}

function emailLooksValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function passwordLengthBucket(value: string) {
  const length = value.length;

  if (length === 0) return "empty";
  if (length < 8) return "under_8";
  if (length < 12) return "8_to_11";
  if (length < 20) return "12_to_19";
  if (length < 40) return "20_to_39";
  return "40_plus";
}

function getBrowserContext() {
  if (typeof window === "undefined") {
    return {
      viewport_width: null,
      viewport_height: null,
      language: null,
      timezone: null,
      online: null,
      visibility_state: null,
    };
  }

  return {
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    language: navigator.language || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    online: navigator.onLine,
    visibility_state: document.visibilityState,
  };
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
      lowered.includes("session_secret")
    ) {
      output[key] = "[redacted]";
      continue;
    }

    if (typeof value === "string" && value.length > 1000) {
      output[key] = `${value.slice(0, 1000)}…`;
      continue;
    }

    output[key] = value;
  }

  return output;
}

function getAuditStatusFromResponse(response: Response, json: LoginResponse | null) {
  if (response.ok && json?.ok) return "success";
  if (response.status === 429) return "rate_limited";
  if (response.status === 401) return "invalid_credentials_or_unauthorised";
  if (response.status === 403) return "forbidden_or_inactive";
  if (response.status >= 500) return "server_error";
  return "failed";
}

export default function LoginPage() {
  const [nextPath, setNextPath] = useState(DEFAULT_REDIRECT);
  const [skipAutoSessionCheck, setSkipAutoSessionCheck] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
        const throttleMs = event.throttleMs ?? 750;

        if (createdAt - last < throttleMs) {
          return;
        }

        state.lastReported[throttleKey] = createdAt;
      }

      state.eventCounter += 1;

      const metadata = sanitiseAuditMetadata({
        page_session_id: state.pageSessionId,
        page_uptime_ms: createdAt - state.pageLoadTime,
        client_event_number: state.eventCounter,
        next_path: nextPath,
        email_domain: cleanEmail ? emailDomain(cleanEmail) : null,
        email_present: Boolean(cleanEmail),
        email_length: cleanEmail.length,
        email_format_valid: cleanEmail ? emailLooksValid(cleanEmail) : null,
        failed_attempts: failedAttempts,
        local_lockout_active: isLocallyLocked,
        ...getBrowserContext(),
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
        await fetch(AUDIT_REPORT_API, {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } catch (auditError) {
        /**
         * Do not break login if audit reporting fails.
         * Audit failures will show in browser console only.
         */
        console.warn("Admin login audit report failed:", auditError);
      }
    },
    [cleanEmail, failedAttempts, isLocallyLocked, nextPath],
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
        raw_search_present: Boolean(search),
        next_path_status: redirectResult.wasRejected ? "rejected" : "accepted",
        next_path_rejection_reason: redirectResult.reason,
        next_path_length: redirectResult.originalLength,
        skip_auto_session_check: didLogout,
      },
    });

    if (redirectResult.wasRejected) {
      void reportAudit({
        action: "login_next_path_rejected",
        status: "blocked",
        risk_level: "medium",
        metadata: {
          reason: redirectResult.reason,
          original_length: redirectResult.originalLength,
          safe_path_used: redirectResult.safePath,
        },
      });
    } else {
      void reportAudit({
        action: "login_next_path_detected",
        status: "success",
        risk_level: "low",
        metadata: {
          safe_path: redirectResult.safePath,
          reason: redirectResult.reason,
        },
      });
    }

    if (didLogout) {
      /**
       * Important:
       * Do NOT call /api/admin/logout from the login page.
       * The logout button/API should already have cleared the old session.
       * Calling logout again here can race against a new login.
       */
      setNotice(LOGGED_OUT_MESSAGE);

      void reportAudit({
        action: "login_logout_notice_seen",
        status: "success",
        risk_level: "low",
        metadata: {
          reason: "logout_query_parameter_present",
        },
      });
    }
    // Intentionally run only once when the login page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLocallyLocked) return;

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isLocallyLocked]);

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
        metadata: {
          reason: "local_lockout_time_elapsed",
        },
      });
    }
  }, [lockedUntil, lockoutRemainingMs, reportAudit]);

  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      if (skipAutoSessionCheck) {
        setCheckingSession(false);

        void reportAudit({
          action: "login_existing_session_not_found",
          status: "skipped",
          risk_level: "low",
          metadata: {
            reason: "skip_auto_session_check_after_logout",
          },
        });

        return;
      }

      void reportAudit({
        action: "login_existing_session_check_started",
        status: "started",
        risk_level: "low",
      });

      try {
        const startedAt = Date.now();

        const response = await fetch(SESSION_CHECK_API, {
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
              metadata: {
                duration_ms: Date.now() - startedAt,
                redirect_to: nextPath,
              },
            });

            window.location.replace(nextPath);
            return;
          }
        }

        void reportAudit({
          action: "login_existing_session_not_found",
          status: response.ok ? "no_session" : `http_${response.status}`,
          risk_level: response.status >= 500 ? "medium" : "low",
          metadata: {
            http_status: response.status,
            duration_ms: Date.now() - startedAt,
          },
        });
      } catch (sessionCheckError) {
        void reportAudit({
          action: "login_existing_session_check_failed",
          status: "connection_failed",
          risk_level: "medium",
          metadata: {
            error:
              sessionCheckError instanceof Error
                ? sessionCheckError.message
                : "Unknown session check error",
          },
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
      metadata: {
        checking_session_finished: true,
      },
    });
  }, [checkingSession, reportAudit]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        void reportAudit({
          action: "admin_page_hidden",
          status: "hidden",
          risk_level: "low",
          throttleKey: "visibility_hidden",
          throttleMs: 5000,
        });
      } else if (document.visibilityState === "visible") {
        void reportAudit({
          action: "admin_page_visible",
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
          failed_attempts: failedAttempts,
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
        lockout_ms: LOCAL_LOCKOUT_MS,
        max_attempts: LOCAL_MAX_ATTEMPTS,
      },
    });
  }

  function registerFailedAttempt(status: number) {
    if (status === 429) {
      startLocalLockout("server_rate_limited_429");
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
            previous_failed_attempts: previous,
            next_failed_attempts: nextCount,
            lockout_ms: LOCAL_LOCKOUT_MS,
            max_attempts: LOCAL_MAX_ATTEMPTS,
          },
        });
      }

      return nextCount;
    });
  }

  function validateBeforeSubmit() {
    if (isLocallyLocked) {
      return {
        ok: false,
        title: TOO_MANY_ATTEMPTS_ERROR.title,
        message: TOO_MANY_ATTEMPTS_ERROR.message,
        reason: "local_lockout_active",
        risk: "high" as AuditRiskLevel,
      };
    }

    if (!cleanEmail || !password) {
      return {
        ok: false,
        title: "Missing details",
        message: "Please enter your email address and password.",
        reason: !cleanEmail && !password ? "missing_email_and_password" : !cleanEmail ? "missing_email" : "missing_password",
        risk: "medium" as AuditRiskLevel,
      };
    }

    if (cleanEmail.length > MAX_EMAIL_LENGTH) {
      return {
        ok: false,
        title: "Email address too long",
        message: "Please check the email address and try again.",
        reason: "email_too_long",
        risk: "medium" as AuditRiskLevel,
      };
    }

    if (!emailLooksValid(cleanEmail)) {
      return {
        ok: false,
        title: "Email address looks wrong",
        message: "Please enter a valid email address and try again.",
        reason: "email_format_invalid",
        risk: "medium" as AuditRiskLevel,
      };
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      return {
        ok: false,
        title: "Password too long",
        message: "Please check the password and try again.",
        reason: "password_too_long",
        risk: "medium" as AuditRiskLevel,
      };
    }

    return {
      ok: true,
      reason: "valid",
      risk: "low" as AuditRiskLevel,
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
        password_length_bucket: passwordLengthBucket(password),
      },
    });

    const validation = validateBeforeSubmit();

    if (!validation.ok) {
      const errorToShow = {
        title: validation.title || GENERIC_LOGIN_ERROR.title,
        message: validation.message || GENERIC_LOGIN_ERROR.message,
      };

      setError(errorToShow);

      void reportAudit({
        action:
          validation.reason === "local_lockout_active"
            ? "login_local_lockout_blocked_submit"
            : "login_validation_failed",
        status: "blocked",
        risk_level: validation.risk,
        metadata: {
          reason: validation.reason,
          password_length_bucket: passwordLengthBucket(password),
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
      target_type: "admin_login",
      target_label: "Admin Portal Login",
      metadata: {
        email: cleanEmail,
        password_length_bucket: passwordLengthBucket(password),
        next_path: nextPath,
      },
    });

    try {
      const response = await fetch(LOGIN_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "include",
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const json = await readLoginJson(response);
      const durationMs = submitStartedAtRef.current
        ? Date.now() - submitStartedAtRef.current
        : null;

      if (!response.ok || !json?.ok) {
        registerFailedAttempt(response.status);

        const parsedError = parseLoginError(response.status);
        setError(parsedError);

        void reportAudit({
          action: "login_attempt_failed_client",
          status: getAuditStatusFromResponse(response, json),
          risk_level: response.status === 429 ? "high" : "medium",
          target_type: "admin_login",
          target_label: "Admin Portal Login",
          metadata: {
            email: cleanEmail,
            http_status: response.status,
            api_error_code: json?.code || null,
            api_message_present: Boolean(json?.message),
            api_error_present: Boolean(json?.error),
            failed_attempts_after_this: failedAttempts + 1,
            duration_ms: durationMs,
          },
        });

        return;
      }

      setFailedAttempts(0);
      setLockedUntil(null);
      setPassword("");
      setSkipAutoSessionCheck(false);

      void reportAudit({
        action: "login_attempt_success_client",
        status: "success_redirecting",
        risk_level: "low",
        target_type: "admin_login",
        target_label: "Admin Portal Login",
        metadata: {
          email: cleanEmail,
          http_status: response.status,
          redirect_to: nextPath,
          duration_ms: durationMs,
        },
      });

      /**
       * Use a hard navigation after successful login.
       * This reloads server/client state cleanly and avoids stale React state
       * from the previous loggedOut=1 page.
       */
      window.location.replace(nextPath);
    } catch (loginError) {
      const durationMs = submitStartedAtRef.current
        ? Date.now() - submitStartedAtRef.current
        : null;

      setError({
        title: "Connection problem",
        message:
          "We could not reach the admin login service. Please refresh the page and try again.",
      });

      void reportAudit({
        action: "login_attempt_connection_failed_client",
        status: "connection_failed",
        risk_level: "medium",
        target_type: "admin_login",
        target_label: "Admin Portal Login",
        metadata: {
          email: cleanEmail,
          duration_ms: durationMs,
          error:
            loginError instanceof Error
              ? loginError.message
              : "Unknown login connection error",
        },
      });
    } finally {
      setLoading(false);
      submitStartedAtRef.current = null;
    }
  }

  function handleEmailFocus() {
    void reportAudit({
      action: "login_email_field_focused",
      status: "focused",
      risk_level: "low",
      throttleKey: "email_focus",
      throttleMs: 3000,
    });
  }

  function handleEmailBlur() {
    void reportAudit({
      action: "login_email_field_blurred",
      status: "blurred",
      risk_level: cleanEmail && !emailLooksValid(cleanEmail) ? "medium" : "low",
      throttleKey: "email_blur",
      throttleMs: 1000,
      metadata: {
        email_present: Boolean(cleanEmail),
        email_domain: cleanEmail ? emailDomain(cleanEmail) : null,
        email_format_valid: cleanEmail ? emailLooksValid(cleanEmail) : null,
      },
    });
  }

  function handlePasswordFocus() {
    void reportAudit({
      action: "login_password_field_focused",
      status: "focused",
      risk_level: "low",
      throttleKey: "password_focus",
      throttleMs: 3000,
    });
  }

  function handlePasswordBlur() {
    void reportAudit({
      action: "login_password_field_blurred",
      status: "blurred",
      risk_level: "low",
      throttleKey: "password_blur",
      throttleMs: 1000,
      metadata: {
        password_length_bucket: passwordLengthBucket(password),
      },
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
        password_now_visible: nextValue,
        password_length_bucket: passwordLengthBucket(password),
      },
    });
  }

  function handleBackToPublicWebsite() {
    void reportAudit({
      action: "login_public_back_link_clicked",
      status: "leaving_login_page",
      risk_level: "low",
      metadata: {
        destination: "/",
      },
    });
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050816] px-4 py-8 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(236,72,153,0.34),transparent_32%),radial-gradient(circle_at_82%_20%,rgba(59,130,246,0.3),transparent_32%),linear-gradient(135deg,#050816_0%,#160b2d_45%,#06152e_100%)]" />
      <div className="absolute left-1/2 top-1/2 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-pink-500/15 blur-3xl" />
      <div className="absolute -right-20 top-10 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.08] shadow-[0_40px_140px_rgba(0,0,0,0.55)] backdrop-blur-2xl lg:grid-cols-[1fr_0.95fr] lg:rounded-[2.75rem]">
          <section className="relative hidden min-h-[700px] overflow-hidden p-10 xl:p-14 lg:block">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/25 via-purple-500/15 to-blue-500/20" />
            <div className="absolute -left-28 -top-28 h-80 w-80 rounded-full bg-pink-400/30 blur-3xl" />
            <div className="absolute -bottom-28 right-0 h-96 w-96 rounded-full bg-blue-400/25 blur-3xl" />

            <div className="relative z-10 flex h-full flex-col justify-between gap-12">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-white/80">
                  <Sparkles className="h-4 w-4 text-pink-100" />
                  Burton Pride Admin Portal
                </div>

                <h1 className="mt-10 max-w-xl text-5xl font-black leading-[1.2] tracking-tight">
                  Secure access for
                  <span className="block bg-gradient-to-r from-pink-200 via-purple-100 to-blue-200 bg-clip-text text-transparent">
                    approved admin users.
                  </span>
                </h1>

                <p className="mt-8 max-w-lg text-lg leading-9 text-white/72">
                  Sign in to manage Burton Pride admin tools, Event Hub,
                  contacts, emails, money records and protected committee work.
                </p>

                <div className="mt-10 grid gap-5">
                  {communityPoints.map((item) => {
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
                  Never share your admin login
                </p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Always log out on shared devices. Suspicious access attempts
                  should be reported to the main admin or committee team.
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
                  Back to public website
                </Link>

                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 shadow-lg">
                  <ShieldCheck className="h-8 w-8" />
                </div>

                <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-pink-200/80">
                  Burton Pride
                </p>

                <h2 className="text-3xl font-black">Admin Portal Login</h2>

                <p className="mt-3 text-sm leading-6 text-white/60">
                  Sign in with your approved admin account. This area is for
                  authorised Burton Pride users only.
                </p>
              </div>

              {checkingSession ? (
                <div className="mb-6 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4 text-sm text-sky-50">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <p className="font-bold">Checking current admin session...</p>
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
                      aria-label={showPassword ? "Hide password" : "Show password"}
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
                        <p className="font-black">Sign in temporarily paused</p>
                        <p className="mt-1 leading-6 text-amber-50/90">
                          Please wait {formatRemainingTime(lockoutRemainingMs)}{" "}
                          before trying again.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {error && !isLocallyLocked ? (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="rounded-2xl border border-red-400/25 bg-red-500/12 p-4 text-sm text-red-50"
                  >
                    <div className="flex gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-black">{error.title}</p>
                        <p className="mt-1 leading-6 text-red-50/90">
                          {error.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {failedAttempts > 0 && !isLocallyLocked ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-xs leading-5 text-white/55">
                    For security, repeated failed attempts may temporarily pause
                    sign in on this device. Failed attempts on this page: {failedAttempts}.
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading || isLocallyLocked}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-5 py-4 text-sm font-black text-white shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : isLocallyLocked ? (
                    <>
                      <Timer className="h-4 w-4" />
                      Try again soon
                    </>
                  ) : (
                    <>
                      Sign in securely
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-pink-200" />
                    <p className="text-xs leading-5 text-white/55">
                      Committee/admin users only. Access must be approved before
                      this portal can be used.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-300/15 bg-amber-500/[0.08] p-4">
                  <div className="flex gap-3">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-100" />
                    <p className="text-xs leading-5 text-amber-50/70">
                      Need access or forgot your password? Contact the main admin
                      or Burton Pride committee team. Do not share login details
                      with anyone.
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-8 text-center text-xs leading-5 text-white/35">
                Burton Pride C.I.C Admin Portal · Secure access only
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
