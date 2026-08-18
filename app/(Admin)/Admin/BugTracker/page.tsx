import { Bug, ShieldAlert } from "lucide-react";

import { requireAdmin } from "@/lib/adminPermissions";
import BugTrackerClient from "../components/BugTracker/BugTrackerClient";

export const dynamic = "force-dynamic";

export default async function BugTrackerPage() {
  const admin = await requireAdmin();

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden">
      <div className="w-full max-w-none px-3 py-5 sm:px-5 sm:py-6 lg:px-6 xl:px-8">
        <section className="mb-6 w-full overflow-hidden rounded-[1.65rem] border border-white/10 bg-[#11162a] shadow-xl shadow-black/20">
          <div className="px-6 py-7 sm:px-8 sm:py-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-3xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white/75">
                  <ShieldAlert
                    aria-hidden="true"
                    className="h-4 w-4"
                  />

                  Platform support
                </span>

                <div className="mt-5 flex items-start gap-4">
                  <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] sm:flex">
                    <Bug
                      aria-hidden="true"
                      className="h-7 w-7 text-purple-200"
                    />
                  </div>

                  <div>
                    <h1 className="text-3xl font-black leading-none tracking-tight text-white sm:text-5xl">
                      Admin Portal
                      <br />
                      Bug Tracker
                    </h1>

                    <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">
                      Report and manage bugs across the Admin Portal, Money
                      Management, Stock Control, Event Hub and public website.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:w-[430px]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/10">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-white/45">
                    Critical target
                  </p>

                  <p className="mt-2 text-lg font-black text-white">
                    1–2 days
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/10">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-white/45">
                    Notifications
                  </p>

                  <p className="mt-2 break-all text-sm font-bold text-white/85">
                    cameronlowndes@burtonpride.co.uk
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <BugTrackerClient
          currentAdmin={{
            id: admin.id,
            name: admin.email || "",
            email: admin.email || "",
          }}
        />
      </div>
    </main>
  );
}