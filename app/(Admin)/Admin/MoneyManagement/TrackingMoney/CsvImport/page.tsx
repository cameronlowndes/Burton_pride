import Link from "next/link";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import MoneyCsvImport from "../../../components/money/MoneyCsvImport";

export const dynamic = "force-dynamic";

export default function MoneyCsvImportPage() {
  return (
    <main className="min-h-screen w-full overflow-x-auto bg-[#070716] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1700px] min-w-0 space-y-6">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur">
          <div className="relative p-6">
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" />

            <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-100 ring-1 ring-emerald-300/20">
                  <FileSpreadsheet className="h-4 w-4" />
                  Money Tracker CSV Import
                </div>

                <h1 className="break-words text-3xl font-black tracking-tight sm:text-4xl">
                  Import Bank Statement CSV
                </h1>

                <p className="mt-2 max-w-4xl text-sm leading-6 text-white/60">
                  Upload a bank statement CSV, review each row manually, choose
                  which rows to import, then create money tracker transactions
                  from the selected rows.
                </p>
              </div>

              <Link
                href="/Admin/MoneyManagement/TrackingMoney"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Money Tracker
              </Link>
            </div>
          </div>
        </section>

        <MoneyCsvImport />
      </div>
    </main>
  );
}