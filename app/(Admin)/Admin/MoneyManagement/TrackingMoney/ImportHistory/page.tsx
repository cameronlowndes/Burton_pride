import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  FileSpreadsheet,
  ShieldAlert,
} from "lucide-react";

import ImportHistoryClient from "./ImportHistoryClient";
import { requireMainAdmin } from "@/lib/isMainAdmin";

export default async function MoneyImportHistoryPage() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <main className="min-h-screen w-full max-w-none bg-[#070716] px-1 py-5 text-white sm:px-2 lg:px-3">
        <div className="mx-auto w-full max-w-2xl rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/20 text-red-300">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <h1 className="text-3xl font-black">Please sign in</h1>

          <p className="mt-3 text-white/75">
            You must be signed in before viewing the money import history.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#070716]"
          >
            Go back home
          </Link>
        </div>
      </main>
    );
  }

  try {
    await requireMainAdmin();
  } catch {
    return (
      <main className="min-h-screen w-full max-w-none bg-[#070716] px-1 py-5 text-white sm:px-2 lg:px-3">
        <div className="mx-auto w-full max-w-2xl rounded-3xl border border-red-300/20 bg-red-500/10 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/20 text-red-200">
            <AlertTriangle className="h-7 w-7" />
          </div>

          <h1 className="text-3xl font-black">Main admin only</h1>

          <p className="mt-3 text-white/75">
            Import history contains financial audit information, so only the
            main admin can view it.
          </p>

          <Link
            href="/Admin/MoneyManagement/TrackingMoney"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tracking Money
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full max-w-none overflow-x-auto bg-[#070716] px-1 py-5 text-white sm:px-2 lg:px-3">
      <div className="w-full max-w-none min-w-0 space-y-6">
        <section className="w-full max-w-none overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl backdrop-blur-xl">
          <div className="relative p-5 sm:p-7 lg:p-8">
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 via-fuchsia-500/10 to-emerald-500/10" />

            <div className="relative flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <Link
                  href="/Admin/MoneyManagement/TrackingMoney/CsvImport"
                  className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
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
                      Money admin audit
                    </p>
                    <h1 className="mt-1 break-words text-3xl font-black tracking-tight sm:text-5xl">
                      Import History
                    </h1>
                  </div>
                </div>

                <p className="mt-4 max-w-5xl text-sm leading-7 text-white/75 sm:text-base">
                  Track every CSV upload as a batch, including who imported it,
                  when it happened, how many rows were imported, total money in,
                  total money out, and failed rows.
                </p>
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
