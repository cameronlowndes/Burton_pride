import type { Metadata } from "next";

import { Bug, ShieldAlert } from "lucide-react";

import { requireAdmin } from "@/lib/adminPermissions";
import BugTrackerClient from "../components/BugTracker/BugTrackerClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bug Tracker | Burton Pride Admin Portal",
  description:
    "Report, investigate and manage bugs across the Burton Pride platform.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  referrer: "no-referrer",
};

export default async function BugTrackerPage() {
  const admin = await requireAdmin();

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <div className="relative w-full max-w-none px-3 py-5 sm:px-5 sm:py-6 lg:px-6 xl:px-8">
        <section className="mb-6 w-full overflow-hidden rounded-[1.65rem] border border-white/20 bg-gradient-to-r from-fuchsia-600/55 via-purple-600/55 to-indigo-600/55 shadow-2xl shadow-purple-950/15 backdrop-blur-2xl">
          <div className="relative px-6 py-7 sm:px-8 sm:py-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_35%)]"
            />

            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-3xl">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] ring-1 ring-white/15">
                  <ShieldAlert
                    aria-hidden="true"
                    className="h-4 w-4"
                  />

                  Platform support
                </span>

                <div className="mt-5 flex items-start gap-4">
                  <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 sm:flex">
                    <Bug
                      aria-hidden="true"
                      className="h-7 w-7"
                    />
                  </div>

                  <div>
                    <h1 className="text-3xl font-black leading-none tracking-tight sm:text-5xl">
                      Admin Portal
                      <br />
                      Bug Tracker
                    </h1>

                    <p className="mt-4 max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
                      Report and manage bugs across the Admin Portal, Money
                      Management, Stock Control, Event Hub and public website.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:w-[430px]">
                <div className="rounded-2xl border border-white/20 bg-white/15 p-4 shadow-lg shadow-purple-950/10 backdrop-blur-xl">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-white/65">
                    Critical target
                  </p>

                  <p className="mt-2 text-lg font-black">
                    1–2 days
                  </p>
                </div>

                <div className="rounded-2xl border border-white/20 bg-white/15 p-4 shadow-lg shadow-purple-950/10 backdrop-blur-xl">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-white/65">
                    Notifications
                  </p>

                  <p className="mt-2 break-all text-sm font-bold">
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