"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

export default function AdminUpdatePage() {
  const lastUpdated = useMemo(() => {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br p-4 sm:p-8">
      <div className="mx-auto w-full max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-3xl bg-white/95 shadow-xl backdrop-blur"
        >
          <div className="border-b px-6 py-5 sm:px-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold text-slate-900">
                  Admin Portal Update
                </h1>
                <p className="text-sm text-slate-600">
                  Status update for the committee team
                </p>
              </div>
              <div className="text-xs text-slate-500">
                Last updated: {lastUpdated}
              </div>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8">
            <div className="rounded-2xl border bg-slate-50 p-5">
              <p className="text-sm leading-relaxed text-slate-800">
                Dear Committee Team,
                <br />
                <br />
                Cameron is currently working around the clock to ensure all pages
                within the Admin Portal are fully built and functioning correctly.
                <br />
                <br />
                Please understand that new features take time to develop properly.
                Each section must be carefully built, tested, and reviewed before
                going live. This includes multiple rounds of functionality testing
                as well as security testing to ensure the system is safe, reliable,
                and ready for use.
                <br />
                <br />
                Thank you for your patience and continued support while development
                is ongoing.
              </p>

              <div className="mt-4 text-sm text-slate-700">
                Kind regards,
                <br />
                <span className="font-semibold text-slate-900">
                  Cameron Lowndes
                </span>
                <br />
                Web Developer, Burton Pride C.I.C
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mx-auto mt-4 max-w-3xl text-center text-xs text-white/80">
          Burton Pride C.I.C — Admin Portal
        </div>
      </div>
    </div>
  );
}