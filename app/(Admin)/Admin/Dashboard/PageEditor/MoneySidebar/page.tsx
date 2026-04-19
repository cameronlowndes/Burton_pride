import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Mail,
  ShieldAlert,
} from "lucide-react";

import EmailSidebarAdminClient from "./EmailSidebarAdminClient";
import { requireMainAdmin } from "@/lib/isMainAdmin";

export default async function EmailSidebarPage() {
  const { userId } = await auth();

  // ❌ Not signed in
  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-white">
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/10 p-8 backdrop-blur-xl">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/20 text-red-300">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <h1 className="text-3xl font-black">Please sign in</h1>

          <p className="mt-3 text-white/75">
            You must be logged in to access this admin page.
          </p>

          <Link
            href="/Admin/Login"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-black"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  // ❌ Block non-main-admin users
  try {
    await requireMainAdmin();
  } catch {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10 text-white">
        <div className="w-full max-w-2xl rounded-[36px] border border-white/10 bg-white/10 p-8 backdrop-blur-2xl">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-500/15 text-red-300">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <h1 className="text-3xl font-black">Main admin only</h1>

          <p className="mt-4 text-white/80">
            This page is restricted to the main admin account only.
            Your current account does not have permission to access the
            Email Sidebar Editor.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/Admin/Dashboard"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-black"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>

            <a
              href="mailto:info@burtonpride.co.uk"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 font-semibold text-white hover:bg-white/10"
            >
              <Mail className="h-4 w-4" />
              Contact Team
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Main admin only
  return <EmailSidebarAdminClient />;
}