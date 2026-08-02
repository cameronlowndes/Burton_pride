"use client";

import { useMemo, useState, type ElementType, type ReactNode } from "react";
import Link from "next/link";
import { useAdmin } from "../../../components/providers/AdminProvider";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Home,
  Loader2,
  Lock,
  RefreshCcw,
  User,
  Wallet,
  XCircle,
} from "lucide-react";

function getPasswordErrorMessage(error: unknown) {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Could not update password.";

  const message = rawMessage.trim() || "Could not update password.";
  const lower = message.toLowerCase();

  if (
    lower.includes("not signed in") ||
    lower.includes("not authenticated") ||
    lower.includes("session") ||
    lower.includes("unauthorised") ||
    lower.includes("unauthorized") ||
    lower.includes("401")
  ) {
    return [
      "Password change failed because your Admin Portal login session is not active.",
      "",
      "What to do:",
      "1. Log out of the admin portal.",
      "2. Sign in again with your admin email.",
      "3. Come back to Profile Settings and try changing the password again.",
      "",
      `Technical detail: ${message}`,
    ].join("\n");
  }

  return [
    "Password change failed.",
    "",
    "What to do:",
    "1. Check the new password is strong enough.",
    "2. Make sure both password boxes match.",
    "3. Refresh the page and try again.",
    "",
    `Technical detail: ${message}`,
  ].join("\n");
}

function getLocalPasswordValidationError({
  newPassword,
  confirmPassword,
  score,
}: {
  newPassword: string;
  confirmPassword: string;
  score: number;
}) {
  if (!newPassword || !confirmPassword) {
    return "Please enter your new password in both boxes.";
  }

  if (newPassword !== confirmPassword) {
    return "Passwords do not match.";
  }

  if (score < 5) {
    return [
      "Password change failed because the password is not strong enough.",
      "",
      "Your password needs:",
      "• At least 8 characters",
      "• An uppercase letter",
      "• A lowercase letter",
      "• A number",
      "• A symbol",
    ].join("\n");
  }

  return null;
}

