import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldAlert,
  Trash2,
} from "lucide-react";

import DeletedMoneyItemsClient from "../../../../components/money/BudgetTrackerDelete";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DeletedMoneyItemsPage() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <main className="min-h-screen bg-[#070716] px-4 py-8 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-300/20 bg-red-500/10 p-6">
          <ShieldAlert className="mb-4 h-8 w-8 text-red-200" />
          <h1 className="text-2xl font-black">Please sign in</h1>
          <p className="mt-2 text-white/70">
            You must be signed in to view deleted money records.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070716] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href="/Admin/MoneyManagement/TrackingMoney/BudgetPlanning"
              className="mb-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Budget Tracker
            </Link>

            <div className="inline-flex items-center gap-2 rounded-full border border-red-300/20 bg-red-500/10 px-4 py-2 text-sm font-black text-red-100">
              <Trash2 className="h-4 w-4" />
              Deleted area
            </div>

            <h1 className="mt-4 text-3xl font-black text-white">
              Deleted saving targets and budget tracker items
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
              Soft-deleted records are hidden from the main page, but kept in
              Supabase. Restore them here if they were deleted by mistake.
            </p>
          </div>
        </div>

        <DeletedMoneyItemsClient />
      </div>
    </main>
  );
}
