"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import {
  Banknote,
  CircleDollarSign,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import type { FundingType, SponsorBreakdown } from "@/lib/money/types";
import { money } from "@/lib/money/helpers";

type LoanSponsorBreakdown = SponsorBreakdown & {
  loan_interest_pence?: number | null;
  loan_repaid_pence?: number | null;
  loan_remaining_pence?: number | null;
  loan_total_owed_pence?: number | null;
  loan_due_date?: string | null;
  loan_repayment_terms?: string | null;
  is_loan_paid_off?: boolean | number | string | null;
  loan_paid_off_at?: string | null;
};

type SponsorshipBreakdownProps = {
  selectedYear: string;
  yearlySponsorBreakdown?: SponsorBreakdown[];
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

const FUNDING_LABELS: Record<FundingTone, string> = {
  sponsor: "Sponsor",
  grant: "Grant Money",
  loan: "Loan",
  other: "Other Funding",
};

const FUNDING_BADGE_CLASSES: Record<FundingTone, string> = {
  sponsor: "bg-amber-500/15 text-amber-100 ring-amber-300/20",
  grant: "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20",
  loan: "bg-blue-500/15 text-blue-100 ring-blue-300/20",
  other: "bg-purple-500/15 text-purple-100 ring-purple-300/20",
};

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function readBoolean(value: unknown): boolean {
  if (value === true || value === 1 || value === "1") {
    return true;
  }

  const normalised = cleanText(value).toLowerCase();
  return normalised === "true" || normalised === "yes";
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeNonNegative(value: unknown): number {
  return Math.max(0, safeNumber(value));
}

function formatMoney(value: unknown): string {
  const parsed = safeNumber(value);
  return money(parsed);
}

function parseDateValue(value: unknown): Date | null {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDisplayDate(value?: string | null): string {
  const text = cleanText(value);

  if (!text) {
    return "";
  }

  const date = parseDateValue(text);

  if (!date) {
    return text;
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fundingTone(type?: FundingType | string | null): FundingTone {
  const normalised = cleanText(type).toLowerCase();

  if (normalised === "grant") return "grant";
  if (normalised === "loan") return "loan";
  if (normalised === "other") return "other";

  return "sponsor";
}

function fundingTypeLabel(type?: FundingType | string | null): string {
  return FUNDING_LABELS[fundingTone(type)];
}

function fundingTypeBadgeClass(
  type?: FundingType | string | null,
): string {
  return FUNDING_BADGE_CLASSES[fundingTone(type)];
}

function sponsorId(sponsor: SponsorBreakdown): string {
  return cleanText(sponsor.sponsor_id);
}

function sponsorName(sponsor: SponsorBreakdown): string {
  return cleanText(sponsor.sponsor_name) || "Unnamed funding record";
}

function fundingRenderKey(
  sponsor: SponsorBreakdown,
  index: number,
): string {
  return (
    sponsorId(sponsor) ||
    [
      sponsorName(sponsor),
      cleanText(sponsor.funding_type),
      cleanText(sponsor.email),
      index,
    ].join(":")
  );
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
      <span className="min-w-0 break-words text-white/60">{label}</span>
      <span
        className={`shrink-0 text-right font-black ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}

function FundingBadge({
  type,
}: {
  type?: FundingType | string | null;
}) {
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

function FundingNotes({
  title,
  notes,
}: {
  title: string;
  notes?: string | null;
}) {
  const cleanedNotes = cleanText(notes);

  if (!cleanedNotes) {
    return null;
  }

  return (
    <div className="mt-3 rounded-xl bg-white/5 p-3 text-xs text-white/60">
      <p className="mb-1 font-black text-white/80">{title}</p>
      <p className="whitespace-pre-wrap break-words leading-5">
        {cleanedNotes}
      </p>
    </div>
  );
}

function FundingContact({
  sponsor,
}: {
  sponsor: SponsorBreakdown;
}) {
  const contactName = cleanText(sponsor.contact_name);
  const email = cleanText(sponsor.email);
  const phone = cleanText(sponsor.phone);

  const contactLines = [
    contactName ? `Contact: ${contactName}` : "",
    email,
    phone,
  ].filter(Boolean);

  if (contactLines.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-1 text-sm text-white/50">
      {contactLines.map((line, index) => (
        <p key={`${line}:${index}`} className="break-words">
          {line}
        </p>
      ))}
    </div>
  );
}

function StandardFundingSummary({
  sponsor,
}: {
  sponsor: SponsorBreakdown;
}) {
  const agreed = safeNumber(sponsor.agreed_amount_pence);
  const received = safeNumber(sponsor.received_pence);
  const spent = safeNumber(sponsor.spent_pence);

  const remaining =
    sponsor.remaining_pence === null ||
    sponsor.remaining_pence === undefined
      ? received - spent
      : safeNumber(sponsor.remaining_pence);

  return (
    <div className="mt-4 space-y-2">
      <FundingRow
        label="Agreed / Awarded"
        value={formatMoney(agreed)}
      />
      <FundingRow
        label="Received"
        value={formatMoney(received)}
        valueClassName="text-emerald-300"
      />
      <FundingRow
        label="Spent"
        value={formatMoney(spent)}
        valueClassName="text-red-300"
      />
      <FundingRow
        label="Remaining"
        value={formatMoney(remaining)}
        valueClassName={
          remaining < 0 ? "text-red-300" : "text-amber-100"
        }
        highlight
      />
    </div>
  );
}

function getLoanValues(sponsor: LoanSponsorBreakdown) {
  const receivedPence = safeNonNegative(sponsor.received_pence);
  const interestPence = safeNonNegative(
    sponsor.loan_interest_pence,
  );
  const repaidPence = safeNonNegative(sponsor.loan_repaid_pence);

  const explicitTotalOwed = safeNumber(
    sponsor.loan_total_owed_pence,
  );

  const totalOwedPence =
    explicitTotalOwed > 0
      ? explicitTotalOwed
      : receivedPence + interestPence;

  const explicitRemaining =
    sponsor.loan_remaining_pence !== undefined &&
    sponsor.loan_remaining_pence !== null
      ? safeNumber(sponsor.loan_remaining_pence)
      : null;

  const remainingPence =
    explicitRemaining ?? totalOwedPence - repaidPence;

  const paidOff =
    readBoolean(sponsor.is_loan_paid_off) ||
    (totalOwedPence > 0 && remainingPence <= 0);

  return {
    receivedPence,
    interestPence,
    repaidPence,
    totalOwedPence,
    remainingPence,
    paidOff,
  };
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
  const {
    receivedPence,
    interestPence,
    repaidPence,
    totalOwedPence,
    remainingPence,
    paidOff,
  } = getLoanValues(sponsor);

  const dueDate = formatDisplayDate(sponsor.loan_due_date);
  const paidOffDate = formatDisplayDate(sponsor.loan_paid_off_at);

  return (
    <div className="mt-4 rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4">
      <div className="mb-3 flex min-w-0 items-center gap-2">
        <div className="rounded-xl bg-blue-500/20 p-2 text-blue-100 ring-1 ring-blue-300/20">
          <CircleDollarSign
            className="h-4 w-4"
            aria-hidden="true"
          />
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
          value={formatMoney(receivedPence)}
          valueClassName="text-emerald-300"
        />
        <FundingRow
          label="Interest added"
          value={formatMoney(interestPence)}
          valueClassName={
            interestPence > 0
              ? "text-orange-300"
              : "text-white/70"
          }
        />
        <FundingRow
          label="Total owed"
          value={formatMoney(totalOwedPence)}
        />
        <FundingRow
          label="Paid back"
          value={formatMoney(repaidPence)}
          valueClassName="text-emerald-300"
        />
        <FundingRow
          label="Still to repay"
          value={formatMoney(Math.max(0, remainingPence))}
          valueClassName={
            remainingPence > 0
              ? "text-orange-300"
              : "text-emerald-300"
          }
          highlight
        />

        {dueDate ? (
          <FundingRow label="Due date" value={dueDate} />
        ) : null}

        {paidOff && paidOffDate ? (
          <FundingRow
            label="Paid off on"
            value={paidOffDate}
            valueClassName="text-emerald-300"
          />
        ) : null}
      </div>

      {remainingPence < 0 ? (
        <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">
          This loan is overpaid by{" "}
          {formatMoney(Math.abs(remainingPence))}.
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => openLoanRepaymentModal?.(fundingItem)}
          disabled={!openLoanRepaymentModal || paidOff}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-black text-black transition hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Banknote className="h-4 w-4" aria-hidden="true" />
          Record repayment
        </button>

        <button
          type="button"
          onClick={() => openLoanInterestModal?.(fundingItem)}
          disabled={!openLoanInterestModal || paidOff}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
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
  const id = sponsorId(sponsor);
  const name = sponsorName(sponsor);
  const isLoan = fundingTone(sponsor.funding_type) === "loan";
  const { paidOff: isLoanPaidOff } = getLoanValues(sponsor);
  const carriedForward = safeNumber(sponsor.carried_forward_pence);

  const canEdit = Boolean(id);
  const canDelete = Boolean(id);

  return (
    <article className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-black text-white">
            {name}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <FundingBadge type={sponsor.funding_type} />
            {isLoan ? (
              <LoanStatusBadge paidOff={isLoanPaidOff} />
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => {
              if (id) {
                startEditSponsor(id);
              }
            }}
            disabled={!canEdit}
            className="rounded-xl bg-amber-500/15 p-2 text-amber-100 ring-1 ring-amber-300/20 transition hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Edit ${name}`}
            title={canEdit ? "Edit funding record" : "Missing funding ID"}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (id) {
                setDeleteSponsorId(id);
              }
            }}
            disabled={!canDelete}
            className="rounded-xl bg-red-500/15 p-2 text-red-200 ring-1 ring-red-300/20 transition hover:bg-red-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Delete ${name}`}
            title={canDelete ? "Delete funding record" : "Missing funding ID"}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {!id ? (
        <div className="mt-3 rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100">
          This funding record has no ID, so it cannot be edited or deleted.
        </div>
      ) : null}

      <FundingContact sponsor={sponsor} />
      <FundingNotes title="Funding notes" notes={sponsor.notes} />
      <FundingNotes
        title="Loan repayment terms"
        notes={sponsor.loan_repayment_terms}
      />

      {carriedForward !== 0 ? (
        <div
          className={`mt-3 rounded-xl p-3 text-xs ring-1 ${
            carriedForward > 0
              ? "bg-purple-500/10 text-purple-100 ring-purple-300/20"
              : "bg-red-500/10 text-red-100 ring-red-300/20"
          }`}
        >
          Carried forward into {cleanText(selectedYear) || "this year"}:{" "}
          <strong>{formatMoney(carriedForward)}</strong>
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
  yearlySponsorBreakdown = [],
  openNewSponsorForm,
  startEditSponsor,
  setDeleteSponsorId,
  openLoanRepaymentModal,
  openLoanInterestModal,
}: SponsorshipBreakdownProps) {
  const fundingItems = useMemo(
    () => [...yearlySponsorBreakdown],
    [yearlySponsorBreakdown],
  );

  const yearLabel =
    cleanText(selectedYear).toLowerCase() === "all"
      ? "all years"
      : `Jan to Dec ${cleanText(selectedYear) || "selected year"}`;

  return (
    <section
      aria-labelledby="sponsorship-breakdown-title"
      className="min-w-0 overflow-hidden rounded-3xl border border-amber-300/20 bg-amber-500/10 p-4 sm:p-5"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-amber-100/70">
            Restricted funding
          </p>

          <h2
            id="sponsorship-breakdown-title"
            className="mt-1 break-words text-xl font-black text-amber-100"
          >
            Sponsors, Grants, Loans &amp; Other Funding
          </h2>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-amber-100/70">
            Track what came in, what was spent, what was repaid and what is
            left for {yearLabel}.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewSponsorForm}
          className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-black transition hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          Add Funding
        </button>
      </div>

      {fundingItems.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm leading-6 text-white/65">
          No sponsors, grants, loans or other funding have been added for{" "}
          {yearLabel} yet.
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {fundingItems.map((fundingItem, index) => (
            <FundingCard
              key={fundingRenderKey(fundingItem, index)}
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
