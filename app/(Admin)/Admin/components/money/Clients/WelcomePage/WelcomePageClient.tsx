import Link from "next/link";
import {
  Lock,
  Sparkles,
  User,
  WalletCards,
} from "lucide-react";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import MoneyManagementBugReporter from "./MoneyManagementBugReporter";
import MoneyManagementFeatureRequestReporter from "./MoneyManagementFeatureRequestReporter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MoneyManagementHomePage() {
  const admin = await getCurrentAdmin();

  const userName =
    admin?.email || "Money tracker user";

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_30%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#020617_100%)] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-6xl items-center justify-center">
        <div className="w-full rounded-3xl border border-white/10 bg-white/5 px-6 py-8 text-center shadow-2xl backdrop-blur-xl sm:px-8 sm:py-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-300/20">
            <WalletCards className="h-8 w-8" />
          </div>

          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">
            Burton Pride
          </p>

          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
            Welcome to Burton Pride Money Management App
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
            This money tracker checks who is logged in, so each admin can keep
            their own saved view, filters, and working setup separate.
          </p>

          {!admin && (
            <div className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-500/10 p-5">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-100 ring-1 ring-amber-300/20">
                <Lock className="h-6 w-6" />
              </div>

              <h2 className="text-xl font-black text-white">
                Please sign in first
              </h2>

              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-amber-100/75">
                You need to be signed in with your Supabase admin account before
                using the Money Management App.
              </p>

              <div className="mt-5">
                <Link
                  href="/Admin/Login"
                  className="inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-white/90"
                >
                  Sign in to Money Management
                </Link>
              </div>
            </div>
          )}

          {admin && (
            <div className="mt-8 rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                <div className="flex min-w-0 items-center gap-3 text-left">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-300/20">
                    <User className="h-6 w-6" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-black text-emerald-100">
                      Logged in as
                    </p>

                    <p className="break-words text-sm text-white/75">
                      {userName}
                    </p>
                  </div>
                </div>

                <Link
                  href="/Admin/Logout"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/20"
                >
                  Log out
                </Link>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Link
                  href="/Admin/MoneyManagement/TrackingMoney"
                  className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-black transition hover:bg-emerald-400"
                >
                  Open my money tracker
                </Link>

                <Link
                  href="/Admin/MoneyManagement/TrackingMoney?view=my-filters"
                  className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                >
                  Open my saved filters
                </Link>
              </div>

              <div className="mt-5 rounded-3xl border border-white/10 bg-black/15 p-4">
                <div className="flex items-center justify-center gap-2 text-sm font-black text-white/85">
                  <Sparkles className="h-4 w-4 text-purple-300" />
                  Help improve Money Management
                </div>

                <p className="mx-auto mt-2 max-w-2xl text-xs leading-5 text-white/45">
                  Found a problem or have an idea for a new feature? You can send
                  it directly from Money Management without going back to the main
                  Admin Portal.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MoneyManagementBugReporter
                    reporterName={admin.email || ""}
                    reporterEmail={admin.email || ""}
                  />

                  <MoneyManagementFeatureRequestReporter
                    reporterName={admin.email || ""}
                    reporterEmail={admin.email || ""}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/Admin/Dashboard"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Back to Admin Portal
            </Link>

            {admin && (
              <>
                <Link
                  href="/Admin/BugTracker"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  View Admin Bug Tracker
                </Link>

                <Link
                  href="/Admin/DevelopmentRequests"
                  className="rounded-2xl border border-purple-300/15 bg-purple-500/10 px-4 py-2 text-sm font-bold text-purple-100 transition hover:bg-purple-500/20"
                >
                  View Development Requests
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
