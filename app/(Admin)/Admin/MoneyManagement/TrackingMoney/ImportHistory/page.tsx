import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  FileSpreadsheet,
  ShieldAlert,
} from "lucide-react";

import ImportHistoryClient from "../../../components/money/Clients/ImportHistory/ImportHistoryClient";
import { requireAdmin } from "@/lib/adminPermissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "CSV Import History | Burton Pride Admin",
  description:
    "View CSV import history for the Burton Pride Money Management App.",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

function hasPermission(admin: any, permissionKey: string) {
  if (!admin) return false;

  if (admin.role === "main_admin") {
    return true;
  }

  if (Array.isArray(admin.permissionKeys)) {
    return admin.permissionKeys.includes(permissionKey);
  }

  if (
    admin.permissions &&
    typeof admin.permissions === "object"
  ) {
    return admin.permissions[permissionKey] === true;
  }

  return false;
}

function AccessDeniedCard({
  title,
  message,
  backHref,
  backLabel,
  variant = "red",
}: {
  title: string;
  message: string;
  backHref: string;
  backLabel: string;
  variant?: "red" | "amber";
}) {
  const isAmber = variant === "amber";

  return (
    <main className="min-h-screen w-full max-w-none bg-[#070716] px-1 py-5 text-white sm:px-2 lg:px-3">
      <div
        className={[
          "mx-auto w-full max-w-2xl rounded-3xl border p-8 shadow-2xl backdrop-blur-xl",
          isAmber
            ? "border-amber-300/20 bg-amber-500/10"
            : "border-red-300/20 bg-red-500/10",
        ].join(" ")}
      >
        <div
          className={[
            "mb-5 flex h-14 w-14 items-center justify-center rounded-2xl",
            isAmber
              ? "bg-amber-500/20 text-amber-200"
              : "bg-red-500/20 text-red-200",
          ].join(" ")}
        >
          {isAmber ? (
            <AlertTriangle className="h-7 w-7" />
          ) : (
            <ShieldAlert className="h-7 w-7" />
          )}
        </div>

        <h1 className="text-3xl font-black">
          {title}
        </h1>

        <p className="mt-3 whitespace-pre-line text-white/75">
          {message}
        </p>

        <Link
          href={backHref}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      </div>
    </main>
  );
}

export default async function CsvImportHistoryPage() {
  let admin: any = null;

  try {
    admin = await requireAdmin();
  } catch (error) {
    return (
      <AccessDeniedCard
        title="Please sign in"
        message={
          "You must be signed in before viewing CSV Import History.\n\nIf you are already signed in, log out and sign back in so your admin session and permissions refresh."
        }
        backHref="/"
        backLabel="Go back home"
      />
    );
  }

  const canViewImportHistory =
    admin?.role === "main_admin" ||
    hasPermission(admin, "money:export_reports") ||
    hasPermission(admin, "audit_logs:view") ||
    hasPermission(admin, "money:import");

  if (!canViewImportHistory) {
    return (
      <AccessDeniedCard
        title="Access needed"
        message={
          "CSV Import History contains financial audit information.\n\nYou need main admin access, Money Import permission, Money Export Reports permission, or Audit Logs permission to view this page."
        }
        backHref="/Admin/MoneyManagement/TrackingMoney/CsvImport"
        backLabel="Back to CSV Import"
        variant="amber"
      />
    );
  }

  return (
    <main className="min-h-screen w-full max-w-none overflow-x-hidden bg-[#070716] px-1 py-5 text-white sm:px-2 lg:px-3">
      <div className="w-full max-w-none min-w-0 space-y-6">
        <section className="w-full max-w-none overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl backdrop-blur-xl">
          <div className="relative p-5 sm:p-7 lg:p-8">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/20 via-fuchsia-500/10 to-emerald-500/10" />

            <div className="relative flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <Link
                  href="/Admin/MoneyManagement/TrackingMoney/CsvImport"
                  className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-bold text-white/80 transition hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to CSV Import
                </Link>

                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-sky-200">
                    <FileSpreadsheet className="h-7 w-7" />
                  </div>

                  <div className="min-w-0">
                    <p className="break-words text-sm font-black uppercase tracking-[0.25em] text-sky-100/80">
                      CSV Import Audit
                    </p>

                    <h1 className="mt-1 break-words text-3xl font-black tracking-tight sm:text-5xl">
                      Import History
                    </h1>
                  </div>
                </div>

                <p className="mt-4 max-w-5xl text-sm leading-7 text-white/75 sm:text-base">
                  View every CSV import batch, including who
                  completed the import, when it happened, how
                  many rows were processed, total money in,
                  total money out and any failed rows.
                </p>

                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-white/55">
                  Signed in as{" "}
                  <span className="font-black text-white">
                    {admin.email ||
                      admin.full_name ||
                      "admin"}
                  </span>{" "}
                  with role{" "}
                  <span className="font-black text-sky-100">
                    {String(admin.role || "unknown").replace(
                      "_",
                      " ",
                    )}
                  </span>
                  .
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full max-w-none min-w-0">
          <ImportHistoryClient />
        </section>
      </div>
    </main>
  );
}