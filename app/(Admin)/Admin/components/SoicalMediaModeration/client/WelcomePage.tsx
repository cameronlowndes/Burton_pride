import Link from "next/link";
import {
  Bug,
  Lightbulb,
  Lock,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

import { getCurrentAdmin } from "@/lib/adminPermissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SocialMediaModerationHomePage() {
  const admin = await getCurrentAdmin();

  const userName = admin?.email || "Social media moderator";

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.14),_transparent_30%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#020617_100%)] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-6xl items-center justify-center">
        <div className="w-full rounded-3xl border border-white/10 bg-white/5 px-6 py-8 text-center shadow-2xl backdrop-blur-xl sm:px-8 sm:py-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-purple-500/15 text-purple-200 ring-1 ring-purple-300/20">
            <ShieldCheck className="h-8 w-8" aria-hidden="true" />
          </div>

          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-purple-300">
            Burton Pride
          </p>

          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
            Welcome to Burton Pride Social Media Moderation
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
            Help keep Burton Pride’s social media welcoming and safe.
            Use the moderation tools to review comments and manage
            content across Facebook and Instagram.
          </p>

          {!admin && (
            <div className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-500/10 p-5">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-100 ring-1 ring-amber-300/20">
                <Lock className="h-6 w-6" aria-hidden="true" />
              </div>

              <h2 className="text-xl font-black text-white">
                Please sign in first
              </h2>

              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-amber-100/75">
                Sign in with your Burton Pride admin account to access
                Social Media Moderation. Access to individual tools
                depends on your account permissions.
              </p>

              <div className="mt-5">
                <Link
                  href="/Admin/Login"
                  className="inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Sign in to Social Media Moderation
                </Link>
              </div>
            </div>
          )}

          {admin && (
            <div className="mt-8 rounded-3xl border border-purple-300/20 bg-purple-500/10 p-5">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                <div className="flex min-w-0 items-center gap-3 text-left">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-100 ring-1 ring-purple-300/20">
                    <User className="h-6 w-6" aria-hidden="true" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-black text-purple-100">
                      Logged in as
                    </p>

                    <p className="break-words text-sm text-white/75">
                      {userName}
                    </p>
                  </div>
                </div>

                <Link
                  href="/Admin/Logout"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                >
                  Log out
                </Link>
              </div>

              <div className="mt-5 rounded-3xl border border-white/10 bg-black/15 p-5">
                <div className="flex items-center justify-center gap-2 text-sm font-black text-purple-100">
                  <MessageSquare
                    className="h-5 w-5 shrink-0 text-purple-300"
                    aria-hidden="true"
                  />
                  Start moderating
                </div>

                <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-white/60">
                  Choose a tool from the Social Media Moderation sidebar
                  to get started. Review comments in context and follow
                  Burton Pride’s social media policy when taking action.
                </p>
              </div>

              <div className="mt-5 rounded-3xl border border-white/10 bg-black/15 p-4">
                <div className="flex items-center justify-center gap-2 text-sm font-black text-white/85">
                  <Sparkles
                    className="h-4 w-4 text-purple-300"
                    aria-hidden="true"
                  />
                  Help improve Social Media Moderation
                </div>

                <p className="mx-auto mt-2 max-w-2xl text-xs leading-5 text-white/60">
                  Found a problem or have an idea for a new feature?
                  Use the bug tracker or development requests page
                  to share it with the team.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/Admin/BugTracker"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                  >
                    <Bug className="h-4 w-4" aria-hidden="true" />
                    Open bug tracker
                  </Link>

                  <Link
                    href="/Admin/DevelopmentRequests"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-purple-300/20 bg-purple-500/15 px-5 py-3 text-sm font-black text-purple-100 transition hover:bg-purple-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                  >
                    <Lightbulb className="h-4 w-4" aria-hidden="true" />
                    Open development requests
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/Admin/Dashboard"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
            >
              Back to Admin Portal
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}