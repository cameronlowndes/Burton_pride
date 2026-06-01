import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Mail,
  ShieldAlert,
} from "lucide-react";

import EmailSidebarAdminClient from "./EmailSidebarAdminClient";
import { requireAdminPermission } from "@/lib/adminPermissions";

export const dynamic = "force-dynamic";

export default async function EmailSidebarPage() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-white">
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/10 p-8 backdrop-blur-xl">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/20 text-red-300">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <h1 className="text-3xl font-black">Please sign in</h1>

          <p className="mt-3 text-white/75">
            You must be logged in with an authorised admin account to access
            this admin page.
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

  try {
    /*
      New permissions system:
      - Main admins automatically pass this check.
      - Other admins must have site_pages:manage enabled in Admin Users.
      - This replaces the old hardcoded main-admin-only check.
    */
    await requireAdminPermission("site_pages:manage");
  } catch {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10 text-white">
        <div className="w-full max-w-2xl rounded-[36px] border border-white/10 bg-white/10 p-8 backdrop-blur-2xl">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-500/15 text-red-300">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <h1 className="text-3xl font-black">Permission required</h1>

          <p className="mt-4 text-white/80">
            This page controls the admin email sidebar links. You need the{" "}
            <span className="font-bold text-white">Manage Site Pages</span>{" "}
            permission to access the Email Sidebar Editor.
          </p>

          <div className="mt-5 rounded-3xl border border-white/10 bg-black/10 p-5">
            <h2 className="text-lg font-bold text-white">
              Why access is limited
            </h2>

            <p className="mt-2 text-sm leading-6 text-white/75">
              Email sidebar changes affect the admin portal navigation. Access
              is now controlled through Admin Users & Permissions instead of a
              hardcoded main-admin-only rule.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/Admin/Dashboard"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-black"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>

            <a
              href="mailto:cameronlowndes@burtonpride.co.uk?subject=Email%20sidebar%20permission%20request"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 font-semibold text-white hover:bg-white/10"
            >
              <Mail className="h-4 w-4" />
              Contact Cameron
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <EmailSidebarAdminClient />;
}
