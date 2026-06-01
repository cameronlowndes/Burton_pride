"use client";

import { Banknote, CircleDollarSign, Pencil, Plus, Trash2 } from "lucide-react";

import type { Dispatch, SetStateAction } from "react";
import type { FundingType, SponsorBreakdown } from "@/lib/money/types";
import { money } from "@/lib/money/helpers";

type LoanSponsorBreakdown = SponsorBreakdown & {
  loan_interest_pence?: number | null;
  loan_repaid_pence?: number | null;
  loan_remaining_pence?: number | null;
  loan_total_owed_pence?: number | null;
  loan_due_date?: string | null;
  loan_repayment_terms?: string | null;
  is_loan_paid_off?: boolean | null;
  loan_paid_off_at?: string | null;
};

type SponsorshipBreakdownProps = {
  selectedYear: string;
  yearlySponsorBreakdown: SponsorBreakdown[];
  openNewSponsorForm: () => void;
  startEditSponsor: (sponsorId: string) => void;
  setDeleteSponsorId: Dispatch<SetStateAction<string | null>>;
  openLoanRepaymentModal?: (sponsor: SponsorBreakdown) => void;
  openLoanInterestModal?: (sponsor: SponsorBreakdown) => void;
};

function fundingTypeLabel(type?: FundingType | string | null) {
  if (type === "grant") return "Grant Money";
  if (type === "loan") return "Loan";
  if (type === "other") return "Other Funding";
  return "Sponsor";
}

function fundingTypeBadgeClass(type?: FundingType | string | null) {
  if (type === "grant") {
    return "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";
  }

  if (type === "loan") {
    return "bg-blue-500/15 text-blue-100 ring-blue-300/20";
  }

  if (type === "other") {
    return "bg-purple-500/15 text-purple-100 ring-purple-300/20";
  }

  return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
}

function safeNumber(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value || 0) : 0;
}

function formatDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function SponsorshipBreakdown({
  selectedYear,
  yearlySponsorBreakdown,
  openNewSponsorForm,
  startEditSponsor,
  setDeleteSponsorId,
  openLoanRepaymentModal,
  openLoanInterestModal,
}: SponsorshipBreakdownProps) {
  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-amber-300/20 bg-amber-500/10 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-amber-100">
            Sponsors, Grants, Loans & Other Funding
          </h2>

          <p className="text-sm text-amber-100/70">
            Jan to Dec {selectedYear}: track sponsors, grant money, loans and
            other restricted funding, including what came in, what has been
            spent, what has been paid back, and what is left.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewSponsorForm}
          className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400"
        >
          Add Funding
        </button>
      </div>

      {yearlySponsorBreakdown.length === 0 ? (
        <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">
          No sponsors, grants, loans or other funding added for {selectedYear}{" "}
          yet.
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {yearlySponsorBreakdown.map((fundingItem) => {
            const sponsor = fundingItem as LoanSponsorBreakdown;
            const fundingType = sponsor.funding_type || "sponsor";
            const isLoan = fundingType === "loan";

            const loanReceivedPence = safeNumber(sponsor.received_pence);
            const loanInterestPence = safeNumber(sponsor.loan_interest_pence);
            const loanRepaidPence = safeNumber(sponsor.loan_repaid_pence);

            const calculatedLoanTotalOwed =
              safeNumber(sponsor.loan_total_owed_pence) ||
              loanReceivedPence + loanInterestPence;

            const calculatedLoanRemaining =
              sponsor.loan_remaining_pence !== undefined &&
              sponsor.loan_remaining_pence !== null
                ? safeNumber(sponsor.loan_remaining_pence)
                : calculatedLoanTotalOwed - loanRepaidPence;

            const isLoanPaidOff =
              Boolean(sponsor.is_loan_paid_off) ||
              (isLoan &&
                calculatedLoanTotalOwed > 0 &&
                calculatedLoanRemaining <= 0);

            const formattedLoanDueDate = formatDate(sponsor.loan_due_date);
            const formattedLoanPaidOffDate = formatDate(
              sponsor.loan_paid_off_at
            );

            return (
              <div
                key={sponsor.sponsor_id}
                className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-bold text-white">
                      {sponsor.sponsor_name}
                    </h3>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${fundingTypeBadgeClass(
                          fundingType
                        )}`}
                      >
                        {fundingTypeLabel(fundingType)}
                      </span>

                      {isLoan && (
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                            isLoanPaidOff
                              ? "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20"
                              : "bg-orange-500/15 text-orange-100 ring-orange-300/20"
                          }`}
                        >
                          {isLoanPaidOff ? "Paid off" : "Repayment active"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEditSponsor(sponsor.sponsor_id)}
                      className="rounded-xl bg-amber-500/15 p-2 text-amber-100 ring-1 ring-amber-300/20 hover:bg-amber-500/25"
                      title="Edit funding record"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteSponsorId(sponsor.sponsor_id)}
                      className="rounded-xl bg-red-500/15 p-2 text-red-200 ring-1 ring-red-300/20 hover:bg-red-500/25"
                      title="Delete funding record"
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

                {isLoan && sponsor.loan_repayment_terms && (
                  <div className="mt-3 rounded-xl bg-blue-500/10 p-3 text-xs text-blue-100 ring-1 ring-blue-300/20">
                    <p className="mb-1 font-bold text-blue-100">
                      Loan repayment terms
                    </p>

                    <p className="whitespace-pre-wrap break-words text-blue-100/80">
                      {sponsor.loan_repayment_terms}
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

                {isLoan ? (
                  <div className="mt-4 rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="rounded-xl bg-blue-500/20 p-2 text-blue-100 ring-1 ring-blue-300/20">
                          <CircleDollarSign className="h-4 w-4" />
                        </div>

                        <div className="min-w-0">
                          <p className="font-bold text-blue-100">
                            Loan tracking
                          </p>

                          <p className="text-xs text-blue-100/60">
                            Received, interest, repayments and balance owed.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-white/60">Loan received</span>
                        <span className="font-bold text-emerald-300">
                          {money(loanReceivedPence)}
                        </span>
                      </div>

                      <div className="flex justify-between gap-3">
                        <span className="text-white/60">Interest added</span>
                        <span
                          className={`font-bold ${
                            loanInterestPence > 0
                              ? "text-orange-300"
                              : "text-white/70"
                          }`}
                        >
                          {money(loanInterestPence)}
                        </span>
                      </div>

                      <div className="flex justify-between gap-3">
                        <span className="text-white/60">Total owed</span>
                        <span className="font-bold text-white">
                          {money(calculatedLoanTotalOwed)}
                        </span>
                      </div>

                      <div className="flex justify-between gap-3">
                        <span className="text-white/60">Paid back</span>
                        <span className="font-bold text-emerald-300">
                          {money(loanRepaidPence)}
                        </span>
                      </div>

                      <div className="flex justify-between gap-3 rounded-xl bg-black/25 px-3 py-2">
                        <span className="text-blue-100">Still to repay</span>
                        <span
                          className={`font-bold ${
                            calculatedLoanRemaining > 0
                              ? "text-orange-300"
                              : "text-emerald-300"
                          }`}
                        >
                          {money(Math.max(0, calculatedLoanRemaining))}
                        </span>
                      </div>

                      {formattedLoanDueDate && (
                        <div className="flex justify-between gap-3">
                          <span className="text-white/60">Due date</span>
                          <span className="font-bold text-white">
                            {formattedLoanDueDate}
                          </span>
                        </div>
                      )}

                      {isLoanPaidOff && formattedLoanPaidOffDate && (
                        <div className="flex justify-between gap-3">
                          <span className="text-white/60">Paid off on</span>
                          <span className="font-bold text-emerald-300">
                            {formattedLoanPaidOffDate}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => openLoanRepaymentModal?.(fundingItem)}
                        disabled={!openLoanRepaymentModal || isLoanPaidOff}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-black text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Banknote className="h-4 w-4" />
                        Record repayment
                      </button>

                      <button
                        type="button"
                        onClick={() => openLoanInterestModal?.(fundingItem)}
                        disabled={!openLoanInterestModal || isLoanPaidOff}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-3 py-2 text-xs font-black text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" />
                        Add interest
                      </button>
                    </div>
                  </div>
                ) : (
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}