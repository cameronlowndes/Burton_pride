"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Unlink,
} from "lucide-react";

type GoogleStatusResponse = {
  ok: boolean;
  connected: boolean;
  googleEmail?: string | null;
  expiresAt?: number | null;
  error?: string;
};

type Notice = {
  type: "success" | "error";
  message: string;
} | null;

function formatExpiry(expiresAt?: number | null) {
  if (!expiresAt) return "Unknown";

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function PageGlow() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-12rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/20 blur-[140px]" />
        <div className="absolute right-[-10rem] top-[4rem] h-[24rem] w-[24rem] rounded-full bg-violet-500/20 blur-[140px]" />
        <div className="absolute bottom-[-12rem] left-[15%] h-[30rem] w-[30rem] rounded-full bg-indigo-500/15 blur-[160px]" />
        <div className="absolute bottom-[-10rem] right-[10%] h-[24rem] w-[24rem] rounded-full bg-cyan-500/10 blur-[150px]" />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_18%,transparent_82%,rgba(255,255,255,0.03))]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.12),transparent_22%),radial-gradient(circle_at_right,rgba(168,85,247,0.12),transparent_20%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.10),transparent_24%)]" />
    </>
  );
}

function DotGrid() {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-[0.10]">
      <div className="h-full w-full bg-[radial-gradient(circle,white_1px,transparent_1px)] [background-size:26px_26px]" />
    </div>
  );
}

function TopBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-fuchsia-100">
      <Mail className="h-3.5 w-3.5" />
      Burton Pride Admin Email
    </div>
  );
}

function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-3xl border border-white/10 bg-white/[0.045] shadow-[0_20px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function SmallInfoCard({
  icon,
  title,
  text,
  tone = "default",
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  tone?: "default" | "success" | "info";
}) {
  const toneClasses =
    tone === "success"
      ? "border-emerald-400/15 bg-emerald-500/[0.07]"
      : tone === "info"
      ? "border-indigo-400/15 bg-indigo-500/[0.07]"
      : "border-white/10 bg-black/20";

  return (
    <div className={clsx("rounded-3xl border p-5", toneClasses)}>
      <div className="flex items-start gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-7 text-white/65">{text}</p>
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  connected,
  loading,
}: {
  connected: boolean;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/70">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        Checking status
      </div>
    );
  }

  if (connected) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-100">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Google connected
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-100">
      <AlertCircle className="h-3.5 w-3.5" />
      Not connected
    </div>
  );
}

function GoogleButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group inline-flex min-h-[56px] cursor-pointer items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-violet-600 px-6 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(194,24,91,0.35)] transition duration-200 hover:scale-[1.01] hover:from-fuchsia-500 hover:via-pink-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-900 shadow-sm">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          aria-hidden="true"
          fill="currentColor"
        >
          <path d="M21.805 10.023h-9.783v3.955h5.61c-.241 1.269-.965 2.344-2.057 3.063v2.54h3.323c1.945-1.79 3.067-4.427 3.067-7.558 0-.669-.059-1.312-.16-2Z" />
          <path d="M12.022 22c2.781 0 5.114-.921 6.818-2.498l-3.323-2.54c-.922.618-2.102.99-3.495.99-2.684 0-4.958-1.812-5.77-4.248H2.818v2.62A9.99 9.99 0 0 0 12.022 22Z" />
          <path d="M6.252 13.704a5.997 5.997 0 0 1-.323-1.94c0-.673.117-1.323.323-1.94V7.204H2.818A9.985 9.985 0 0 0 2 11.764c0 1.61.387 3.136.818 4.56l3.434-2.62Z" />
          <path d="M12.022 5.576c1.513 0 2.872.521 3.939 1.544l2.953-2.952C17.132 2.521 14.8 1.6 12.022 1.6a9.99 9.99 0 0 0-9.204 5.604l3.434 2.62c.812-2.437 3.086-4.248 5.77-4.248Z" />
        </svg>
      </span>
      Continue with Google
      <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
    </button>
  );
}

function SecondaryButton({
  onClick,
  disabled,
  children,
  spinning = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  spinning?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-[56px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] px-5 text-sm font-medium text-white transition hover:bg-white/[0.10] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw className={clsx("h-4 w-4", spinning && "animate-spin")} />
      {children}
    </button>
  );
}

function DangerButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Unlink className="h-4 w-4" />
      {children}
    </button>
  );
}

