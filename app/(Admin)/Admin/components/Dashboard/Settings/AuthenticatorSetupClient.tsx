"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  LockKeyhole,
  QrCode,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";

type SetupStage = "loading" | "ready" | "enrolling" | "confirming" | "enabled";

type TotpFactor = {
  id: string;
  friendlyName?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

type EnrolmentDetails = {
  factorId: string;
  qrCode: string;
  secret: string;
};

type ApiError = {
  title: string;
  message: string;
};

type StatusResponse = {
  ok?: boolean;
  enabled?: boolean;
  factorId?: string | null;
  preferredMethod?: "email" | "totp" | null;
  error?: string;
};

const STATUS_ENDPOINT = "/api/admin/settings/login/two-factor/authenticator";
const CODE_LENGTH = 6;

function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase browser environment variables are missing.");
  }

  return createBrowserClient(url, anonKey);
}

function normaliseCode(value: string) {
  return value.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

function friendlyDate(value?: string | null) {
  if (!value) return "Unknown date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AuthenticatorSetupClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [stage, setStage] = useState<SetupStage>("loading");
  const [factor, setFactor] = useState<TotpFactor | null>(null);
  const [enrolment, setEnrolment] = useState<EnrolmentDetails | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<ApiError | null>(null);
  const [copying, setCopying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const loadStatus = useCallback(async () => {
    setStage("loading");
    setError(null);

    try {
      const [factorResult, serverResponse] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        fetch(STATUS_ENDPOINT, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }),
      ]);

      if (factorResult.error) {
        throw new Error(factorResult.error.message);
      }

      const serverJson = (await serverResponse.json().catch(() => null)) as
        | StatusResponse
        | null;

      if (!serverResponse.ok || !serverJson?.ok) {
        throw new Error(
          serverJson?.error || "Unable to load authenticator settings.",
        );
      }

      const verifiedFactors = factorResult.data?.totp || [];
      const matchingFactor =
        verifiedFactors.find(
          (item) =>
            item.status === "verified" &&
            (!serverJson.factorId || item.id === serverJson.factorId),
        ) ||
        verifiedFactors.find((item) => item.status === "verified") ||
        null;

      if (matchingFactor) {
        setFactor({
          id: matchingFactor.id,
          friendlyName: matchingFactor.friendly_name,
          status: matchingFactor.status,
          createdAt: matchingFactor.created_at,
        });
        setStage("enabled");
        return;
      }

      setFactor(null);
      setStage("ready");
    } catch (caught) {
      setStage("ready");
      setError({
        title: "Unable to load authenticator settings",
        message:
          caught instanceof Error
            ? caught.message
            : "Please refresh the page and try again.",
      });
    }
  }, [supabase]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function beginEnrolment() {
    if (stage === "enrolling" || stage === "confirming") return;

    setError(null);
    setNotice(null);
    setStage("enrolling");

    try {
      /*
       * Remove abandoned, unverified TOTP factors before creating another.
       * Supabase limits the number of enrolled factors.
       */
      const listResult = await supabase.auth.mfa.listFactors();

      if (listResult.error) {
        throw new Error(listResult.error.message);
      }

      for (const item of listResult.data?.all || []) {
        if (item.factor_type === "totp" && item.status === "unverified") {
          await supabase.auth.mfa.unenroll({
            factorId: item.id,
          });
        }
      }

      const friendlyName = `Burton Pride Admin ${new Date().toLocaleDateString(
        "en-GB",
      )}`;

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName,
      });

      if (enrollError || !data?.totp?.qr_code || !data?.totp?.secret) {
        throw new Error(
          enrollError?.message || "Supabase did not return a QR code.",
        );
      }

      setEnrolment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setCode("");
      setStage("confirming");
    } catch (caught) {
      setStage("ready");
      setError({
        title: "Authenticator setup could not start",
        message:
          caught instanceof Error
            ? caught.message
            : "Please wait a moment and try again.",
      });
    }
  }

  async function confirmEnrolment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!enrolment || stage !== "confirming") return;

    const cleanCode = normaliseCode(code);

    setError(null);
    setNotice(null);

    if (cleanCode.length !== CODE_LENGTH) {
      setError({
        title: "Enter the complete code",
        message: "Enter the six-digit code shown in your authenticator app.",
      });
      return;
    }

    setStage("enrolling");

    try {
      const { data, error: verifyError } =
        await supabase.auth.mfa.challengeAndVerify({
          factorId: enrolment.factorId,
          code: cleanCode,
        });

      if (verifyError || !data) {
        throw new Error(
          verifyError?.message ||
            "The authenticator code could not be verified.",
        );
      }

      const response = await fetch(STATUS_ENDPOINT, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          factorId: enrolment.factorId,
          enabled: true,
          preferredMethod: "totp",
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | StatusResponse
        | null;

      if (!response.ok || !json?.ok) {
        /*
         * The Supabase factor is verified, so do not silently pretend setup
         * failed. Tell the admin that the portal record needs synchronising.
         */
        throw new Error(
          json?.error ||
            "The authenticator was verified, but the admin record could not be updated.",
        );
      }

      setFactor({
        id: enrolment.factorId,
        friendlyName: "Burton Pride Admin",
        status: "verified",
        createdAt: new Date().toISOString(),
      });
      setEnrolment(null);
      setCode("");
      setStage("enabled");
      setNotice({
        title: "Authenticator app enabled",
        message:
          "Your admin account will now accept codes from your authenticator app.",
      });
    } catch (caught) {
      setStage("confirming");
      setCode("");
      setError({
        title: "Code not accepted",
        message:
          caught instanceof Error
            ? caught.message
            : "Open your authenticator app and enter the newest six-digit code.",
      });
    }
  }

  async function cancelEnrolment() {
    if (!enrolment) {
      setStage("ready");
      return;
    }

    setError(null);

    try {
      await supabase.auth.mfa.unenroll({
        factorId: enrolment.factorId,
      });
    } catch {
      // The unverified factor will expire or can be removed on the next setup.
    }

    setEnrolment(null);
    setCode("");
    setStage("ready");
  }

  async function copySecret() {
    if (!enrolment?.secret) return;

    setCopying(true);

    try {
      await navigator.clipboard.writeText(enrolment.secret);
      setNotice({
        title: "Setup key copied",
        message: "Paste the key into your authenticator app.",
      });
    } catch {
      setError({
        title: "Could not copy the key",
        message: "Select the setup key and copy it manually.",
      });
    } finally {
      setCopying(false);
    }
  }

  async function removeAuthenticator() {
    if (!factor || removing) return;

    setShowRemoveConfirm(false);
    setRemoving(true);
    setError(null);
    setNotice(null);

    try {
      const assuranceResult =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (assuranceResult.error) {
        throw new Error(assuranceResult.error.message);
      }

      if (assuranceResult.data.currentLevel !== "aal2") {
        throw new Error(
          "For security, sign out and sign back in with your authenticator code before removing this factor.",
        );
      }

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: factor.id,
      });

      if (unenrollError) {
        throw new Error(unenrollError.message);
      }

      const response = await fetch(STATUS_ENDPOINT, {
        method: "DELETE",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          factorId: factor.id,
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | StatusResponse
        | null;

      if (!response.ok || !json?.ok) {
        throw new Error(
          json?.error ||
            "The factor was removed from Supabase but the admin record could not be updated.",
        );
      }

      setFactor(null);
      setStage("ready");
      setNotice({
        title: "Authenticator app removed",
        message:
          "Your account will use another enabled two-step method when you next sign in.",
      });
    } catch (caught) {
      setError({
        title: "Authenticator could not be removed",
        message:
          caught instanceof Error
            ? caught.message
            : "Please try again.",
      });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <main className="min-h-screen w-full bg-transparent px-3 py-5 text-white sm:px-5 sm:py-7 lg:px-7">
      <div className="w-full max-w-none">
        <Link
          href="/Admin/Settings"
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to settings
        </Link>

        <header className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-[linear-gradient(115deg,rgba(236,72,153,0.96)_0%,rgba(192,73,226,0.95)_48%,rgba(142,76,246,0.96)_100%)] p-6 shadow-[0_24px_80px_rgba(116,35,190,0.32)] sm:p-8 lg:p-9">
          <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-8 h-72 w-72 rounded-full bg-fuchsia-300/20 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-white/85">
                <ShieldCheck className="h-4 w-4" />
                Admin security
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                Authenticator app
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/80 sm:text-base">
                Connect Google Authenticator, Microsoft Authenticator, 1Password,
                Authy or another TOTP-compatible app. The app creates a new
                six-digit code roughly every 30 seconds.
              </p>
            </div>

            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.75rem] border border-white/20 bg-white/12 text-white shadow-xl backdrop-blur-sm">
              <Smartphone className="h-10 w-10" />
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-[2rem] border border-white/14 bg-white/[0.045] p-6 shadow-xl backdrop-blur-md sm:p-8">
            {notice ? (
              <MessagePanel tone="success" message={notice} />
            ) : null}

            {error ? <MessagePanel tone="error" message={error} /> : null}

            {stage === "loading" ? (
              <div className="flex min-h-72 items-center justify-center">
                <div className="text-center">
                  <Loader2 className="mx-auto h-9 w-9 animate-spin text-fuchsia-200" />
                  <p className="mt-4 font-black">
                    Loading authenticator settings...
                  </p>
                </div>
              </div>
            ) : null}

            {stage === "ready" ? (
              <div>
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.06]">
                  <QrCode className="h-8 w-8 text-fuchsia-100" />
                </div>

                <h2 className="mt-6 text-2xl font-black">
                  Set up an authenticator app
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
                  You will scan a secure QR code and then enter the current code
                  from your app. Do not share the QR code or setup key.
                </p>

                <button
                  type="button"
                  onClick={() => void beginEnrolment()}
                  className="mt-7 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-purple-700 shadow-lg transition hover:bg-white/90"
                >
                  <Smartphone className="h-4 w-4" />
                  Start authenticator setup
                </button>
              </div>
            ) : null}

            {stage === "confirming" && enrolment ? (
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-fuchsia-100">
                    <QrCode className="h-6 w-6" />
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-200">
                      Step 1
                    </p>
                    <h2 className="text-xl font-black">Scan the QR code</h2>
                  </div>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
                  <div className="rounded-3xl bg-white p-5">
                    <img
                      src={enrolment.qrCode}
                      alt="QR code for adding Burton Pride Admin to an authenticator app"
                      className="aspect-square w-full"
                    />
                  </div>

                  <div>
                    <ol className="space-y-4 text-sm leading-7 text-white/65">
                      <li>
                        <strong className="text-white">1.</strong> Open your
                        authenticator app.
                      </li>
                      <li>
                        <strong className="text-white">2.</strong> Choose to add
                        or scan a new account.
                      </li>
                      <li>
                        <strong className="text-white">3.</strong> Scan the QR
                        code on this page.
                      </li>
                    </ol>

                    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.15em] text-white/45">
                        Cannot scan the QR code?
                      </p>
                      <p className="mt-2 break-all font-mono text-sm text-white/80">
                        {enrolment.secret}
                      </p>
                      <button
                        type="button"
                        onClick={() => void copySecret()}
                        disabled={copying}
                        className="mt-3 inline-flex items-center gap-2 text-xs font-black text-fuchsia-200"
                      >
                        {copying ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        Copy setup key
                      </button>
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={confirmEnrolment}
                  className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-5"
                >
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-200">
                    Step 2
                  </p>
                  <h3 className="mt-1 text-xl font-black">
                    Confirm the current code
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/55">
                    Enter the six-digit code currently shown in your app.
                  </p>

                  <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4 focus-within:border-fuchsia-300/60">
                    <KeyRound className="h-5 w-5 text-white/40" />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      autoFocus
                      value={code}
                      onChange={(event) =>
                        setCode(normaliseCode(event.target.value))
                      }
                      maxLength={CODE_LENGTH}
                      placeholder="000000"
                      className="w-full bg-transparent text-center font-mono text-2xl font-black tracking-[0.45em] outline-none placeholder:text-white/20"
                    />
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="submit"
                      disabled={code.length !== CODE_LENGTH}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-purple-700 shadow-lg transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Verify and enable
                    </button>

                    <button
                      type="button"
                      onClick={() => void cancelEnrolment()}
                      className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black transition hover:bg-white/[0.1]"
                    >
                      Cancel setup
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            {stage === "enrolling" ? (
              <div className="flex min-h-72 items-center justify-center">
                <div className="text-center">
                  <Loader2 className="mx-auto h-9 w-9 animate-spin text-fuchsia-200" />
                  <p className="mt-4 font-black">
                    Updating secure authenticator settings...
                  </p>
                </div>
              </div>
            ) : null}

            {stage === "enabled" && factor ? (
              <div>
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-emerald-300/20 bg-emerald-500/15 text-emerald-100">
                  <CheckCircle2 className="h-8 w-8" />
                </div>

                <h2 className="mt-6 text-2xl font-black">
                  Authenticator app is enabled
                </h2>

                <p className="mt-3 text-sm leading-7 text-white/60">
                  Your account can now use a six-digit authenticator code during
                  Burton Pride admin login.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <InfoCard
                    label="Factor name"
                    value={factor.friendlyName || "Burton Pride Admin"}
                  />
                  <InfoCard
                    label="Added"
                    value={friendlyDate(factor.createdAt)}
                  />
                  <InfoCard label="Status" value="Verified and active" />
                  <InfoCard label="Method" value="Authenticator app (TOTP)" />
                </div>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void loadStatus()}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black transition hover:bg-white/[0.1]"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Refresh status
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRemoveConfirm(true)}
                    disabled={removing}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-300/20 bg-red-500/10 px-5 py-3 text-sm font-black text-red-100 transition hover:bg-red-500/15 disabled:opacity-50"
                  >
                    {removing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Remove authenticator
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <aside className="space-y-6">
            <SideCard
              icon={LockKeyhole}
              title="Keep the setup key private"
              text="Anyone with the QR code or setup key could generate your security codes."
            />

            <SideCard
              icon={Smartphone}
              title="Works with common apps"
              text="Google Authenticator, Microsoft Authenticator, 1Password, Authy and other TOTP apps are supported."
            />

            <SideCard
              icon={ShieldCheck}
              title="Do not remove your backup method"
              text="Keep email verification enabled unless another secure recovery method is available."
            />
          </aside>
        </div>
      </div>

      {showRemoveConfirm ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-authenticator-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !removing) {
              setShowRemoveConfirm(false);
            }
          }}
        >
          <div className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/15 bg-[#111827] shadow-[0_32px_120px_rgba(0,0,0,0.65)]">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500" />

            <button
              type="button"
              onClick={() => setShowRemoveConfirm(false)}
              disabled={removing}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/60 transition hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Close confirmation"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="p-6 pt-8 sm:p-8 sm:pt-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-red-300/20 bg-red-500/15 text-red-100">
                <Trash2 className="h-7 w-7" />
              </div>

              <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-red-200">
                Security confirmation
              </p>

              <h2
                id="remove-authenticator-title"
                className="mt-2 text-2xl font-black text-white sm:text-3xl"
              >
                Remove authenticator app?
              </h2>

              <p className="mt-4 text-sm leading-7 text-white/60">
                This will remove the authenticator app from your Burton Pride
                admin account. You will no longer be able to use its six-digit
                codes when signing in.
              </p>

              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-100" />
                  <div>
                    <p className="text-sm font-black text-amber-50">
                      Keep a backup verification method
                    </p>
                    <p className="mt-1 text-xs leading-5 text-amber-50/75">
                      Email verification must remain enabled before the
                      authenticator app can be removed.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowRemoveConfirm(false)}
                  disabled={removing}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Keep authenticator
                </button>

                <button
                  type="button"
                  onClick={() => void removeAuthenticator()}
                  disabled={removing}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-300/20 bg-red-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/30 transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {removing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Remove authenticator
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function MessagePanel({
  tone,
  message,
}: {
  tone: "success" | "error";
  message: ApiError;
}) {
  const success = tone === "success";

  return (
    <div
      role={success ? "status" : "alert"}
      className={`mb-6 rounded-2xl border p-4 ${
        success
          ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-50"
          : "border-red-300/20 bg-red-500/10 text-red-50"
      }`}
    >
      <div className="flex gap-3">
        {success ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        )}
        <div>
          <p className="font-black">{message.title}</p>
          <p className="mt-1 text-sm leading-6 opacity-85">
            {message.message}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">
        {label}
      </p>
      <p className="mt-2 font-black text-white">{value}</p>
    </div>
  );
}

function SideCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ShieldCheck;
  title: string;
  text: string;
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/14 bg-white/[0.045] p-5 shadow-lg backdrop-blur-md">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-fuchsia-100">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-4 font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-white/55">{text}</p>
    </section>
  );
}
