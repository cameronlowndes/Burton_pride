"use client";

import { memo, useCallback, useState } from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

type PasswordInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
  name: string;
};

type ApiErrorData = {
  ok?: boolean;
  error?: string;
  message?: string;
  likelyFix?: string;
  debug?: unknown;
  details?: unknown;
};

type ApiReadResult = {
  data: ApiErrorData;
  rawText: string;
  contentType: string;
};

function stringifySafe(value: unknown) {
  try {
    if (!value) return "";
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildDetailedError({
  data,
  status,
  statusText,
  url,
  method,
  rawText,
  contentType,
}: {
  data: ApiErrorData;
  status: number;
  statusText: string;
  url: string;
  method: string;
  rawText: string;
  contentType: string;
}) {
  const parts: string[] = [];

  parts.push(`HTTP status: ${status} ${statusText || ""}`.trim());
  parts.push(`Request: ${method} ${url}`);
  parts.push(`Content-Type: ${contentType || "Not returned"}`);

  if (data?.error) parts.push(`Error: ${data.error}`);
  if (data?.message && data.message !== data.error) {
    parts.push(`Message: ${data.message}`);
  }
  if (data?.likelyFix) parts.push(`Likely fix: ${data.likelyFix}`);

  const details = stringifySafe(data?.details);
  if (details) parts.push(`Details:\n${details}`);

  const debug = stringifySafe(data?.debug);
  if (debug) parts.push(`Debug:\n${debug}`);

  if (rawText && !contentType.includes("application/json")) {
    parts.push(`Raw server response:\n${rawText.slice(0, 2000)}`);
  }

  if (status === 405) {
    parts.push(
      "Possible cause: this API route does not export the HTTP method you are calling."
    );
  }

  if (status === 401) {
    parts.push("Possible cause: admin login cookies are missing or expired.");
  }

  if (status === 500) {
    parts.push("Possible cause: server error in the API route.");
  }

  return parts.join("\n\n");
}

async function readApiResponse(res: Response): Promise<ApiReadResult> {
  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();

  if (!rawText) {
    return {
      contentType,
      rawText,
      data: {
        ok: false,
        error: "The server returned an empty response body.",
      },
    };
  }

  try {
    return {
      contentType,
      rawText,
      data: JSON.parse(rawText) as ApiErrorData,
    };
  } catch {
    return {
      contentType,
      rawText,
      data: {
        ok: false,
        error:
          "The server did not return valid JSON. This normally means the API crashed or returned an HTML error page.",
      },
    };
  }
}

const PasswordInput = memo(function PasswordInput({
  value,
  onChange,
  placeholder,
  visible,
  onToggle,
  name,
}: PasswordInputProps) {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    },
    [onChange]
  );

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        name={name}
        autoComplete="new-password"
        spellCheck={false}
        className="w-full rounded-2xl border border-white/40 bg-white px-5 py-4 pr-14 font-bold text-black shadow-lg outline-none placeholder:text-slate-400 focus:border-yellow-300 focus:ring-4 focus:ring-yellow-300/30"
      />

      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
});