function NoticeBanner({ notice }: { notice: Notice }) {
  if (!notice) return null;

  return (
    <div
      className={clsx(
        "mb-6 rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur-sm",
        notice.type === "success"
          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
          : "border-rose-400/30 bg-rose-500/10 text-rose-100"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {notice.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
        </div>
        <p>{notice.message}</p>
      </div>
    </div>
  );
}

function SectionEyebrow({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
      <Sparkles className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}

function HeroSteps() {
  const items = [
    {
      title: "Sign in with the Burton Pride Google account",
      text: "Use the Google login button to connect the admin portal to the correct email account.",
    },
    {
      title: "The page reloads with connected account details",
      text: "Once connected, this screen changes automatically and shows the linked email address.",
    },
    {
      title: "Build sending tools after that",
      text: "The next step is adding the email composer, templates, logs, and test send tools.",
    },
  ];

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.title}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-sm font-bold text-white/85">
              {index + 1}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <p className="mt-1 text-sm leading-6 text-white/60">{item.text}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RightFeatureList() {
  const items = [
    "Show connected Google email address",
    "Show token expiry information",
    "Unlock send email tools",
    "Enable future templates and email history",
    "Allow secure account disconnect when needed",
    "Prepare for single-send and bulk-send features later",
  ];

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item}
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80"
        >
          {item}
        </div>
      ))}
    </div>
  );
}

function LeftHeroText() {
  return (
    <div>
      <TopBadge />

      <div className="mt-6">
        <StatusPill connected={false} loading={false} />
      </div>

      <h1 className="mt-6 text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
        Sign in with Google
        <span className="block bg-gradient-to-r from-fuchsia-300 via-pink-200 to-violet-200 bg-clip-text text-transparent">
          without the big boxed board
        </span>
      </h1>

      <p className="mt-6 max-w-3xl text-base leading-8 text-white/68 md:text-lg">
        Connect your Burton Pride Google account to unlock the admin email
        system. This page now uses a full-page layout, so it feels cleaner,
        more open, and less cramped. Once signed in, the page reloads and
        shows your connected account details.
      </p>
    </div>
  );
}