async function readApiError(response: Response) {
  try {
    const json = await response.json();
    return json.error || json.message || `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

export default function ProfileSettingsClient() {
  const { admin, loading } = useAdmin();

  const [copiedEmail, setCopiedEmail] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const passwordStrength = useMemo(() => {
    const checks = {
      length: newPassword.length >= 8,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      symbol: /[^A-Za-z0-9]/.test(newPassword),
    };

    const score = Object.values(checks).filter(Boolean).length;

    return {
      label: !newPassword
        ? "Not started"
        : score <= 2
          ? "Weak"
          : score < 5
            ? "Good"
            : "Strong",
      score,
      percent: !newPassword ? 0 : score <= 2 ? 35 : score < 5 ? 70 : 100,
      colour: !newPassword
        ? "bg-white/10"
        : score <= 2
          ? "bg-red-500"
          : score < 5
            ? "bg-yellow-400"
            : "bg-emerald-400",
      text: !newPassword
        ? "text-white/60"
        : score <= 2
          ? "text-red-100"
          : score < 5
            ? "text-yellow-100"
            : "text-emerald-100",
      checks,
    };
  }, [newPassword]);

  const passwordsMatch =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    newPassword === confirmPassword;

  const passwordsDoNotMatch =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    newPassword !== confirmPassword;

  const canChangePassword =
    passwordStrength.score >= 5 && passwordsMatch && !savingPassword;

  async function copyEmail() {
    if (!admin?.email) return;

    try {
      await navigator.clipboard.writeText(admin.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 1500);
    } catch {
      setCopiedEmail(false);
    }
  }

  function resetPasswordForm() {
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage(null);
    setPasswordError(null);
  }

  async function changePassword() {
    try {
      setSavingPassword(true);
      setPasswordMessage(null);
      setPasswordError(null);

      const validationError = getLocalPasswordValidationError({
        newPassword,
        confirmPassword,
        score: passwordStrength.score,
      });

      if (validationError) {
        setPasswordError(validationError);
        return;
      }

      const response = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          newPassword,
          confirmPassword,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const json = await response.json();

      if (!json.ok) {
        throw new Error(json.error || "Could not update password.");
      }

      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage(
        json.message ||
          "Password changed successfully. You can now use your new password next time you sign in."
      );
    } catch (error) {
      setPasswordError(getPasswordErrorMessage(error));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="min-h-dvh overflow-x-hidden px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Link
          href="/Admin/Dashboard"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <section className="rounded-[2rem] border border-white/10 bg-[#11111f]/90 p-6 shadow-xl backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <User className="h-7 w-7" />
              </div>

              <div className="min-w-0">
                <h2 className="break-words text-2xl font-black">
                  Admin account tools
                </h2>
                <p className="mt-1 text-sm leading-6 text-white/60">
                  This account is signed in through the custom Admin Portal login.
                </p>
              </div>
            </div>

            <div className="min-w-0 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
              <div className="text-xs font-black uppercase tracking-wide text-white/45">
                Login email
              </div>
              <div className="mt-1 break-words text-sm font-bold text-white/80">
                {admin?.email || (loading ? "Loading..." : "Not available")}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ToolButton
              href="/Admin/Dashboard"
              icon={Home}
              title="Dashboard"
              desc="Go back to admin home"
            />

            <ToolButton
              href="/Admin/Dashboard/Forms"
              icon={FileText}
              title="Forms"
              desc="Website submissions"
            />

            <ToolButton
              href="/Admin/MoneyManagement"
              icon={Wallet}
              title="Money"
              desc="Finance dashboard"
            />

            <button
              type="button"
              onClick={copyEmail}
              disabled={!admin?.email}
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-left transition hover:bg-black/35 disabled:opacity-50"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <Copy className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <div className="break-words font-black">
                  {copiedEmail ? "Email copied" : "Copy email"}
                </div>
                <div className="mt-1 text-xs text-white/55">Copy login email</div>
              </div>
            </button>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#11111f]/90 p-6 shadow-xl backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <Lock className="h-6 w-6" />
              </div>

              <div className="min-w-0">
                <h2 className="break-words text-2xl font-black">
                  Change password
                </h2>
                <p className="text-sm text-white/60">
                  See what you are typing, check strength, and confirm before
                  changing your password.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPasswords((v) => !v)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-xs font-black text-white/75 transition hover:bg-white/20"
            >
              {showPasswords ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {showPasswords ? "Hide passwords" : "Show passwords"}
            </button>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <PasswordInput
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                show={showPasswords}
                placeholder="Type new password"
              />

              <PasswordInput
                label="Confirm new password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                show={showPasswords}
                placeholder="Type new password again"
              />

              {passwordsMatch && (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Passwords match.
                </div>
              )}

              {passwordsDoNotMatch && (
                <div className="flex items-center gap-2 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm font-bold text-red-100">
                  <XCircle className="h-4 w-4 shrink-0" />
                  Passwords do not match yet.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-black text-white/80">
                  Password strength
                </span>
                <span className={`text-sm font-black ${passwordStrength.text}`}>
                  {passwordStrength.label}
                </span>
              </div>

              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all ${passwordStrength.colour}`}
                  style={{ width: `${passwordStrength.percent}%` }}
                />
              </div>

              <div className="mt-4 grid gap-2 text-xs text-white/65 sm:grid-cols-2">
                <PasswordCheck ok={passwordStrength.checks.length}>
                  8+ characters
                </PasswordCheck>
                <PasswordCheck ok={passwordStrength.checks.uppercase}>
                  Uppercase letter
                </PasswordCheck>
                <PasswordCheck ok={passwordStrength.checks.lowercase}>
                  Lowercase letter
                </PasswordCheck>
                <PasswordCheck ok={passwordStrength.checks.number}>
                  Number
                </PasswordCheck>
                <PasswordCheck ok={passwordStrength.checks.symbol}>
                  Symbol
                </PasswordCheck>
                <PasswordCheck ok={passwordsMatch}>
                  Passwords match
                </PasswordCheck>
              </div>
            </div>
          </div>

          {passwordError && (
            <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-black">Password update problem</div>
                  <div className="mt-2 whitespace-pre-line break-words font-semibold leading-6">
                    {passwordError}
                  </div>
                </div>
              </div>
            </div>
          )}

          {passwordMessage && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{passwordMessage}</span>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={changePassword}
              disabled={!canChangePassword}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-purple-700 shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingPassword ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {savingPassword ? "Changing password..." : "Change password"}
            </button>

            <button
              type="button"
              onClick={resetPasswordForm}
              disabled={savingPassword}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20 disabled:opacity-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Clear password boxes
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function ToolButton({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: ElementType;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:bg-black/35"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0">
        <div className="break-words font-black">{title}</div>
        <div className="mt-1 text-xs text-white/55">{desc}</div>
      </div>
    </Link>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  show,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  placeholder: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-black text-white/80">{label}</span>

      <div className="mt-2 flex min-w-0 items-center rounded-2xl border border-white/10 bg-black/25 focus-within:border-pink-300/40">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          autoComplete="new-password"
          className="min-w-0 flex-1 rounded-2xl bg-transparent px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/35"
        />

        <div className="shrink-0 px-4 text-white/40">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </div>
      </div>
    </label>
  );
}

function PasswordCheck({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div
      className={[
        "flex min-w-0 items-center gap-2 rounded-xl px-3 py-2",
        ok ? "bg-emerald-500/10 text-emerald-100" : "bg-white/5 text-white/45",
      ].join(" ")}
    >
      {ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 opacity-50" />
      )}

      <span className="break-words font-bold">{children}</span>
    </div>
  );
}