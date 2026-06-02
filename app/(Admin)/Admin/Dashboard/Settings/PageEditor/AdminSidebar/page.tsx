import Link from "next/link";
import { AlertTriangle, ArrowLeft, Mail, ShieldAlert } from "lucide-react";

import { requireAdminPermission } from "@/lib/adminPermissions";
import SidebarManagerClient from "./SidebarManager";

export const dynamic = "force-dynamic";

export default async function SidebarManagerPage() {
  try {
    await requireAdminPermission("site_pages:manage");
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
              Permission required
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
              You need to be signed in with a Supabase admin account that has{" "}
              <span className="font-bold text-white">Manage Site Pages</span>{" "}
              permission to access the sidebar manager.
            </p>
          </div>

          <div className="grid gap-4 px-8 py-8 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/15 bg-black/10 p-5">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                <ShieldAlert className="h-5 w-5 text-white/90" />
              </div>

              <h2 className="text-lg font-semibold">Why access is limited</h2>

              <p className="mt-2 text-sm leading-6 text-white/75">
                Sidebar manager access is controlled through Supabase Admin
                Users & Permissions because changes here affect what admin pages
                the team can see and use.
              </p>
            </div>

            <div className="rounded-3xl border border-white/15 bg-black/10 p-5">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                <Mail className="h-5 w-5 text-white/90" />
              </div>

              <h2 className="text-lg font-semibold">Need access?</h2>

              <p className="mt-2 text-sm leading-6 text-white/75">
                Ask a main admin to open Admin Users & Permissions and tick
                Manage Site Pages for your account.
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

              <Link
                href="/Admin/Login"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                <ShieldAlert className="h-4 w-4" />
                Admin login
              </Link>

              <a
                href="mailto:cameronlowndes@burtonpride.co.uk?subject=Admin%20sidebar%20permission%20request"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-3 text-sm font-semibold text-yellow-50 transition hover:bg-yellow-400/20"
              >
                <Mail className="h-4 w-4" />
                Contact Cameron
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <SidebarManagerClient />;
}