function LoginStateLayout({
  status,
  refreshing,
  onRefresh,
  onConnect,
}: {
  status: GoogleStatusResponse | null;
  refreshing: boolean;
  onRefresh: () => void;
  onConnect: () => void;
}) {
  return (
    <div className="relative z-10">
      <div className="w-full px-4 pb-14 pt-8 md:px-6 lg:px-8">
        <div className="grid min-h-[calc(100vh-5rem)] gap-12 xl:grid-cols-[minmax(0,1.2fr)_420px] xl:gap-10">
          <div className="relative min-w-0">
            <LeftHeroText />

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <SmallInfoCard
                icon={<CheckCircle2 className="h-5 w-5 text-emerald-200" />}
                title="What this does"
                text="Lets the admin portal use your Google account for future approved email sending features."
                tone="success"
              />

              <SmallInfoCard
                icon={<ShieldCheck className="h-5 w-5 text-indigo-200" />}
                title="Secure connection"
                text="The Google account is only used for approved admin email features inside the Burton Pride portal."
                tone="info"
              />
            </div>

            {status?.error ? (
              <div className="mt-4 rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5 text-sm text-rose-100">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <AlertCircle className="h-4 w-4" />
                  Connection issue
                </div>
                <p className="leading-7">{status.error}</p>
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-4">
              <GoogleButton onClick={onConnect} />
              <SecondaryButton onClick={onRefresh} spinning={refreshing}>
                Refresh status
              </SecondaryButton>
            </div>

            <div className="mt-6 text-sm text-white/45">
              After login, this page reloads and shows your connected account.
            </div>

            <div className="mt-10 max-w-3xl">
              <SectionEyebrow label="How it works" />
              <div className="mt-4">
                <HeroSteps />
              </div>
            </div>
          </div>

          <div className="relative min-w-0">
            <GlassCard className="p-6 md:p-7 lg:p-8">
              <h2 className="text-2xl font-semibold text-white">
                What happens after login?
              </h2>

              <p className="mt-3 text-sm leading-7 text-white/62">
                Right now this page acts as the login step for the future admin
                email system. Once connected, the next UI can show account
                details, compose tools, templates, and email history.
              </p>

              <div className="mt-6">
                <RightFeatureList />
              </div>

              <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm leading-7 text-amber-100">
                This page is now full-width and cleaner, without the large boxed
                board in the middle of the screen.
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.06] p-2.5">
                    <Mail className="h-4 w-4 text-fuchsia-200" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Admin email system
                    </p>
                    <p className="text-sm text-white/60">
                      Clean login first, tools after connection.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <Link
                  href="/Admin/Dashboard"
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] px-4 text-sm font-medium text-white transition hover:bg-white/[0.10]"
                >
                  Back to dashboard
                </Link>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectedHero({
  email,
  expiresAt,
  refreshing,
  disconnecting,
  onRefresh,
  onDisconnect,
}: {
  email?: string | null;
  expiresAt?: number | null;
  refreshing: boolean;
  disconnecting: boolean;
  onRefresh: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="relative z-10">
      <div className="w-full px-4 pb-14 pt-8 md:px-6 lg:px-8">
        <div className="grid gap-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
            <div className="min-w-0">
              <TopBadge />

              <div className="mt-6">
                <StatusPill connected loading={false} />
              </div>

              <h1 className="mt-6 text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
                Email account connected
                <span className="block bg-gradient-to-r from-emerald-300 via-cyan-200 to-violet-200 bg-clip-text text-transparent">
                  ready for the next tools
                </span>
              </h1>

              <p className="mt-6 max-w-4xl text-base leading-8 text-white/68 md:text-lg">
                Your Google account is connected successfully. This page can now
                grow into the Burton Pride admin email system with sending,
                templates, test emails, and history logs.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <SecondaryButton onClick={onRefresh} spinning={refreshing}>
                  Refresh
                </SecondaryButton>

                <DangerButton onClick={onDisconnect} disabled={disconnecting}>
                  {disconnecting ? "Disconnecting..." : "Disconnect Google"}
                </DangerButton>
              </div>
            </div>

            <div className="min-w-0">
              <GlassCard className="h-full p-6 md:p-7 lg:p-8">
                <h2 className="text-2xl font-semibold text-white">
                  Connected account
                </h2>
                <p className="mt-3 text-sm leading-7 text-white/62">
                  This data is shown after the Google login finishes and the page
                  reloads into the connected state.
                </p>

                <div className="mt-6 grid gap-4">
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/38">
                      Connected email
                    </p>
                    <p className="mt-3 break-all text-lg font-semibold text-white">
                      {email || "Unknown email"}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/38">
                      Token expiry
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-white/55" />
                      <p className="text-base font-semibold text-white">
                        {formatExpiry(expiresAt)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5">
                    <div className="mb-2 flex items-center gap-2 text-emerald-100">
                      <ShieldCheck className="h-5 w-5" />
                      <span className="font-semibold">
                        Connected successfully
                      </span>
                    </div>
                    <p className="text-sm leading-7 text-emerald-50/90">
                      The portal detected your linked Google account and loaded
                      the connected account state automatically.
                    </p>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_340px]">
            <GlassCard className="p-6 md:p-7 lg:p-8">
              <SectionEyebrow label="Next build stage" />
              <h2 className="mt-4 text-2xl font-semibold text-white">
                Email tools to build next
              </h2>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-white/62">
                Now that the login step is done, this page can become the base
                for the full admin email area.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {[
                  {
                    title: "Send single emails",
                    text: "Compose and send one-off emails directly from the admin portal.",
                  },
                  {
                    title: "Templates",
                    text: "Save reusable templates for competitions, contact forms, and updates.",
                  },
                  {
                    title: "Test send",
                    text: "Send a preview email before using a template for real messages.",
                  },
                  {
                    title: "Email logs",
                    text: "Keep a basic history of what was sent and when it was sent.",
                  },
                  {
                    title: "Bulk tools",
                    text: "Prepare approved group send tools for future contacts and supporters.",
                  },
                  {
                    title: "Draft system",
                    text: "Create drafts first before sending important Burton Pride emails.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
                  >
                    <h3 className="text-base font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-white/62">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-6 md:p-7 lg:p-8">
              <h2 className="text-xl font-semibold text-white">Quick actions</h2>
              <p className="mt-2 text-sm leading-7 text-white/62">
                Keep this side simple for now, then add real actions later.
              </p>

              <div className="mt-5 space-y-3">
                {[
                  "Add send email form",
                  "Add Gmail sending API route",
                  "Add template manager",
                  "Add delivery logs",
                  "Add test send option",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/80"
                  >
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-4 text-sm leading-7 text-fuchsia-100">
                Best next step: build the send email form and Gmail sending route
                under this connected state.
              </div>

              <div className="mt-6">
                <Link
                  href="/Admin/Dashboard"
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] px-4 text-sm font-medium text-white transition hover:bg-white/[0.10]"
                >
                  Back to dashboard
                </Link>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="relative z-10">
      <div className="flex min-h-screen w-full items-center px-4 py-8 md:px-6 lg:px-8">
        <div className="max-w-3xl">
          <TopBadge />

          <div className="mt-6">
            <StatusPill connected={false} loading />
          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
            Loading email settings
          </h1>

          <p className="mt-6 max-w-3xl text-base leading-8 text-white/65 md:text-lg">
            Checking your Google connection status and preparing the admin email
            page.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="h-36 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]"
              />
            ))}
          </div>

          <div className="mt-6 h-14 w-48 animate-pulse rounded-2xl border border-white/10 bg-white/[0.05]" />
        </div>
      </div>
    </div>
  );
}

function BottomDecoration() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 px-4 md:px-6 lg:px-8">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

function FooterLine() {
  return (
    <div className="relative z-10 border-t border-white/10">
      <div className="flex w-full flex-col gap-3 px-4 py-5 text-xs text-white/40 md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
        <div>Burton Pride Admin Portal</div>
        <div>Google email connection page</div>
      </div>
    </div>
  );
}

function DisconnectModal({
  open,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3">
            <Unlink className="h-5 w-5 text-rose-200" />
          </div>

          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-white">
              Disconnect Google account?
            </h2>
            <p className="mt-2 text-sm leading-7 text-white/65">
              This will remove the linked Google account from the admin portal.
              You can reconnect it again later.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] px-5 text-sm font-medium text-white transition hover:bg-white/[0.10] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Disconnecting...
              </>
            ) : (
              <>
                <Unlink className="h-4 w-4" />
                Disconnect
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminEmailPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
  const [status, setStatus] = useState<GoogleStatusResponse | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  async function loadStatus(showSpinner = false) {
    try {
      if (showSpinner) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const res = await fetch(`/api/admin/google/status?_=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
      });

      const data: GoogleStatusResponse = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load Google connection status.");
      }

      setStatus(data);
    } catch (error) {
      setStatus({
        ok: false,
        connected: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load Google connection status.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [notice]);

  async function confirmDisconnect() {
    try {
      setDisconnecting(true);
      setNotice(null);

      const res = await fetch("/api/admin/google/disconnect", {
        method: "POST",
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data?.error || "Failed to disconnect account.");
      }

      setConfirmDisconnectOpen(false);

      setStatus({
        ok: true,
        connected: false,
        googleEmail: null,
        expiresAt: null,
      });

      setNotice({
        type: "success",
        message: "Google account disconnected successfully.",
      });

      router.refresh();
      await loadStatus(true);
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to disconnect account.",
      });
    } finally {
      setDisconnecting(false);
    }
  }

  function handleDisconnect() {
    setNotice(null);
    setConfirmDisconnectOpen(true);
  }

  function handleConnect() {
    setNotice(null);
    window.location.href = "/api/admin/google/connect";
  }

  const isConnected = useMemo(() => !!status?.connected, [status]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_top,_#1f1147_0%,_#0d1631_34%,_#050b1a_68%,_#020617_100%)] text-white">
      <PageGlow />
      <DotGrid />
      <BottomDecoration />

      <DisconnectModal
        open={confirmDisconnectOpen}
        loading={disconnecting}
        onCancel={() => {
          if (!disconnecting) setConfirmDisconnectOpen(false);
        }}
        onConfirm={confirmDisconnect}
      />

      <div className="relative z-20 px-4 pt-4 md:px-6 lg:px-8">
        <NoticeBanner notice={notice} />
      </div>

      {loading ? (
        <LoadingScreen />
      ) : isConnected ? (
        <ConnectedHero
          email={status?.googleEmail}
          expiresAt={status?.expiresAt}
          refreshing={refreshing}
          disconnecting={disconnecting}
          onRefresh={() => loadStatus(true)}
          onDisconnect={handleDisconnect}
        />
      ) : (
        <LoginStateLayout
          status={status}
          refreshing={refreshing}
          onRefresh={() => loadStatus(true)}
          onConnect={handleConnect}
        />
      )}

      <FooterLine />
    </div>
  );
}