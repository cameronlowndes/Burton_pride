import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Mail, ShieldAlert } from "lucide-react";
import NavbarManagerClient from "./NavbarManagerClient"; // ✅ FIXED
import { requireMainAdmin } from "@/lib/isMainAdmin";

export default async function NavbarManagerPage() {
  const { userId } = await auth();

  // ❌ Not logged in
  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10 text-white">
        <div className="w-full max-w-xl rounded-[32px] border border-white/20 bg-white/10 p-8 text-center shadow-[0_25px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
            <ShieldAlert className="h-8 w-8 text-white" />
          </div>

          <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
            Please sign in
          </h1>

          <p className="mt-3 text-sm leading-7 text-white/85 sm:text-base">
            You need to be signed in with the correct admin account to access the
            navbar manager.
          </p>

          <div className="mt-8">
            <Link
              href="/Admin/Dashboard"
              className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Check main admin
  try {
    await requireMainAdmin();
  } catch {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10 text-white">
        <div className="w-full max-w-2xl rounded-[36px] border border-white/20 bg-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
          <div className="border-b border-white/10 px-8 py-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-yellow-300/30 bg-yellow-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-yellow-100">
              <AlertTriangle className="h-3.5 w-3.5" />
              Restricted access
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-5xl">
              Main admin only
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
              This section is restricted to the main admin of the website.
              Changes made here directly affect the website navigation (navbar).
              If you need a link added, removed, or updated, please contact
              Cameron with the details and reason.
            </p>
          </div>

          <div className="grid gap-4 px-8 py-8 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/15 bg-black/10 p-5">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                <ShieldAlert className="h-5 w-5 text-white/90" />
              </div>
              <h2 className="text-lg font-semibold">Why access is limited</h2>
              <p className="mt-2 text-sm leading-6 text-white/75">
                This page is restricted to prevent accidental or unauthorised
                changes to the navbar. If everyone had access, navigation links
                could be changed or removed without proper reason, causing issues
                for users and the team.
              </p>
            </div>

            <div className="rounded-3xl border border-white/15 bg-black/10 p-5">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                <Mail className="h-5 w-5 text-white/90" />
              </div>
              <h2 className="text-lg font-semibold">Need a change made?</h2>
              <p className="mt-2 text-sm leading-6 text-white/75">
                Please contact Cameron with full details of the navbar change,
                including what links need to be added, removed, or updated, and
                the reason behind it.
              </p>
            </div>
          </div>

          <div className="border-t border-white/10 px-8 py-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/Admin/Dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to dashboard
              </Link>

              <a
                href="mailto:info@burtonpride.co.uk"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-3 text-sm font-semibold text-yellow-50 transition hover:bg-yellow-400/20"
              >
                <Mail className="h-4 w-4" />
                Contact team
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Allowed
  return <NavbarManagerClient />;
}