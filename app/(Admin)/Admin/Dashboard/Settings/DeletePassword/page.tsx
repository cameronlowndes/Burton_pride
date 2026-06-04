import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Lock,
  Mail,
  ShieldAlert,
} from "lucide-react";

import {
  requireAdmin,
  requireMoneyPermission,
} from "@/lib/adminPermissions";
import DeletePasswordClient from "./DeletePasswordClient";

export const dynamic = "force-dynamic";

export default async function DeletePasswordPage() {
  try {
    await requireAdmin();
  } catch {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10 text-white">
        <div className="w-full max-w-xl rounded-[32px] border border-white/20 bg-white/10 p-8 text-center shadow-[0_25px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-10">
          <ShieldAlert className="mx-auto h-12 w-12 text-white" />

          <h1 className="mt-6 text-3xl font-bold">Please sign in</h1>

          <p className="mt-3 text-white/80">
            You need to be signed in with an authorised admin account to access
            this page.
          </p>

          <Link
            href="/Admin/Login"
            className="mt-8 inline-flex rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white hover:bg-white/15"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  try {
    /*
      New permission system:
      - Main admins automatically pass this check.
      - Other admins must have the money:delete_all permission enabled.
      - This protects the delete password because it controls high-risk delete actions.
    */
    await requireMoneyPermission("money:delete_all");
  } catch {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10 text-white">
        <div className="w-full max-w-2xl rounded-[36px] border border-white/20 bg-white/10 p-8 shadow-[0_30px_100px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-yellow-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-yellow-100">
            <AlertTriangle className="h-3.5 w-3.5" />
            Restricted access
          </div>

          <h1 className="mt-5 text-4xl font-bold">Permission required</h1>

          <p className="mt-4 text-sm leading-7 text-white/85">
            This page controls the main delete password used for high-risk money
            tracker actions, including deleting all transactions. You need the{" "}
            <span className="font-bold text-white">
              Delete all money transactions
            </span>{" "}
            permission to access it.
          </p>

          <div className="mt-6 rounded-3xl bg-black/10 p-5">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <Lock className="h-5 w-5 text-white/90" />
            </div>

            <h2 className="text-lg font-semibold">Why access is limited</h2>

            <p className="mt-2 text-sm leading-6 text-white/75">
              Changing this password could allow someone to delete major account
              records, so access is controlled through Admin Users & Permissions.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/Admin/Dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>

            <a
              href="mailto:cameronlowndes@burtonpride.co.uk?subject=Admin%20delete%20password%20permission%20request"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-yellow-400/15 px-5 py-3 text-sm font-semibold text-yellow-50 hover:bg-yellow-400/20"
            >
              <Mail className="h-4 w-4" />
              Contact Cameron
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <DeletePasswordClient />;
}