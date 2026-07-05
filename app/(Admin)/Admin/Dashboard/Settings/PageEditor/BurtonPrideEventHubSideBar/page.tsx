import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  LayoutDashboard,
  Mail,
  ShieldAlert,
} from "lucide-react";

import BurtonPrideEventHubSidebarAdminClient from "./BurtonPrideEventHubSidebarAdminClient";
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

export default async function BurtonPrideEventHubSidebarPage() {
  try {
    /*
      Supabase auth system:
      - No Clerk auth() is used here.
      - Access is checked by requireAdminPermission().
      - This page controls Burton Pride Event Hub sidebar links.
    */
    await requireAdminPermission("site_pages:manage");
  } catch (error) {
    const message = getErrorMessage(error);

    const isNotSignedIn =
      message.toLowerCase().includes("unauthorized") ||
      message.toLowerCase().includes("not signed") ||
      message.toLowerCase().includes("no user") ||
      message.toLowerCase().includes("session");

    if (isNotSignedIn) {
      return (
        <div className="flex min-h-screen items-center justify-center px-4 text-white">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/10 p-8 backdrop-blur-xl">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/20 text-red-300">
              <ShieldAlert className="h-7 w-7" />
            </div>

            <h1 className="text-3xl font-black">Please sign in</h1>

            <p className="mt-3 text-white/75">
              You must be logged in with an authorised admin account to access
              the Burton Pride Event Hub sidebar editor.
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

    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10 text-white">
        <div className="w-full max-w-2xl rounded-[36px] border border-white/10 bg-white/10 p-8 backdrop-blur-2xl">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-500/15 text-red-300">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <h1 className="text-3xl font-black">Permission required</h1>

          <p className="mt-4 text-white/80">
            This page controls the{" "}
            <span className="font-bold text-white">
              Burton Pride Event Hub sidebar links
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
            <h2 className="text-lg font-bold text-white">
              Why access is limited
            </h2>

            <p className="mt-2 text-sm leading-6 text-white/75">
              Burton Pride Event Hub sidebar changes affect event planning,
              money tracking, volunteers and admin navigation. Access is
              controlled through Supabase Admin Users & Permissions.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/Admin/BurtonPrideEventHub"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-black"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Event Hub
            </Link>

            <Link
              href="/Admin/Dashboard"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 font-semibold text-white hover:bg-white/10"
            >
              <LayoutDashboard className="h-4 w-4" />
              Back to Admin Portal
            </Link>

            <a
              href="mailto:cameronlowndes@burtonpride.co.uk?subject=Burton%20Pride%20Event%20Hub%20sidebar%20permission%20request"
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

  return <BurtonPrideEventHubSidebarAdminClient />;
}