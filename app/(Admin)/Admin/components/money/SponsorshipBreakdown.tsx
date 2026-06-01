"use client";

import type { Dispatch, SetStateAction } from "react";
import { Pencil, Trash2 } from "lucide-react";

import type { SponsorBreakdown } from "@/lib/money/types";
import { money } from "@/lib/money/utils";

type SponsorshipBreakdownProps = {
  selectedYear: string;
  yearlySponsorBreakdown: SponsorBreakdown[];

  openNewSponsorForm: () => void;
  startEditSponsor: (sponsorId: string) => void;
  setDeleteSponsorId: Dispatch<SetStateAction<string | null>>;
};

export default function SponsorshipBreakdown({
  selectedYear,
  yearlySponsorBreakdown,
  openNewSponsorForm,
  startEditSponsor,
  setDeleteSponsorId,
}: SponsorshipBreakdownProps) {
  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-amber-300/20 bg-amber-500/10 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-amber-100">
            Sponsors & Grants Breakdown
          </h2>

          <p className="text-sm text-amber-100/70">
            Jan to Dec {selectedYear}: track sponsors, grants, restricted
            funding, what came in, what has been spent, and what is left.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewSponsorForm}
          className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400"
        >
          Add Sponsor / Grant
        </button>
      </div>

      {yearlySponsorBreakdown.length === 0 ? (
        <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">
          No sponsors or grants added for {selectedYear} yet.
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {yearlySponsorBreakdown.map((sponsor) => (
            <div
              key={sponsor.sponsor_id}
              className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-bold text-white">
                    {sponsor.sponsor_name}
                  </h3>

                  <span className="mt-2 inline-flex rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-100 ring-1 ring-amber-300/20">
                    Sponsor / Grant Funding
                  </span>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => startEditSponsor(sponsor.sponsor_id)}
                    className="rounded-xl bg-amber-500/15 p-2 text-amber-100 ring-1 ring-amber-300/20 hover:bg-amber-500/25"
                    title="Edit sponsor or grant"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteSponsorId(sponsor.sponsor_id)}
                    className="rounded-xl bg-red-500/15 p-2 text-red-200 ring-1 ring-red-300/20 hover:bg-red-500/25"
                    title="Delete sponsor or grant"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {sponsor.contact_name && (
                <p className="mt-3 break-words text-sm text-white/50">
                  Contact: {sponsor.contact_name}
                </p>
              )}

              {sponsor.email && (
                <p className="break-words text-sm text-white/50">
                  {sponsor.email}
                </p>
              )}

              {sponsor.phone && (
                <p className="break-words text-sm text-white/50">
                  {sponsor.phone}
                </p>
              )}

              {sponsor.notes && (
                <div className="mt-3 rounded-xl bg-white/5 p-3 text-xs text-white/60">
                  <p className="mb-1 font-bold text-white/80">
                    Funding notes
                  </p>

                  <p className="whitespace-pre-wrap break-words">
                    {sponsor.notes}
                  </p>
                </div>
              )}

              {(sponsor.carried_forward_pence || 0) > 0 && (
                <div className="mt-3 rounded-xl bg-purple-500/10 p-3 text-xs text-purple-100 ring-1 ring-purple-300/20">
                  Carried forward into {selectedYear}:{" "}
                  <strong>
                    {money(sponsor.carried_forward_pence || 0)}
                  </strong>
                </div>
              )}

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-white/60">Agreed / Awarded</span>
                  <span className="font-bold text-white">
                    {money(sponsor.agreed_amount_pence)}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-white/60">Received</span>
                  <span className="font-bold text-emerald-300">
                    {money(sponsor.received_pence)}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-white/60">Spent</span>
                  <span className="font-bold text-red-300">
                    {money(sponsor.spent_pence)}
                  </span>
                </div>

                <div className="flex justify-between gap-3 rounded-xl bg-amber-500/10 px-3 py-2">
                  <span className="text-amber-100">Remaining</span>
                  <span className="font-bold text-amber-100">
                    {money(sponsor.remaining_pence)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}