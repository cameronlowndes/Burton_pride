"use client";

import type { Dispatch, SetStateAction } from "react";
import { Banknote, CircleDollarSign, Pencil, Plus, Trash2 } from "lucide-react";

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

type FundingTone = "sponsor" | "grant" | "loan" | "other";

type FundingRowProps = {
  label: string;
  value: string;
  valueClassName?: string;
  highlight?: boolean;
};

const fundingLabels: Record<FundingTone, string> = {
  sponsor: "Sponsor",
  grant: "Grant Money",
  loan: "Loan",
  other: "Other Funding",
};

const fundingBadgeClasses: Record<FundingTone, string> = {
  sponsor: "bg-amber-500/15 text-amber-100 ring-amber-300/20",
  grant: "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20",
  loan: "bg-blue-500/15 text-blue-100 ring-blue-300/20",
  other: "bg-purple-500/15 text-purple-100 ring-purple-300/20",
};

function fundingTone(type?: FundingType | string | null): FundingTone {
  if (type === "grant") return "grant";
  if (type === "loan") return "loan";
  if (type === "other") return "other";
  return "sponsor";
}

function safeNumber(value: number | null | undefined) {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
}

function formatDisplayDate(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fundingTypeLabel(type?: FundingType | string | null) {
  return fundingLabels[fundingTone(type)];
}

function fundingTypeBadgeClass(type?: FundingType | string | null) {
  return fundingBadgeClasses[fundingTone(type)];
}

function FundingRow({
  label,
  value,
  valueClassName = "text-white",
  highlight = false,
}: FundingRowProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${
        highlight ? "bg-white/10" : "bg-black/10"
      }`}
    >
      <span className="text-white/60">{label}</span>
      <span className={`text-right font-black ${valueClassName}`}>{value}</span>
    </div>
  );
}

function FundingBadge({ type }: { type?: FundingType | string | null }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${fundingTypeBadgeClass(
        type,
      )}`}
    >
      {fundingTypeLabel(type)}
    </span>
  );
}

