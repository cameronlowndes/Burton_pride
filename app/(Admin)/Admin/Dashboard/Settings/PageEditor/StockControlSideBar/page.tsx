import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  LayoutDashboard,
  Mail,
  ShieldAlert,
} from "lucide-react";

import StockControlSidebarAdminClient from "./StockControlSidebarAdminClient";
import { requireAdminPermission } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

export default async function StockControlSidebarPage() {
  try {
    /*
      Supabase authentication system:

      - Clerk authentication is not used on this page.
      - Access is checked by requireAdminPermission().
      - This page controls the Stock Control sidebar links.
      - The sidebar items are managed through the Stock Control sidebar API.
    */
    await requireAdminPermission("site_pages:manage");
  } catch (error) {
    const message = getErrorMessage(error);
    const normalisedMessage = message.toLowerCase();

    const isNotSignedIn =
      normalisedMessage.includes("unauthorized") ||
      normalisedMessage.includes("unauthorised") ||
      normalisedMessage.includes("not signed") ||
      normalisedMessage.includes("sign in") ||
      normalisedMessage.includes("no user") ||
      normalisedMessage.includes("session");

    if (isNotSignedIn) {
      return (
        <div className="flex min-h-screen items-center justify-center px-4 py-10 text-white">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/20 text-red-300">
              <ShieldAlert className="h-7 w-7" />
            </div>

            <h1 className="text-3xl font-black">Please sign in</h1>

            <p className="mt-3 leading-7 text-white/75">
              You must be logged in with an authorised admin account to access
              the Stock Control sidebar editor.
            </p>

            <Link
              href="/Admin/Login"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:opacity-90"
            >
              Go to login
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10 text-white">
        <div className="w-full max-w-2xl rounded-[36px] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-500/15 text-red-300">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <h1 className="text-3xl font-black">Permission required</h1>

          <p className="mt-4 leading-7 text-white/80">
            This page controls the{" "}
            <span className="font-bold text-white">
              Stock Control sidebar links
            </span>
            . You need the{" "}
            <span className="font-bold text-white">Manage Site Pages</span>{" "}
            permission to access this editor.
          </p>

          <details className="mt-5 rounded-3xl border border-white/10 bg-black/10 p-5">
            <summary className="cursor-pointer text-sm font-bold text-white">
              Show error details
            </summary>

            <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-white/70">
              {message}
            </pre>
          </details>

          <div className="mt-5 rounded-3xl border border-white/10 bg-black/10 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
                <Boxes className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-bold text-white">
                  Why access is limited
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/75">
                  Stock Control sidebar changes affect inventory navigation,
                  stock levels, purchase orders, suppliers, stock movements and
                  reports. Access is controlled through Supabase Admin Users
                  and Permissions.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/Admin/StockControl"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:opacity-90"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Stock Control
            </Link>

            <Link
              href="/Admin/Dashboard"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              <LayoutDashboard className="h-4 w-4" />
              Back to Admin Portal
            </Link>

            <a
              href="mailto:cameronlowndes@burtonpride.co.uk?subject=Stock%20Control%20sidebar%20permission%20request"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              <Mail className="h-4 w-4" />
              Contact Cameron
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <StockControlSidebarAdminClient />;
}