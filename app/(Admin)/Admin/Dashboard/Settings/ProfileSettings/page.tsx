"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAdmin } from "../../../components/providers/AdminProvider";
import { supabaseBrowser } from "@/lib/supabase/supabaseBrowser";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Home,
  Loader2,
  Lock,
  Mail,
  RefreshCcw,
  ShieldCheck,
  User,
  Wallet,
  XCircle,
} from "lucide-react";

export default function ProfileSettingsPage() {
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

    if (!newPassword) {
      return {
        label: "Not started",
        score: 0,
        percent: 0,
        colour: "bg-white/10",
        text: "text-white/60",
        checks,
      };
    }

    if (score <= 2) {
      return {
        label: "Weak",
        score,
        percent: 35,
        colour: "bg-red-500",
        text: "text-red-100",
        checks,
      };
    }

    if (score === 3 || score === 4) {
      return {
        label: "Good",
        score,
        percent: 70,
        colour: "bg-yellow-400",
        text: "text-yellow-100",
        checks,
      };
    }

    return {
      label: "Strong",
      score,
      percent: 100,
      colour: "bg-emerald-400",
      text: "text-emerald-100",
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
    passwordStrength.score >= 4 && passwordsMatch && !savingPassword;

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

      if (!newPassword || !confirmPassword) {
        throw new Error("Please enter and confirm your new password.");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("Your new passwords do not match.");
      }

      if (passwordStrength.score < 4) {
        throw new Error(
          "Please use a stronger password with at least 8 characters, uppercase, lowercase, and a number or symbol."
        );
      }

      const { error } = await supabaseBrowser.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(error.message || "Could not update password.");
      }

      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password changed successfully.");
    } catch (error: any) {
      setPasswordError(error?.message || "Could not update password.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="min-h-dvh px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href="/Admin/Dashboard"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#11111f]/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 via-purple-500/15 to-blue-500/20" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white/80">
              <ShieldCheck className="h-4 w-4" />
              Admin Account Settings
            </div>

            <h1 className="mt-5 text-4xl font-black sm:text-5xl">
              Account security
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
              View your admin login details, copy your email, and change your
              Supabase password securely.
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#11111f]/90 p-6 shadow-xl backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <User className="h-7 w-7" />
              </div>

              <div>
                <h2 className="text-2xl font-black">Admin account tools</h2>
                <p className="mt-1 text-sm leading-6 text-white/60">
                  This account is signed in with Supabase Auth. Use the buttons
                  below to jump to common admin areas.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
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
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-left transition hover:bg-black/35 disabled:opacity-50"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <Copy className="h-5 w-5" />
              </div>

              <div>
                <div className="font-black">
                  {copiedEmail ? "Email copied" : "Copy email"}
                </div>
                <div className="mt-1 text-xs text-white/55">
                  Copy login email
                </div>
              </div>
            </button>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#11111f]/90 p-6 shadow-xl backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <Lock className="h-6 w-6" />
              </div>

              <div>
                <h2 className="text-2xl font-black">Change password</h2>
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
                  <CheckCircle2 className="h-4 w-4" />
                  Passwords match.
                </div>
              )}

              {passwordsDoNotMatch && (
                <div className="flex items-center gap-2 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm font-bold text-red-100">
                  <XCircle className="h-4 w-4" />
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
            <div className="mt-4 whitespace-pre-line rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm font-bold text-red-100">
              {passwordError}
            </div>
          )}

          {passwordMessage && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
              <CheckCircle2 className="h-4 w-4" />
              {passwordMessage}
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
              Change password
            </button>

            <button
              type="button"
              onClick={resetPasswordForm}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
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
  icon: typeof Home;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:bg-black/35"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
        <Icon className="h-5 w-5" />
      </div>

      <div>
        <div className="font-black">{title}</div>
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
    <label className="block">
      <span className="text-sm font-black text-white/80">{label}</span>

      <div className="mt-2 flex items-center rounded-2xl border border-white/10 bg-black/25 focus-within:border-pink-300/40">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-2xl bg-transparent px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/35"
        />

        <div className="px-4 text-white/40">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </div>
      </div>
    </label>
  );
}

function PasswordCheck({
  ok,
  children,
}: {
  ok: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={[
        "flex items-center gap-2 rounded-xl px-3 py-2",
        ok
          ? "bg-emerald-500/10 text-emerald-100"
          : "bg-white/5 text-white/45",
      ].join(" ")}
    >
      {ok ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : (
        <XCircle className="h-4 w-4 opacity-50" />
      )}
      <span className="font-bold">{children}</span>
    </div>
  );
}