function LoanStatusBadge({ paidOff }: { paidOff: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${
        paidOff
          ? "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20"
          : "bg-orange-500/15 text-orange-100 ring-orange-300/20"
      }`}
    >
      {paidOff ? "Paid off" : "Repayment active"}
    </span>
  );
}

function FundingNotes({ title, notes }: { title: string; notes?: string | null }) {
  if (!notes) return null;

  return (
    <div className="mt-3 rounded-xl bg-white/5 p-3 text-xs text-white/60">
      <p className="mb-1 font-black text-white/80">{title}</p>
      <p className="whitespace-pre-wrap break-words leading-5">{notes}</p>
    </div>
  );
}

function FundingContact({ sponsor }: { sponsor: SponsorBreakdown }) {
  const contactLines = [
    sponsor.contact_name ? `Contact: ${sponsor.contact_name}` : "",
    sponsor.email || "",
    sponsor.phone || "",
  ].filter(Boolean);

  if (contactLines.length === 0) return null;

  return (
    <div className="mt-3 space-y-1 text-sm text-white/50">
      {contactLines.map((line) => (
        <p key={line} className="break-words">
          {line}
        </p>
      ))}
    </div>
  );
}

function StandardFundingSummary({ sponsor }: { sponsor: SponsorBreakdown }) {
  return (
    <div className="mt-4 space-y-2">
      <FundingRow
        label="Agreed / Awarded"
        value={money(sponsor.agreed_amount_pence)}
      />
      <FundingRow
        label="Received"
        value={money(sponsor.received_pence)}
        valueClassName="text-emerald-300"
      />
      <FundingRow
        label="Spent"
        value={money(sponsor.spent_pence)}
        valueClassName="text-red-300"
      />
      <FundingRow
        label="Remaining"
        value={money(sponsor.remaining_pence)}
        valueClassName="text-amber-100"
        highlight
      />
    </div>
  );
}

function LoanSummary({
  sponsor,
  fundingItem,
  openLoanRepaymentModal,
  openLoanInterestModal,
}: {
  sponsor: LoanSponsorBreakdown;
  fundingItem: SponsorBreakdown;
  openLoanRepaymentModal?: (sponsor: SponsorBreakdown) => void;
  openLoanInterestModal?: (sponsor: SponsorBreakdown) => void;
}) {
  const receivedPence = safeNumber(sponsor.received_pence);
  const interestPence = safeNumber(sponsor.loan_interest_pence);
  const repaidPence = safeNumber(sponsor.loan_repaid_pence);
  const totalOwedPence =
    safeNumber(sponsor.loan_total_owed_pence) || receivedPence + interestPence;
  const remainingPence =
    sponsor.loan_remaining_pence !== undefined && sponsor.loan_remaining_pence !== null
      ? safeNumber(sponsor.loan_remaining_pence)
      : totalOwedPence - repaidPence;
  const paidOff =
    Boolean(sponsor.is_loan_paid_off) ||
    (totalOwedPence > 0 && remainingPence <= 0);

  const dueDate = formatDisplayDate(sponsor.loan_due_date);
  const paidOffDate = formatDisplayDate(sponsor.loan_paid_off_at);

  return (
    <div className="mt-4 rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4">
      <div className="mb-3 flex min-w-0 items-center gap-2">
        <div className="rounded-xl bg-blue-500/20 p-2 text-blue-100 ring-1 ring-blue-300/20">
          <CircleDollarSign className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="font-black text-blue-100">Loan tracking</p>
          <p className="text-xs text-blue-100/60">
            Received, interest, repayments and balance owed.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <FundingRow
          label="Loan received"
          value={money(receivedPence)}
          valueClassName="text-emerald-300"
        />
        <FundingRow
          label="Interest added"
          value={money(interestPence)}
          valueClassName={interestPence > 0 ? "text-orange-300" : "text-white/70"}
        />
        <FundingRow label="Total owed" value={money(totalOwedPence)} />
        <FundingRow
          label="Paid back"
          value={money(repaidPence)}
          valueClassName="text-emerald-300"
        />
        <FundingRow
          label="Still to repay"
          value={money(Math.max(0, remainingPence))}
          valueClassName={remainingPence > 0 ? "text-orange-300" : "text-emerald-300"}
          highlight
        />

        {dueDate ? <FundingRow label="Due date" value={dueDate} /> : null}
        {paidOff && paidOffDate ? (
          <FundingRow
            label="Paid off on"
            value={paidOffDate}
            valueClassName="text-emerald-300"
          />
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => openLoanRepaymentModal?.(fundingItem)}
          disabled={!openLoanRepaymentModal || paidOff}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-black text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Banknote className="h-4 w-4" />
          Record repayment
        </button>

        <button
          type="button"
          onClick={() => openLoanInterestModal?.(fundingItem)}
          disabled={!openLoanInterestModal || paidOff}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add interest
        </button>
      </div>
    </div>
  );
}

function FundingCard({
  fundingItem,
  selectedYear,
  startEditSponsor,
  setDeleteSponsorId,
  openLoanRepaymentModal,
  openLoanInterestModal,
}: {
  fundingItem: SponsorBreakdown;
  selectedYear: string;
  startEditSponsor: (sponsorId: string) => void;
  setDeleteSponsorId: Dispatch<SetStateAction<string | null>>;
  openLoanRepaymentModal?: (sponsor: SponsorBreakdown) => void;
  openLoanInterestModal?: (sponsor: SponsorBreakdown) => void;
}) {
  const sponsor = fundingItem as LoanSponsorBreakdown;
  const isLoan = sponsor.funding_type === "loan";
  const loanTotalOwed =
    safeNumber(sponsor.loan_total_owed_pence) ||
    safeNumber(sponsor.received_pence) + safeNumber(sponsor.loan_interest_pence);
  const loanRemaining =
    sponsor.loan_remaining_pence !== undefined && sponsor.loan_remaining_pence !== null
      ? safeNumber(sponsor.loan_remaining_pence)
      : loanTotalOwed - safeNumber(sponsor.loan_repaid_pence);
  const isLoanPaidOff =
    Boolean(sponsor.is_loan_paid_off) ||
    (isLoan && loanTotalOwed > 0 && loanRemaining <= 0);

  return (
    <article className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-black text-white">
            {sponsor.sponsor_name}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <FundingBadge type={sponsor.funding_type} />
            {isLoan ? <LoanStatusBadge paidOff={isLoanPaidOff} /> : null}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => startEditSponsor(sponsor.sponsor_id)}
            className="rounded-xl bg-amber-500/15 p-2 text-amber-100 ring-1 ring-amber-300/20 transition hover:bg-amber-500/25"
            title="Edit funding record"
          >
            <Pencil className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setDeleteSponsorId(sponsor.sponsor_id)}
            className="rounded-xl bg-red-500/15 p-2 text-red-200 ring-1 ring-red-300/20 transition hover:bg-red-500/25"
            title="Delete funding record"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <FundingContact sponsor={sponsor} />
      <FundingNotes title="Funding notes" notes={sponsor.notes} />
      <FundingNotes title="Loan repayment terms" notes={sponsor.loan_repayment_terms} />

      {safeNumber(sponsor.carried_forward_pence) > 0 ? (
        <div className="mt-3 rounded-xl bg-purple-500/10 p-3 text-xs text-purple-100 ring-1 ring-purple-300/20">
          Carried forward into {selectedYear}: {" "}
          <strong>{money(sponsor.carried_forward_pence || 0)}</strong>
        </div>
      ) : null}

      {isLoan ? (
        <LoanSummary
          sponsor={sponsor}
          fundingItem={fundingItem}
          openLoanRepaymentModal={openLoanRepaymentModal}
          openLoanInterestModal={openLoanInterestModal}
        />
      ) : (
        <StandardFundingSummary sponsor={sponsor} />
      )}
    </article>
  );
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
          <p className="text-xs font-black uppercase tracking-wide text-amber-100/70">
            Restricted funding
          </p>

          <h2 className="mt-1 text-xl font-black text-amber-100">
            Sponsors, Grants, Loans & Other Funding
          </h2>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-amber-100/70">
            Track what came in, what was spent, what was repaid and what is left
            for Jan to Dec {selectedYear}.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewSponsorForm}
          className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-black transition hover:bg-amber-400"
        >
          Add Funding
        </button>
      </div>

      {yearlySponsorBreakdown.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm leading-6 text-white/65">
          No sponsors, grants, loans or other funding have been added for {selectedYear} yet.
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {yearlySponsorBreakdown.map((fundingItem) => (
            <FundingCard
              key={fundingItem.sponsor_id}
              fundingItem={fundingItem}
              selectedYear={selectedYear}
              startEditSponsor={startEditSponsor}
              setDeleteSponsorId={setDeleteSponsorId}
              openLoanRepaymentModal={openLoanRepaymentModal}
              openLoanInterestModal={openLoanInterestModal}
            />
          ))}
        </div>
      )}
    </section>
  );
}