export default function DeletePasswordClient() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [resetPassword, setResetPassword] = useState("");
  const [confirmResetPassword, setConfirmResetPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showConfirmResetPassword, setShowConfirmResetPassword] =
    useState(false);

  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const toggleCurrent = useCallback(
    () => setShowCurrentPassword((prev) => !prev),
    []
  );
  const toggleNew = useCallback(() => setShowNewPassword((prev) => !prev), []);
  const toggleConfirm = useCallback(
    () => setShowConfirmPassword((prev) => !prev),
    []
  );
  const toggleReset = useCallback(
    () => setShowResetPassword((prev) => !prev),
    []
  );
  const toggleConfirmReset = useCallback(
    () => setShowConfirmResetPassword((prev) => !prev),
    []
  );

  async function updatePassword() {
    setSaving(true);
    setMessage("");
    setError("");

    const url = "/api/admin/settings/delete-password/update";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const result = await readApiResponse(res);

      if (!res.ok || !result.data.ok) {
        setError(
          buildDetailedError({
            data: result.data,
            status: res.status,
            statusText: res.statusText,
            url,
            method: "POST",
            rawText: result.rawText,
            contentType: result.contentType,
          })
        );
        return;
      }

      setMessage(result.data.message || "Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Client/network error:\n${err.message}`
          : "Client/network error: Failed to update password."
      );
    } finally {
      setSaving(false);
    }
  }

  async function resetForgottenPassword() {
    setResetting(true);
    setMessage("");
    setError("");

    const url = "/api/admin/settings/delete-password";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: resetPassword,
          confirmPassword: confirmResetPassword,
        }),
      });

      const result = await readApiResponse(res);

      if (!res.ok || !result.data.ok) {
        setError(
          buildDetailedError({
            data: result.data,
            status: res.status,
            statusText: res.statusText,
            url,
            method: "POST",
            rawText: result.rawText,
            contentType: result.contentType,
          })
        );
        return;
      }

      setMessage(result.data.message || "Password reset successfully.");
      setResetPassword("");
      setConfirmResetPassword("");
      setShowResetPassword(false);
      setShowConfirmResetPassword(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Client/network error:\n${err.message}`
          : "Client/network error: Failed to reset password."
      );
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/25 bg-white/20 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-yellow-300 text-black shadow-lg">
              <LockKeyhole className="h-7 w-7" />
            </div>

            <div className="min-w-0">
              <h1 className="break-words text-3xl font-black text-white drop-shadow sm:text-4xl">
                Main Admin Delete Password
              </h1>

              <p className="mt-2 text-sm font-semibold text-white/85">
                Manage the password used for protected money tracker actions.
              </p>
            </div>
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-green-200/40 bg-green-500/25 p-4 font-bold text-green-50 shadow-xl backdrop-blur-xl">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200/40 bg-red-500/30 p-4 font-bold text-red-50 shadow-xl backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="font-black">Something went wrong</p>
                <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-black/30 p-4 text-xs font-semibold leading-relaxed text-white">
                  {error}
                </pre>
              </div>
            </div>
          </div>
        )}

        <section className="rounded-[2rem] border border-white/25 bg-white/20 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-5 flex items-start gap-3">
            <div className="rounded-2xl bg-yellow-300 p-3 text-black shadow-lg">
              <ShieldCheck className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-white">
                Update Password
              </h2>

              <p className="mt-1 text-sm font-semibold text-white/80">
                Use this when you know the current delete password and want to
                change it safely.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <PasswordInput
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="Current password"
              visible={showCurrentPassword}
              onToggle={toggleCurrent}
              name="current-delete-password"
            />

            <PasswordInput
              value={newPassword}
              onChange={setNewPassword}
              placeholder="New password"
              visible={showNewPassword}
              onToggle={toggleNew}
              name="new-delete-password"
            />

            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Confirm new password"
              visible={showConfirmPassword}
              onToggle={toggleConfirm}
              name="confirm-new-delete-password"
            />

            <button
              type="button"
              disabled={saving}
              onClick={updatePassword}
              className="rounded-full bg-yellow-300 px-7 py-3 font-black text-black shadow-lg hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Updating..." : "Update Password"}
            </button>
          </div>
        </section>

        <section className="rounded-[2rem] border border-red-200/40 bg-red-500/25 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-5 flex items-start gap-3">
            <div className="rounded-2xl bg-red-500 p-3 text-white shadow-lg">
              <LockKeyhole className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-white">
                Forgot Password Reset
              </h2>

              <p className="mt-1 text-sm font-semibold text-white/85">
                Only main admin should use this reset option.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <PasswordInput
              value={resetPassword}
              onChange={setResetPassword}
              placeholder="New reset password"
              visible={showResetPassword}
              onToggle={toggleReset}
              name="reset-delete-password"
            />

            <PasswordInput
              value={confirmResetPassword}
              onChange={setConfirmResetPassword}
              placeholder="Confirm reset password"
              visible={showConfirmResetPassword}
              onToggle={toggleConfirmReset}
              name="confirm-reset-delete-password"
            />

            <button
              type="button"
              disabled={resetting}
              onClick={resetForgottenPassword}
              className="rounded-full bg-red-500 px-7 py-3 font-black text-white shadow-lg hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resetting ? "Resetting..." : "Reset Forgotten Password"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}