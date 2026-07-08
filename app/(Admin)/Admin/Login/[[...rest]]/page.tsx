"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

type LoginResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

type LoginError = {
  title: string;
  message: string;
};

const LOGIN_API = "/api/admin/settings/login";
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

function getSafeRedirectFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const next = params.get("next");

  if (!next) return DEFAULT_REDIRECT;

  const trimmed = next.trim();

  if (!trimmed.startsWith("/Admin")) return DEFAULT_REDIRECT;
  if (trimmed.startsWith("//")) return DEFAULT_REDIRECT;
  if (trimmed.includes("\\")) return DEFAULT_REDIRECT;
  if (trimmed.toLowerCase().startsWith("/admin/login")) return DEFAULT_REDIRECT;
  if (trimmed.toLowerCase().startsWith("/admin/logout")) return DEFAULT_REDIRECT;
  if (trimmed.length > 300) return DEFAULT_REDIRECT;

  return trimmed;
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

  const cleanEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const lockoutRemainingMs = lockedUntil ? lockedUntil - now : 0;
  const isLocallyLocked = Boolean(lockedUntil && lockoutRemainingMs > 0);

  useEffect(() => {
    const search = window.location.search;
    const didLogout = shouldSkipAutoSessionCheck(search);

    setNextPath(getSafeRedirectFromSearch(search));
    setSkipAutoSessionCheck(didLogout);

    if (didLogout) {
      /**
       * Important:
       * Do NOT call /api/admin/logout from the login page.
       * The logout button/API should already have cleared the old session.
       *
       * Calling logout again here can race against a new login:
       * 1. User lands here with ?loggedOut=1
       * 2. Login page fires logout cleanup request
       * 3. User signs in
       * 4. Old cleanup request finishes late and clears the NEW login cookies
       *
       * That causes the login -> logout loop.
       */
      setNotice(LOGGED_OUT_MESSAGE);
    }
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
  }, [lockedUntil, lockoutRemainingMs]);

  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      if (skipAutoSessionCheck) {
        setCheckingSession(false);
        return;
      }

      try {
        const response = await fetch("/api/admin/me", {
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
            window.location.replace(nextPath);
            return;
          }
        }
      } catch {
        // Do not block the login page if session check fails.
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    checkExistingSession();

    return () => {
      cancelled = true;
    };
  }, [nextPath, skipAutoSessionCheck]);

  function registerFailedAttempt(status: number) {
    if (status === 429) {
      setLockedUntil(Date.now() + LOCAL_LOCKOUT_MS);
      setFailedAttempts(LOCAL_MAX_ATTEMPTS);
      return;
    }

    setFailedAttempts((previous) => {
      const nextCount = previous + 1;

      if (nextCount >= LOCAL_MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCAL_LOCKOUT_MS);
        setError(TOO_MANY_ATTEMPTS_ERROR);
      }

      return nextCount;
    });
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError(null);
    setNotice(null);

    if (isLocallyLocked) {
      setError(TOO_MANY_ATTEMPTS_ERROR);
      return;
    }

    if (!cleanEmail || !password) {
      setError({
        title: "Missing details",
        message: "Please enter your email address and password.",
      });
      return;
    }

    if (cleanEmail.length > MAX_EMAIL_LENGTH) {
      setError({
        title: "Email address too long",
        message: "Please check the email address and try again.",
      });
      return;
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      setError({
        title: "Password too long",
        message: "Please check the password and try again.",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(LOGIN_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "include",
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const json = await readLoginJson(response);

      if (!response.ok || !json?.ok) {
        registerFailedAttempt(response.status);
        setError(parseLoginError(response.status));
        return;
      }

      setFailedAttempts(0);
      setLockedUntil(null);
      setPassword("");
      setSkipAutoSessionCheck(false);

      /**
       * Use a hard navigation after successful login.
       * This reloads server/client state cleanly and avoids stale React state
       * from the previous loggedOut=1 page.
       */
      window.location.replace(nextPath);
    } catch {
      setError({
        title: "Connection problem",
        message:
          "We could not reach the admin login service. Please refresh the page and try again.",
      });
    } finally {
      setLoading(false);
    }
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
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={loading || isLocallyLocked}
                      className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/35 disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder="Enter password"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
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
                    sign in on this device.
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
